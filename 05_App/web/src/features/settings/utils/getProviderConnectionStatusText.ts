export function getProviderConnectionStatusText(
  isConfigured: boolean,
  isConnected: boolean,
  isAttemptingSilentReconnect: boolean,
  wasEverConnected: boolean,
  configurationError?: string,
): string {
  if (!isConfigured) return configurationError ?? "Ikke konfigureret";
  if (isConnected) return "Forbundet";
  if (isAttemptingSilentReconnect) return "Genopretter forbindelsen...";
  return wasEverConnected ? "Ikke forbundet i denne session" : "Ikke forbundet endnu";
}
