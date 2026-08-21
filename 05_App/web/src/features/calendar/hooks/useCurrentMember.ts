import { useEffect, useState } from "react";

import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import {
  getCurrentMemberId,
  setCurrentMemberId as saveCurrentMemberId,
} from "../preferences/currentMemberStorage";
import { getMyFamily, linkFamilyMemberToMe } from "../../family/familyApi";
import { useFamilyMembers } from "./useFamilyMembers";

interface UseCurrentMemberResult {
  currentMember: CalendarOwner | null;
  setCurrentMemberId: (memberId: string | null) => Promise<string | null>;
}

/**
 * Hvilket familiemedlem "er mig" på denne enhed (Sprint 18) — bruges af
 * forsidens hilsen og "Min profil" i Indstillinger, i stedet for et
 * hardcodet navn. Ud over den lokale enhedsindstilling kobles brugeren nu
 * også server-side til medlemmet (linked_user_id) — det er den kobling,
 * der afgør, om personligt tildelte opgaver kan sende en push til
 * brugerens egen konto.
 */
export function useCurrentMember(): UseCurrentMemberResult {
  const { members } = useFamilyMembers();
  const [currentMemberId, setCurrentMemberIdState] = useState(() =>
    getCurrentMemberId(),
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

  const currentMember =
    members.find(
      (member) =>
        member.id === currentMemberId && member.id !== familyPseudoMemberId,
    ) ?? null;

  // Sprint 29: linkFamilyMemberToMe() blev hidtil kun kaldt af
  // setCurrentMemberId() nedenfor — dvs. kun ved et NYT valg. Enhver, der
  // havde valgt "Min profil" FØR denne kobling blev indført (Sprint 27),
  // fik derfor aldrig sat linked_user_id server-side og modtog stille og
  // roligt ingen push for personligt tildelte opgaver. Genkobler derfor
  // også ved almindelig indlæsning, når et medlem allerede er valgt —
  // idempotent server-side (samme bruger/medlem er en no-op).
  useEffect(() => {
    if (!familyId || !currentMemberId || currentMemberId === familyPseudoMemberId) {
      return;
    }

    void linkFamilyMemberToMe(familyId, currentMemberId);
  }, [familyId, currentMemberId]);

  // Returnerer en fejlbesked, hvis server-koblingen fejlede (fx medlemmet
  // er allerede en andens "Min profil") — den lokale enhedsindstilling
  // sættes uanset, så UI'et ikke låses af en midlertidig serverfejl.
  async function setCurrentMemberId(memberId: string | null): Promise<string | null> {
    setCurrentMemberIdState(memberId);
    saveCurrentMemberId(memberId);

    if (!memberId || !familyId) {
      return null;
    }

    const result = await linkFamilyMemberToMe(familyId, memberId);

    if (!result.ok) {
      return result.data.error ?? "Kunne ikke koble profilen til din konto.";
    }

    return null;
  }

  return { currentMember, setCurrentMemberId };
}
