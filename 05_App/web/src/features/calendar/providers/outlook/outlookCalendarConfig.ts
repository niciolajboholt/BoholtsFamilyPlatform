export interface OutlookCalendarConfig {
  enabled: boolean;
  clientId?: string;
  // Sat, hvis Azure-app-registreringen er "Single tenant only" (fx en
  // arbejds-/skolekonto-app) — Microsofts /common-login-endpoint er kun
  // gyldigt for multi-tenant-registreringer (AADSTS50194 ellers). Ikke sat
  // betyder "common" (personlige konti + enhver organisation).
  tenantId?: string;
  configurationError?: string;
}

// Midlertidigt slået fra (Sprint 18): P+P Arkitekters Entra-tenant kræver
// admin-samtykke for nye apps (AADSTS65004 — Nicolaj er ikke selv
// administrator dér), og godkendelsen afventer stadig deres IT-afdeling.
// Koden er fuldt færdig og testet — fjern kun denne linje igen, når
// samtykket er givet, for at slå funktionen til uden yderligere ændringer.
const isTemporarilyDisabled = true;

export function getOutlookCalendarConfig(): OutlookCalendarConfig {
  if (isTemporarilyDisabled) {
    return {
      enabled: false,
      configurationError: "Outlook Kalender kommer snart — afventer IT-godkendelse hos arbejdsgiveren.",
    };
  }

  const enabled =
    import.meta.env.VITE_OUTLOOK_CALENDAR_ENABLED?.trim().toLowerCase() === "true";
  const clientId = import.meta.env.VITE_OUTLOOK_CLIENT_ID?.trim();
  const tenantId = import.meta.env.VITE_OUTLOOK_TENANT_ID?.trim() || undefined;

  if (!enabled) {
    return { enabled: false };
  }

  if (!clientId) {
    return {
      enabled: false,
      configurationError: "Outlook Kalender mangler et client ID.",
    };
  }

  return { enabled: true, clientId, tenantId };
}
