import { ChevronRightRounded, SyncRounded } from "@mui/icons-material";
import { Avatar, Box, CircularProgress, IconButton, Typography } from "@mui/material";

interface ProviderConnectionRowProps {
  label: string;
  statusText: string;
  isConnected: boolean;
  isConfigured: boolean;
  isBusy: boolean;
  isAttemptingSilentReconnect: boolean;
  // Udeladt for en provider uden en manuel forbind/afbryd-handling (Fase 3:
  // Google forbindes allerede ved login) — rækken viser da kun status.
  onToggleConnection?: () => void;
}

/**
 * Én række i "Kalenderforbindelser"-kortet — delt af Google og Outlook (og
 * senere Apple), så SettingsPage ikke skal gentage det samme layout for
 * hver provider. Kalender-til-familiemedlem-tildeling sker ikke længere her
 * (Fase 3) — den flyttede ind i "Rediger familiemedlem", så rækken viser nu
 * kun forbindelsesstatus.
 */
export function ProviderConnectionRow({
  label,
  statusText,
  isConnected,
  isConfigured,
  isBusy,
  isAttemptingSilentReconnect,
  onToggleConnection,
}: ProviderConnectionRowProps) {
  return (
    <Box
      sx={{
        display: "grid",
        // Yderkolonnerne holdes lige brede (1fr/1fr), så midterkolonnen altid
        // ligger på rækkens rigtige, geometriske midte — uanset om
        // højrekolonnen indeholder en pil-knap (Outlook) eller er tom
        // (Google, forbindes allerede ved login, Fase 3). Et rent
        // flexGrow-baseret layout centrerer kun i den PLADS der er tilbage
        // efter knappen, så teksten driver skævt mellem de to rækker.
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        py: 1.5,
      }}
    >
      <Box aria-hidden />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            bgcolor: "background.default",
            color: "text.primary",
          }}
        >
          <SyncRounded />
        </Avatar>

        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600 }}>
            {label}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {statusText}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        {onToggleConnection && (
          <IconButton
            aria-label={isConnected ? `Afbryd ${label}` : `Forbind ${label}`}
            disabled={!isConfigured || isBusy || isAttemptingSilentReconnect}
            onClick={onToggleConnection}
          >
            {isBusy || isAttemptingSilentReconnect ? (
              <CircularProgress size={20} />
            ) : (
              <ChevronRightRounded />
            )}
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
