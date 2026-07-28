import { Alert, Button, Stack, Typography } from "@mui/material";

import type { CalendarProviderHealth } from "../models/calendarProviderHealth";

interface GoogleCalendarConnectionProps {
  isConfigured: boolean;
  configurationError?: string;
  isConnected: boolean;
  isBusy: boolean;
  health?: CalendarProviderHealth;
  onConnect: () => void;
  onDisconnect: () => void;
  onRetry: () => void;
}

/**
 * PrÃ¦senterer kun forbindelsens status og handlinger. OAuth og Google API er
 * afgrÃ¦nset til provider-laget.
 */
export function GoogleCalendarConnection({
  isConfigured,
  configurationError,
  isConnected,
  isBusy,
  health,
  onConnect,
  onDisconnect,
  onRetry,
}: GoogleCalendarConnectionProps) {
  if (!isConfigured) {
    return (
      <Alert
        severity={configurationError ? "error" : "info"}
        sx={{ mb: 2.5 }}
      >
        {configurationError ?? "Google Kalender er ikke konfigureret."}
      </Alert>
    );
  }

  const hasReadError = health?.status === "error";
  const message = hasReadError
    ? health.message ?? "Google Kalender kunne ikke opdateres. Dine lokale kalendere vises stadig."
    : isConnected
      ? "Google Kalender er forbundet. Skrivbare Google-kalendere kan ændres."
      : "Forbind Google Kalender for at se dine eksterne aftaler.";

  return (
    <Alert
      severity={hasReadError ? "error" : isConnected ? "success" : "info"}
      sx={{ mb: 2.5 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: { sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2">
          {message}
        </Typography>
        <Stack direction="row" spacing={1}>
          {hasReadError && health?.canRetry && (
            <Button
              size="small"
              variant="outlined"
              disabled={isBusy}
              onClick={onRetry}
            >
              Prøv igen
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            disabled={isBusy}
            onClick={isConnected ? onDisconnect : onConnect}
          >
            {isConnected ? "Afbryd" : "Forbind Google Kalender"}
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
