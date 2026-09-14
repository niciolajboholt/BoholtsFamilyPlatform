export interface OutlookCalendarConfig {
  enabled: boolean;
  clientId?: string;
  tenantId?: string;
  configurationError?: string;
}

// Sprint 48: genbruger den samme personlige Azure-app-registrering som
// server/lib/microsoftOAuth.ts (kun "personal Microsoft accounts" tilladt),
// i stedet for den gamle, P+P Arkitekter-tenant-bundne app, der forblev
// slået fra pga. admin-samtykke-blokeringen (se historikken nedenfor).
// Nicolaj besluttede eksplicit, at Outlook-kalenderen kun må være mulig for
// personlige konti, aldrig arbejds-/skolekonti — derfor er tenantId fastlåst
// til "consumers" her, IKKE noget nogen kan ændre via miljøvariabel (i
// modsætning til clientId, som kan overstyres til lokal test mod en anden
// app-registrering).
//
// Kræver at app-registreringen (samme Client ID som Microsoft-login) har
// fået tilføjet en "Single-page application"-platform med redirect-URI'erne
// https://boholtsfamilyplatform-beta.nicolajbach12.workers.dev og
// https://boholtsfamilyplatform.nicolajbach12.workers.dev (uden sti — MSAL
// bruger window.location.origin som redirectUri, se OutlookCalendarSession.ts),
// samt "Calendars.ReadWrite" tilføjet under API permissions → Microsoft
// Graph → Delegated permissions. Se 48_Sprint48_...Plan.md.
const consumersOnlyClientId = "9f89bd38-3f50-4efc-80c6-83508b45609f";

// Historik (Sprint 18): P+P Arkitekters Entra-tenant krævede admin-samtykke
// (AADSTS65004 — Nicolaj er ikke selv administrator dér) for den daværende,
// arbejdstenant-bundne app-registrering. Den blokering gjaldt kun den
// gamle app, ikke den nye, personlige registrering ovenfor. Ingen
// configurationError her med vilje — appen skal opføre sig som om Outlook
// slet ikke findes, hvis funktionen nogensinde slås fra igen, ikke vise en
// "kommer snart"-besked (se CalendarPage.tsx's tilsvarende betingede banner).
const isTemporarilyDisabled = false;

export function getOutlookCalendarConfig(): OutlookCalendarConfig {
  if (isTemporarilyDisabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    clientId: import.meta.env.VITE_OUTLOOK_CLIENT_ID?.trim() || consumersOnlyClientId,
    tenantId: "consumers",
  };
}
