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

export function getOutlookCalendarConfig(): OutlookCalendarConfig {
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
