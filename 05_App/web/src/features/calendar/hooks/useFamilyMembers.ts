import { useCallback, useState } from "react";

import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import {
  getFamilyMembers,
  saveFamilyMembers,
} from "../preferences/familyMembersStorage";
import { CalendarService } from "../services/CalendarService";

export interface FamilyMemberInput {
  name: string;
  relation?: CalendarOwner["relation"];
  color: string;
  isPlaceholderName?: boolean;
}

const combiningDiacriticalMarks = /[̀-ͯ]/g;

// Æ/Ø/Å don't decompose via Unicode NFD (unlike e.g. é), so they need an
// explicit mapping to stay readable in the generated id.
const danishLetterSubstitutions: Record<string, string> = {
  æ: "ae",
  ø: "o",
  å: "aa",
};

function replaceDanishLetters(value: string): string {
  return value.replace(
    /[æøå]/g,
    (letter) => danishLetterSubstitutions[letter],
  );
}

// Slugifies a name into a stable id ("Bedstemor" -> "bedstemor"), adding a
// numeric suffix on collision — no UUID dependency needed for a handful of
// family members.
export function slugifyMemberName(
  name: string,
  existingIds: readonly string[],
): string {
  const base =
    replaceDanishLetters(name.trim().toLowerCase())
      .normalize("NFD")
      .replace(combiningDiacriticalMarks, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "medlem";

  if (!existingIds.includes(base)) {
    return base;
  }

  let suffix = 2;
  while (existingIds.includes(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

interface UseFamilyMembersResult {
  members: CalendarOwner[];
  addMember: (input: FamilyMemberInput) => CalendarOwner;
  updateMember: (id: string, input: FamilyMemberInput) => void;
  deleteMember: (id: string) => Promise<void>;
}

export function useFamilyMembers(): UseFamilyMembersResult {
  const [members, setMembers] = useState<CalendarOwner[]>(() =>
    getFamilyMembers(),
  );

  const addMember = useCallback(
    (input: FamilyMemberInput): CalendarOwner => {
      let created!: CalendarOwner;

      setMembers((currentMembers) => {
        const id = slugifyMemberName(
          input.name,
          currentMembers.map((member) => member.id),
        );

        created = { id, ...input };

        const nextMembers = [...currentMembers, created];
        saveFamilyMembers(nextMembers);
        return nextMembers;
      });

      return created;
    },
    [],
  );

  const updateMember = useCallback(
    (id: string, input: FamilyMemberInput): void => {
      setMembers((currentMembers) => {
        const nextMembers = currentMembers.map((member) =>
          member.id === id ? { ...member, ...input, id } : member,
        );

        saveFamilyMembers(nextMembers);
        return nextMembers;
      });
    },
    [],
  );

  const deleteMember = useCallback(async (id: string): Promise<void> => {
    if (id === familyPseudoMemberId) {
      return;
    }

    await CalendarService.reassignOwner(id, familyPseudoMemberId);

    setMembers((currentMembers) => {
      const nextMembers = currentMembers.filter(
        (member) => member.id !== id,
      );

      saveFamilyMembers(nextMembers);
      return nextMembers;
    });
  }, []);

  return { members, addMember, updateMember, deleteMember };
}
