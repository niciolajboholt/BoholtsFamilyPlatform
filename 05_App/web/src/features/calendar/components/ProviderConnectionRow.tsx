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
        display: "flex",
        alignItems: "center",
        py: 1.5,
      }}
    >
      {/* Ikon og tekst grupperes og centreres sammen, i stedet for at teksten
          centreres alene i den fulde resterende bredde — ellers ender
          teksten langt fra ikonet, når der ikke er en kontrol i højre side
          (Google-rækken efter Fase 3) til at afbalancere bredden. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          flexGrow: 1,
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
  );
}
