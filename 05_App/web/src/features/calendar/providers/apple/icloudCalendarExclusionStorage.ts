const STORAGE_KEY = "boholts-family-icloud-excluded-calendars";

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
 * De KODEDE iCloud-sourceId'er (encodeIcloudCalendarSourceId — ikke den rå
 * CalDAV-URL alene), som brugeren aktivt har fravalgt i
 * "Vælg kalendere"-listen i IcloudConnectionsPanel. Mirror af
 * googleCalendarExclusionStorage.ts/outlookCalendarExclusionStorage.ts, men
 * bruger det allerede-kodede sourceId som nøgle i stedet for et rå
 * kalender-id — iCloud har ikke ét globalt kalender-id-rum som Google/
 * Outlook (samme CalDAV-URL-struktur kan i teorien gå igen på tværs af to
 * forskellige forbindelser), så nøglen skal identificere BÅDE forbindelse og
 * kalender.
 *
 * En ekskluderet kalender hentes slet ikke af IcloudCalendarProvider — hverken
 * dens egen liste over kalendere eller dens hændelser — så den bruger heller
 * ingen unødig CalDAV-trafik eller vises i "Vis kalendere".
 */
export function getExcludedIcloudCalendarSourceIds(): string[] {
  return readExcludedIds();
}

export function setExcludedIcloudCalendars(sourceIds: readonly string[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...new Set(sourceIds)]),
  );
}

export function clearExcludedIcloudCalendars(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Fjerner kun den slettede forbindelses egne fravalg, ikke andre stadig
 * forbundne kontis — i modsætning til Google/Outlook (ét login, ét globalt
 * fravalg pr. familie-enhed) kan flere iCloud-forbindelser eksistere side om
 * side, så en hel nulstilling ved sletning af én af dem ville uskadeliggøre
 * de andres valg.
 */
export function clearExcludedIcloudCalendarsForConnection(connectionId: string): void {
  const prefix = `icloud:${encodeURIComponent(connectionId)}:`;
  const remaining = readExcludedIds().filter((sourceId) => !sourceId.startsWith(prefix));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}
