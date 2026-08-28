import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";

import type { CalendarProviderHealth } from "../models/calendarProviderHealth";
import { formatDanishDateTime } from "../utils/formatDanishDateTime";

interface ExternalCalendarConnectionBannerProps {
  providerLabel: string;
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
 * Indstillinger. OAuth og de eksterne API'er er afgrænset til provider-laget.
 * Generisk på tværs af Google/Outlook (og senere Apple) via providerLabel.
 */
export function ExternalCalendarConnectionBanner({
  providerLabel,
  isConfigured,
  configurationError,
  isConnected,
  wasEverConnected,
  isAttemptingSilentReconnect,
  health,
  onRetry,
}: ExternalCalendarConnectionBannerProps) {
  if (!isConfigured) {
    return (
      <Alert
        severity={configurationError ? "error" : "info"}
        sx={{ mb: 2.5 }}
      >
        {configurationError ?? `${providerLabel} Kalender er ikke konfigureret.`}
      </Alert>
    );
  }

  const hasReadError = health?.status === "error";
  const staleDataAsOf = health?.staleDataAsOf;

  // Den "glade" tilstand (forbundet, ingen fejl) fylder ikke længere en
  // permanent bannerplads over kalenderen — den vises i stedet som et lille
  // synkroniseringsikon ved kalenderoverskriften (se CalendarPage), med den
  // fulde status stadig tilgængelig under Indstillinger. En offline-fallback
  // (Fase 8) er hverken den glade tilstand eller en fejl — brugeren skal se
  // tydeligt, at data ikke er live.
  if (isConnected && !hasReadError && !staleDataAsOf) {
    return null;
  }

  const message = hasReadError
    ? health.message ?? `${providerLabel} Kalender kunne ikke opdateres. Dine lokale kalendere vises stadig.`
    : staleDataAsOf
      ? `${providerLabel} Kalender viser gemte aftaler fra ${formatDanishDateTime(staleDataAsOf)}, da enheden er offline.`
      : isConnected
        ? `${providerLabel} Kalender er forbundet. Skrivbare ${providerLabel}-kalendere kan ændres.`
        : isAttemptingSilentReconnect
          ? `Genopretter forbindelsen til ${providerLabel} Kalender...`
          : wasEverConnected
            ? `${providerLabel} Kalender er ikke forbundet i denne session. Genopret forbindelsen under Indstillinger.`
            : `Forbind ${providerLabel} Kalender under Indstillinger for at se dine eksterne aftaler.`;

  return (
    <Alert
      severity={hasReadError ? "error" : staleDataAsOf ? "warning" : isConnected ? "success" : "info"}
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
