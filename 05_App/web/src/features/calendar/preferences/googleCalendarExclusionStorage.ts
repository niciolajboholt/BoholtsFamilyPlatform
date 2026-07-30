const STORAGE_KEY = "boholts-family-google-excluded-calendars";

function readExcludedIds(): string[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

/**
 * Rå Google-kalender-id'er (ikke det kodede sourceId), som brugeren aktivt
 * har fravalgt i "Vælg Google-kalendere"-dialogen ved forbindelse. En
 * ekskluderet kalender hentes slet ikke — den optræder derfor heller ikke i
 * "Vis kalendere" — i modsætning til den almindelige synligheds-skjuling
 * (calendarSourceVisibilityStorage), som stadig henter, men blot filtrerer
 * visningen af en kalender, der allerede er bragt ind.
 */
export function getExcludedGoogleCalendarIds(): string[] {
  return readExcludedIds();
}

/**
 * Erstatter hele fravalgslisten — dialogen, der kalder denne, viser altid
 * kalenderens fulde, aktuelle tilstand (både tidligere og nye fravalg), så
 * en delvis tilføjelse ville efterlade tidligere fravalgte kalendere låst
 * fast, selvom brugeren har markeret dem igen.
 */
export function setExcludedGoogleCalendars(calendarIds: readonly string[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...new Set(calendarIds)]),
  );
}

/**
 * Ryddes ved eksplicit afbrydelse, så en senere (gen)forbindelse — evt. med
 * en anden Google-konto — starter forfra med alle kalendere til rådighed i
 * valg-dialogen, i stedet for at arve en tidligere kontos fravalg.
 */
export function clearExcludedGoogleCalendars(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
