import { ChevronRightRounded, SyncRounded } from "@mui/icons-material";
import { Avatar, Box, CircularProgress, IconButton, Typography } from "@mui/material";

interface ProviderConnectionRowProps {
  label: string;
  statusText: string;
  isConnected: boolean;
  isConfigured: boolean;
  isBusy: boolean;
  isAttemptingSilentReconnect: boolean;
  onManageCalendars: () => void;
  // Udeladt for en provider uden en manuel forbind/afbryd-handling (Fase 3:
  // Google forbindes allerede ved login) — rækken viser da kun status.
  onToggleConnection?: () => void;
}

/**
 * Én række i "Kalenderforbindelser"-kortet — delt af Google og Outlook (og
 * senere Apple), så SettingsPage ikke skal gentage det samme layout for
 * hver provider.
 */
export function ProviderConnectionRow({
  label,
  statusText,
  isConnected,
  isConfigured,
  isBusy,
  isAttemptingSilentReconnect,
  onManageCalendars,
  onToggleConnection,
}: ProviderConnectionRowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.5,
      }}
    >
      <IconButton
        aria-label={`Administrer ${label}`}
        disabled={!isConnected}
        onClick={onManageCalendars}
        sx={{ p: 0 }}
      >
        <Avatar
          sx={{
            bgcolor: "background.default",
            color: "text.primary",
          }}
        >
          <SyncRounded />
        </Avatar>
      </IconButton>

      <Box sx={{ flexGrow: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>
          {label}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {statusText}
        </Typography>
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
