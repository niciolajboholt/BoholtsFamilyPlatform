const STORAGE_KEY = "boholts-current-member-id";

/**
 * Hvilket familiemedlem "er mig" på denne enhed — bruges til hilsenen på
 * forsiden og "Min profil" i Indstillinger. Gemmes pr. enhed, ligesom andre
 * simple valg (fx googleCalendarExclusionStorage) — hvert familiemedlem
 * sætter selv dette op på sin egen telefon/computer.
 */
export function getCurrentMemberId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentMemberId(memberId: string | null): void {
  try {
    if (memberId) {
      window.localStorage.setItem(STORAGE_KEY, memberId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private browsing, disabled storage) —
    // the choice simply won't persist across a reload.
  }
}

export function clearCurrentMemberId(): void {
  setCurrentMemberId(null);
}
