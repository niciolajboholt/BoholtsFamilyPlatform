// Sprint 57 (se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md, afsnit E):
// getMyFamily() havde ingen cache og blev kaldt uafhængigt fra 20+ steder
// — en enkelt Overblik-/Mit i dag-indlæsning udløste mindst 4 identiske
// /api/families/mine-kald (AppLayout, useEnabledFeatures, useFamilyMembers,
// useCurrentMember), fordi hver hook ejer sin egen useState/useEffect-
// hentning uden deling.
//
// Genbruger det samme mønster, resten af kodebasen allerede bruger til
// deling på tværs af hook-instanser (modul-niveau tilstand +
// CustomEvent/eksplicit invalidering — se familyMembersStorage.ts's
// familyMembersChangedEvent og useEnabledFeatures.ts's
// enabledFeaturesChangedEvent), i stedet for at introducere en ny
// state-management-platform. En kort TTL er sikkerhedsnettet mod
// permanent forældet data, hvis et kaldested glemmer at invalidere efter
// en mutation.
import { getMyFamily, type FamilyResponse } from "./familyApi";

const FAMILY_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  promise: Promise<{ ok: boolean; status: number; data: FamilyResponse }>;
  cachedAt: number;
}

let entry: CacheEntry | null = null;

// Flere samtidige kaldere inden for samme TTL-vindue deler ét faktisk
// fetch-kald — også dem, der kalder inden det første svar er kommet
// tilbage (delt Promise, ikke kun delt resultat).
export function getCachedFamily(): Promise<{ ok: boolean; status: number; data: FamilyResponse }> {
  const now = Date.now();

  if (entry && now - entry.cachedAt < FAMILY_CACHE_TTL_MS) {
    return entry.promise;
  }

  const promise = getMyFamily();
  entry = { promise, cachedAt: now };

  // En fejlet hentning skal ikke blive "husket" i TTL-vinduet — ellers
  // ville en forbigående netværksfejl forhindre enhver efterfølgende
  // hook i at prøve igen, indtil TTL'en selv udløber.
  promise.catch(() => {
    if (entry?.promise === promise) {
      entry = null;
    }
  });

  return promise;
}

// Kaldes efter enhver mutation, der ændrer familien/medlemmerne/rollerne
// (i dag: syncFamilyMembersFromServer, som allerede er det eksisterende
// centrale "familiedata ændret sig"-signal — se familyMembersSync.ts).
export function invalidateFamilyCache(): void {
  entry = null;
}
