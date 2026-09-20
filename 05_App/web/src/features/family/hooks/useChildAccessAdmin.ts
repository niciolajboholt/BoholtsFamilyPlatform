import { useEffect, useState } from "react";

import {
  clearChildAccessPin,
  generateChildAccessToken,
  getChildAccessSessions,
  getChildAccessStatus,
  revokeAllChildAccessSessions,
  revokeChildAccessSession,
  revokeChildAccessToken,
  setChildAccessPin,
  type ChildAccessSessionDto,
} from "../familyApi";

// Sprint 55: al state/logik for at administrere ÉT familiemedlems
// børneadgang (link, PIN, aktive sessioner) — udtrukket fra
// FamilyMemberDialog.tsx's tidligere inline sektion (Sprint 53), så den
// nye samlede ChildAccessDialog.tsx kan genbruge nøjagtig den samme logik
// i stedet for at duplikere et andet administrations-flow. Se
// 55_Sprint55_Barn_Adgang_UX_Plan.md's Fase A.
export function useChildAccessAdmin(familyId: string | null, memberId: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinSetAt, setPinSetAt] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChildAccessSessionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function reload() {
    if (!familyId || !memberId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const [statusResult, sessionsResult] = await Promise.all([
      getChildAccessStatus(familyId, memberId),
      getChildAccessSessions(familyId, memberId),
    ]);

    if (!statusResult.ok) {
      setError(statusResult.data.error ?? "Kunne ikke hente børneadgang.");
      setIsLoading(false);
      return;
    }

    setToken(statusResult.data.token);
    setHasPin(statusResult.data.hasPin);
    setPinSetAt(statusResult.data.pinSetAt);
    setSessions(sessionsResult.ok ? (sessionsResult.data.sessions ?? []) : []);
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, memberId]);

  async function generateOrRotateToken() {
    if (!familyId || !memberId) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const response = await generateChildAccessToken(familyId, memberId);
    setIsBusy(false);

    if (!response.ok || !response.data.token) {
      setError(response.data.error ?? "Linket kunne ikke oprettes.");
      return;
    }

    setToken(response.data.token);
    setHasPin(false);
    setPinSetAt(null);
    setSessions([]);
  }

  async function revokeToken() {
    if (!familyId || !memberId) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const response = await revokeChildAccessToken(familyId, memberId);
    setIsBusy(false);

    if (!response.ok) {
      setError(response.data.error ?? "Linket kunne ikke fjernes.");
      return;
    }

    setToken(null);
    setHasPin(false);
    setPinSetAt(null);
    setSessions([]);
  }

  async function setPin(pin: string): Promise<boolean> {
    if (!familyId || !memberId) {
      return false;
    }

    setIsBusy(true);
    setError(null);
    const response = await setChildAccessPin(familyId, memberId, pin);
    setIsBusy(false);

    if (!response.ok) {
      setError(response.data.error ?? "Koden kunne ikke gemmes.");
      return false;
    }

    setHasPin(true);
    setPinSetAt(response.data.pinSetAt ?? new Date().toISOString());
    return true;
  }

  async function clearPin() {
    if (!familyId || !memberId) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const response = await clearChildAccessPin(familyId, memberId);
    setIsBusy(false);

    if (!response.ok) {
      setError(response.data.error ?? "Koden kunne ikke ryddes.");
      return;
    }

    setHasPin(false);
    setPinSetAt(null);
    setSessions([]);
  }

  async function revokeAllSessions() {
    if (!familyId || !memberId) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const response = await revokeAllChildAccessSessions(familyId, memberId);
    setIsBusy(false);

    if (!response.ok) {
      setError(response.data.error ?? "Enhederne kunne ikke logges ud.");
      return;
    }

    setSessions([]);
  }

  async function revokeSession(sessionId: string) {
    if (!familyId || !memberId) {
      return;
    }

    setIsBusy(true);
    setError(null);
    const response = await revokeChildAccessSession(familyId, memberId, sessionId);
    setIsBusy(false);

    if (!response.ok) {
      setError(response.data.error ?? "Enheden kunne ikke logges ud.");
      return;
    }

    setSessions((current) => current.filter((session) => session.id !== sessionId));
  }

  return {
    token,
    hasPin,
    pinSetAt,
    sessions,
    isLoading,
    error,
    isBusy,
    generateOrRotateToken,
    revokeToken,
    setPin,
    clearPin,
    revokeAllSessions,
    revokeSession,
  };
}
