/**
 * Manuel backup/restore af al familie-data i localStorage (Audit F-11).
 * ADR-012 fastholder localStorage som lagringsteknologi ved den nuværende
 * datamængde — denne fil er sikkerhedsnettet mod fx en ryddet browser-cache,
 * ikke en synkroniseringsmekanisme mellem devices (se ADR-011, single-device).
 */
const backupKeyPrefix = "boholts-family-";
const backupSchemaVersion = 1;

export interface DataBackup {
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

function isDataBackup(value: unknown): value is DataBackup {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DataBackup>;

  return (
    typeof candidate.version === "number" &&
    typeof candidate.exportedAt === "string" &&
    typeof candidate.data === "object" &&
    candidate.data !== null &&
    Object.entries(candidate.data).every(
      ([key, entryValue]) => typeof key === "string" && typeof entryValue === "string",
    )
  );
}

/**
 * Samler alle localStorage-nøgler med appens præfiks i én eksporterbar
 * struktur. Værdierne gemmes som de rå, allerede-serialiserede strenge, så
 * eksport/import ikke skal kende hver enkelt lagrings interne format.
 */
export function createDataBackup(): DataBackup {
  const data: Record<string, string> = {};

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(backupKeyPrefix)) continue;

    const value = window.localStorage.getItem(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  return {
    version: backupSchemaVersion,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Genskriver localStorage fra en tidligere eksporteret backup. Overskriver
 * kun nøgler med appens eget præfiks, og kaster ved et ugyldigt/uventet
 * filformat i stedet for at skrive delvis eller forkert data.
 */
export function restoreDataBackup(backup: unknown): void {
  if (!isDataBackup(backup)) {
    throw new Error("Filen er ikke en gyldig Boholts Familie-backup.");
  }

  for (const [key, value] of Object.entries(backup.data)) {
    if (key.startsWith(backupKeyPrefix)) {
      window.localStorage.setItem(key, value);
    }
  }
}

/**
 * Rydder alle localStorage-nøgler med appens præfiks — kaldt ved logout
 * (Sprint 29), så en anden bruger, der logger ind på samme enhed bagefter,
 * ikke arver den forrige brugers kalender-cache, kilde-synlighed,
 * kalender-mappings eller gentagelsesundtagelser. Nøgler uden præfikset
 * (fx "Min profil" og Outlook/MSAL's egen state) ryddes hver for sig af
 * deres eget modul, som allerede kaldes separat fra logout.
 */
export function clearAllFamilyStorage(): void {
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(backupKeyPrefix)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
