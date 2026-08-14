import { useCallback, useEffect, useState } from "react";

import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import { getFamilyMembers } from "../preferences/familyMembersStorage";
import { CalendarService } from "../services/CalendarService";
import {
  addFamilyMember,
  deleteFamilyMember,
  getMyFamily,
  updateFamilyMember,
} from "../../family/familyApi";
import { syncFamilyMembersFromServer } from "../../family/familyMembersSync";

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
  addMember: (input: FamilyMemberInput) => Promise<void>;
  updateMember: (id: string, input: FamilyMemberInput) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

// Fase 2: medlemmer er nu familie-ejede (D1), ikke enheds-lokale — enhver
// tilføjelse/redigering/sletning går derfor gennem serveren, og den
// returnerede medlemsliste er altid det, der ender i localStorage bagefter
// (via syncFamilyMembersFromServer), så alle familiens enheder til sidst
// konvergerer på samme data. familyId hentes én gang ved mount; findes den
// ikke endnu (fx et helt nyt device, før AppLayout har nået at synce),
// bliver mutationer stille no-ops i stedet for at fejle synligt.
export function useFamilyMembers(): UseFamilyMembersResult {
  const [members, setMembers] = useState<CalendarOwner[]>(() =>
    getFamilyMembers(),
  );
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.family) {
        setFamilyId(result.data.family.id);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const addMember = useCallback(
    async (input: FamilyMemberInput): Promise<void> => {
      if (!familyId) {
        return;
      }

      const result = await addFamilyMember(familyId, {
        name: input.name,
        color: input.color,
        relation: input.relation ?? null,
      });

      if (result.ok && result.data.members) {
        syncFamilyMembersFromServer(result.data.members);
        setMembers(getFamilyMembers());
      }
    },
    [familyId],
  );

  const updateMember = useCallback(
    async (id: string, input: FamilyMemberInput): Promise<void> => {
      if (!familyId) {
        return;
      }

      const isFamilyPseudoMember = id === familyPseudoMemberId;

      const result = await updateFamilyMember(familyId, id, {
        name: input.name,
        color: input.color,
        // relation=null er reserveret til familie-pseudomedlemmet på
        // serveren og ignoreres for alle andre — at rydde et almindeligt
        // medlems relation helt er en kendt, accepteret begrænsning her.
        ...(isFamilyPseudoMember ? {} : { relation: input.relation ?? null }),
      });

      if (result.ok && result.data.members) {
        syncFamilyMembersFromServer(result.data.members);
        setMembers(getFamilyMembers());
      }
    },
    [familyId],
  );

  const deleteMember = useCallback(
    async (id: string): Promise<void> => {
      if (id === familyPseudoMemberId || !familyId) {
        return;
      }

      await CalendarService.reassignOwner(id, familyPseudoMemberId);

      const result = await deleteFamilyMember(familyId, id);

      if (result.ok && result.data.members) {
        syncFamilyMembersFromServer(result.data.members);
        setMembers(getFamilyMembers());
      }
    },
    [familyId],
  );

  return { members, addMember, updateMember, deleteMember };
}
