import { useEffect, useState } from "react";

import {
  AutoAwesomeRounded,
  DarkModeRounded,
  LightModeRounded,
  NotificationsRounded,
  SettingsBrightnessRounded,
} from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Divider, Switch, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

import { usePushNotifications } from "../../notifications/hooks/usePushNotifications";
import { getMyFamily, updateFamilyPrivacySettings } from "../../family/familyApi";
import type { ThemeModePreference } from "../../../theme/ThemeModeContext";
import { useThemeMode } from "../../../theme/ThemeModeContext";
import { SettingsSectionHeader } from "./SettingsPrimitives";

export function AppNotificationsSection() {
  const {
    preference: themePreference,
    resolvedMode: resolvedThemeMode,
    setPreference: setThemePreference,
  } = useThemeMode();

  const {
    status: pushNotificationStatus,
    error: pushNotificationError,
    isBusy: pushNotificationIsBusy,
    enable: enablePushNotificationsAction,
    disable: disablePushNotificationsAction,
    sendTest: sendTestPushNotificationAction,
  } = usePushNotifications();

  const pushNotificationSubtitle = (() => {
    switch (pushNotificationStatus) {
      case "unsupported":
        return "Ikke understøttet i denne browser";
      case "denied":
        return "Blokeret i browserens indstillinger";
      case "subscribed":
        return "Får besked ved ændringer i kalender og indkøbsliste";
      default:
        return "Påmindelser om aftaler og ændringer";
    }
  })();

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [canManageAiPreference, setCanManageAiPreference] = useState(false);
  const [aiWeeklySummaryEnabled, setAiWeeklySummaryEnabled] = useState(false);
  const [isAiPreferenceLoading, setIsAiPreferenceLoading] = useState(true);
  const [aiPreferenceError, setAiPreferenceError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.family) {
        setFamilyId(result.data.family.id);
        setCanManageAiPreference(
          result.data.role === "owner" || result.data.role === "admin",
        );
        setAiWeeklySummaryEnabled(
          result.data.family.aiWeeklySummaryEnabled !== 0,
        );
      }

      if (!isCancelled) {
        setIsAiPreferenceLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleAiPreferenceChange(enabled: boolean): Promise<void> {
    if (!familyId) return;

    const previous = aiWeeklySummaryEnabled;
    setAiWeeklySummaryEnabled(enabled);
    setIsAiPreferenceLoading(true);
    setAiPreferenceError(null);

    const result = await updateFamilyPrivacySettings(familyId, enabled);
    if (!result.ok) {
      setAiWeeklySummaryEnabled(previous);
      setAiPreferenceError(
        result.data.error ?? "AI-indstillingen kunne ikke gemmes.",
      );
    }

    setIsAiPreferenceLoading(false);
  }

  return (
    <>
      <SettingsSectionHeader>App og notifikationer</SettingsSectionHeader>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", py: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexGrow: 1,
              }}
            >
              <NotificationsRounded color="action" />

              <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>Notifikationer</Typography>

                <Typography variant="body2" color="text.secondary">
                  {pushNotificationSubtitle}
                </Typography>
              </Box>
            </Box>

            <Switch
              checked={pushNotificationStatus === "subscribed"}
              slotProps={{
                input: { "aria-label": "Tillad pushnotifikationer" },
              }}
              disabled={
                pushNotificationIsBusy ||
                pushNotificationStatus === "loading" ||
                pushNotificationStatus === "unsupported" ||
                pushNotificationStatus === "denied"
              }
              onChange={(event) =>
                event.target.checked
                  ? enablePushNotificationsAction()
                  : disablePushNotificationsAction()
              }
            />
          </Box>

          {pushNotificationError && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {pushNotificationError}
            </Alert>
          )}

          {pushNotificationStatus === "denied" && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Tillad notifikationer i browserens webstedsindstillinger, og
              genindlæs derefter appen.
            </Alert>
          )}

          {pushNotificationStatus === "subscribed" && (
            <Button
              size="small"
              onClick={sendTestPushNotificationAction}
              disabled={pushNotificationIsBusy}
              sx={{ mb: 1.5 }}
            >
              Send test-notifikation
            </Button>
          )}

          <Divider />

          <Box sx={{ display: "flex", alignItems: "center", py: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexGrow: 1,
              }}
            >
              <AutoAwesomeRounded color="action" />

              <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>AI-ugeresumé</Typography>
                <Typography variant="body2" color="text.secondary">
                  {canManageAiPreference
                    ? "Bruger aftaletitler, åbne opgaver og indkøbsvarer til et ugentligt resumé"
                    : "Kun familiens ejer eller admin kan ændre dette valg"}
                </Typography>
              </Box>
            </Box>

            <Switch
              checked={aiWeeklySummaryEnabled}
              disabled={isAiPreferenceLoading || !familyId || !canManageAiPreference}
              slotProps={{
                input: { "aria-label": "Tillad automatisk AI-ugeresumé" },
              }}
              onChange={(event) => void handleAiPreferenceChange(event.target.checked)}
            />
          </Box>

          {aiPreferenceError && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {aiPreferenceError}
            </Alert>
          )}

          <Divider />

          <Box sx={{ py: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <DarkModeRounded color="action" />

              <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>Udseende</Typography>

                <Typography variant="body2" color="text.secondary">
                  {themePreference === "system"
                    ? `Følger telefonen (i øjeblikket ${
                        resolvedThemeMode === "dark" ? "mørkt" : "lyst"
                      })`
                    : themePreference === "dark"
                      ? "Mørkt tema"
                      : "Lyst tema"}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <ToggleButtonGroup
                value={themePreference}
                exclusive
                size="small"
                onChange={(_event, value: ThemeModePreference | null) => {
                  if (value) {
                    setThemePreference(value);
                  }
                }}
                aria-label="Udseende"
              >
                <ToggleButton value="light" aria-label="Lyst tema">
                  <LightModeRounded fontSize="small" sx={{ mr: 0.75 }} />
                  Lyst
                </ToggleButton>

                <ToggleButton value="dark" aria-label="Mørkt tema">
                  <DarkModeRounded fontSize="small" sx={{ mr: 0.75 }} />
                  Mørkt
                </ToggleButton>

                <ToggleButton value="system" aria-label="Følg telefonen">
                  <SettingsBrightnessRounded fontSize="small" sx={{ mr: 0.75 }} />
                  System
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
