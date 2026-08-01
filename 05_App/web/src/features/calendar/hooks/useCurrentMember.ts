import { useState } from "react";

import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import {
  getCurrentMemberId,
  setCurrentMemberId as saveCurrentMemberId,
} from "../preferences/currentMemberStorage";
import { useFamilyMembers } from "./useFamilyMembers";

interface UseCurrentMemberResult {
  currentMember: CalendarOwner | null;
  setCurrentMemberId: (memberId: string | null) => void;
}

/**
 * Hvilket familiemedlem "er mig" på denne enhed (Sprint 18) — bruges af
 * forsidens hilsen og "Min profil" i Indstillinger, i stedet for et
 * hardcodet navn.
 */
export function useCurrentMember(): UseCurrentMemberResult {
  const { members } = useFamilyMembers();
  const [currentMemberId, setCurrentMemberIdState] = useState(() =>
    getCurrentMemberId(),
  );

  const currentMember =
    members.find(
      (member) =>
        member.id === currentMemberId && member.id !== familyPseudoMemberId,
    ) ?? null;

  function setCurrentMemberId(memberId: string | null): void {
    setCurrentMemberIdState(memberId);
    saveCurrentMemberId(memberId);
  }

  return { currentMember, setCurrentMemberId };
}
