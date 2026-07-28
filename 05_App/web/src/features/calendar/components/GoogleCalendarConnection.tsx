import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";

import type { CalendarProviderHealth } from "../models/calendarProviderHealth";

interface GoogleCalendarConnectionProps {
  isConfigured: boolean;
  configurationError?: string;
  isConnected: boolean;
  wasEverConnected: boolean;
  isBusy: boolean;
  health?: CalendarProviderHealth;
  onConnect: () => void;
  onDisconnect: () => void;
  onRetry: () => void;
}

/**
 * Præsenterer kun forbindelsens status og handlinger. OAuth og Google API er
 * afgrænset til provider-laget.
 */
export function GoogleCalendarConnection({
  isConfigured,
  configurationError,
  isConnected,
  wasEverConnected,
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
      : wasEverConnected
        ? "Google Kalender er ikke forbundet i denne session. Genopret forbindelsen for at se dine eksterne aftaler."
        : "Forbind Google Kalender for at se dine eksterne aftaler.";

  const connectLabel = isBusy
    ? isConnected
      ? "Afbryder..."
      : "Forbinder..."
    : isConnected
      ? "Afbryd"
      : wasEverConnected
        ? "Genforbind Google Kalender"
        : "Forbind Google Kalender";

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
            startIcon={
              isBusy ? (
                <CircularProgress size={14} color="inherit" />
              ) : undefined
            }
            onClick={isConnected ? onDisconnect : onConnect}
          >
            {connectLabel}
          </Button>
        </Stack>
      </Stack>
    </Alert>
  );
}
