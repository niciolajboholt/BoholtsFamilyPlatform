import { useState } from "react";

import { CalendarMonthRounded } from "@mui/icons-material";
import { Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Typography } from "@mui/material";

import { ProviderConnectionRow } from "../../calendar/components/ProviderConnectionRow";
import { useGoogleCalendarConnection } from "../../calendar/hooks/useGoogleCalendarConnection";
import { useOutlookCalendarConnection } from "../../calendar/hooks/useOutlookCalendarConnection";
import { clearCalendarMemberMappings } from "../../calendar/preferences/calendarMemberMappingStorage";
import { clearExcludedOutlookCalendars } from "../../calendar/providers/outlook/outlookCalendarExclusionStorage";
import { getProviderConnectionStatusText } from "../utils/getProviderConnectionStatusText";
import { IcsSubscriptionsDialog } from "./IcsSubscriptionsDialog";
import { SettingsLinkRow, SettingsSectionHeader } from "./SettingsPrimitives";

export function CalendarConnectionsSection() {
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isOutlookCalendarBusy, setIsOutlookCalendarBusy] = useState(false);
  const [isIcsDialogOpen, setIsIcsDialogOpen] = useState(false);

  const { isConnected: isGoogleCalendarConnected, reconnect: reconnectGoogleCalendar } =
    useGoogleCalendarConnection();

  const {
    isConfigured: isOutlookCalendarConfigured,
    configurationError: outlookConfigurationError,
    isConnected: isOutlookCalendarConnected,
    wasEverConnected: wasOutlookCalendarEverConnected,
    isAttemptingSilentReconnect: isAttemptingOutlookSilentReconnect,
    redirectDiagnostic: outlookRedirectDiagnostic,
    connect: connectOutlookCalendar,
    disconnect: disconnectOutlookCalendar,
  } = useOutlookCalendarConnection();

  async function handleToggleOutlookCalendar(): Promise<void> {
    if (isOutlookCalendarConnected) {
      disconnectOutlookCalendar();
      clearExcludedOutlookCalendars();
      void clearCalendarMemberMappings();

      return;
    }

    setIsOutlookCalendarBusy(true);
    try {
      // Navigerer væk fra appen ved succes (Outlook bruger redirect, ikke
      // pop-up, jf. ADR-016) — koden efter connectOutlookCalendar() når
      // normalt ikke at køre. Efter login skal brugeren selv trykke
      // synk-ikonet for at vælge kalendere.
      await connectOutlookCalendar();
    } catch {
      // Fejlen undlader blot at markere som forbundet — Kalender-siden
      // viser fortsat "ikke forbundet", som er tilstrækkelig feedback.
    } finally {
      setIsOutlookCalendarBusy(false);
    }
  }

  const googleCalendarStatusText = isGoogleCalendarConnected ? "Forbundet" : "Forbindelsen mangler";

  const outlookCalendarStatusText = getProviderConnectionStatusText(
    isOutlookCalendarConfigured,
    isOutlookCalendarConnected,
    isAttemptingOutlookSilentReconnect,
    wasOutlookCalendarEverConnected,
    outlookConfigurationError,
  );

  const calendarConnectionsSummary = `Google ${
    isGoogleCalendarConnected ? "forbundet" : "afbrudt"
  } · Outlook ${isOutlookCalendarConnected ? "forbundet" : "fra"}`;

  return (
    <>
      <SettingsSectionHeader>Kalenderforbindelser</SettingsSectionHeader>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <SettingsLinkRow
            icon={<CalendarMonthRounded color="action" />}
            title="Kalenderforbindelser"
            subtitle={calendarConnectionsSummary}
            onClick={() => setIsCalendarDialogOpen(true)}
          />
        </CardContent>
      </Card>

      <Dialog open={isCalendarDialogOpen} onClose={() => setIsCalendarDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Kalenderforbindelser</DialogTitle>

        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Saml familiens eksterne kalendere.
          </Typography>

          <ProviderConnectionRow
            label="Google Calendar"
            statusText={googleCalendarStatusText}
            isConnected={isGoogleCalendarConnected}
            isConfigured
            isBusy={false}
            isAttemptingSilentReconnect={false}
          />

          {!isGoogleCalendarConnected && (
            <Alert
              severity="warning"
              sx={{ mt: 1.5 }}
              action={
                <Button color="inherit" size="small" onClick={reconnectGoogleCalendar}>
                  Forbind igen
                </Button>
              }
            >
              Google Kalender-forbindelsen mangler — familiens kalender kan
              ikke hentes, før den er genoprettet.
            </Alert>
          )}

          <Divider sx={{ my: 1.5 }} />

          <ProviderConnectionRow
            label="Outlook Calendar"
            statusText={outlookCalendarStatusText}
            isConnected={isOutlookCalendarConnected}
            isConfigured={isOutlookCalendarConfigured}
            isBusy={isOutlookCalendarBusy}
            isAttemptingSilentReconnect={isAttemptingOutlookSilentReconnect}
            onToggleConnection={() => {
              void handleToggleOutlookCalendar();
            }}
          />

          {outlookRedirectDiagnostic && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {outlookRedirectDiagnostic}
            </Alert>
          )}

          <Divider sx={{ my: 1.5 }} />

          <ProviderConnectionRow
            label="Delt kalender (ICS)"
            statusText="Skole-, idræts- eller andre delte kalendere via link"
            isConnected={false}
            isConfigured
            isBusy={false}
            isAttemptingSilentReconnect={false}
            onToggleConnection={() => setIsIcsDialogOpen(true)}
            actionAriaLabel="Administrér delte kalendere (ICS)"
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsCalendarDialogOpen(false)}>Luk</Button>
        </DialogActions>
      </Dialog>

      <IcsSubscriptionsDialog open={isIcsDialogOpen} onClose={() => setIsIcsDialogOpen(false)} />
    </>
  );
}
