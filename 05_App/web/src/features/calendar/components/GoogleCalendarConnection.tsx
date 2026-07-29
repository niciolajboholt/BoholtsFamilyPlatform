import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";

import type { CalendarProviderHealth } from "../models/calendarProviderHealth";

interface GoogleCalendarConnectionProps {
  isConfigured: boolean;
  configurationError?: string;
  isConnected: boolean;
  wasEverConnected: boolean;
  isAttemptingSilentReconnect: boolean;
  health?: CalendarProviderHealth;
  onRetry: () => void;
}

/**
 * Viser kun forbindelsens status — selve forbind/afbryd-handlingen sker fra
 * Indstillinger. OAuth og Google API er afgrænset til provider-laget.
 */
export function GoogleCalendarConnection({
  isConfigured,
  configurationError,
  isConnected,
  wasEverConnected,
  isAttemptingSilentReconnect,
  health,
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
      : isAttemptingSilentReconnect
        ? "Genopretter forbindelsen til Google Kalender..."
        : wasEverConnected
          ? "Google Kalender er ikke forbundet i denne session. Genopret forbindelsen under Indstillinger."
          : "Forbind Google Kalender under Indstillinger for at se dine eksterne aftaler.";

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
          {isAttemptingSilentReconnect && (
            <CircularProgress
              size={12}
              color="inherit"
              sx={{ mr: 1, verticalAlign: "middle" }}
            />
          )}
          {message}
        </Typography>

        {hasReadError && health?.canRetry && (
          <Button size="small" variant="outlined" onClick={onRetry}>
            Prøv igen
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
