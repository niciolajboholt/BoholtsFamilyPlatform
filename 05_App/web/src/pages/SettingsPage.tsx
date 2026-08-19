import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import {
  CalendarMonthRounded,
  ChevronRightRounded,
  CloudDownloadRounded,
  CloudUploadRounded,
  DarkModeRounded,
  FamilyRestroomRounded,
  LogoutRounded,
  NotificationsRounded,
  PersonRounded,
  SaveRounded,
} from "@mui/icons-material";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Switch,
  Typography,
} from "@mui/material";

import { FamilyMemberDialog } from "../features/calendar/components/FamilyMemberDialog";
import { useSession } from "../features/auth/hooks/useSession";
import { InviteCodeCard } from "../features/family/InviteCodeCard";
import { ShareLinkCard } from "../features/family/ShareLinkCard";
import { CurrentMemberPickerDialog } from "../features/calendar/components/CurrentMemberPickerDialog";
import { ProviderConnectionRow } from "../features/calendar/components/ProviderConnectionRow";
import type { CalendarOwner } from "../features/calendar/data/calendarOwners";
import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { useFamilyMembers } from "../features/calendar/hooks/useFamilyMembers";
import { useGoogleCalendarConnection } from "../features/calendar/hooks/useGoogleCalendarConnection";
import { useOutlookCalendarConnection } from "../features/calendar/hooks/useOutlookCalendarConnection";
import {
  clearCalendarMemberMappings,
  getCalendarIdForOwner,
  refreshCalendarMemberMappingsFromServer,
} from "../features/calendar/preferences/calendarMemberMappingStorage";
import {
  createDataBackup,
  restoreDataBackup,
} from "../features/calendar/preferences/dataBackupStorage";
import { clearExcludedOutlookCalendars } from "../features/calendar/providers/outlook/outlookCalendarExclusionStorage";
import { usePushNotifications } from "../features/notifications/hooks/usePushNotifications";
import type { MappableCalendarOption } from "../features/calendar/providers/calendarProviderFactory";
import { listAllMappableCalendars } from "../features/calendar/providers/calendarProviderFactory";
import { getInitials } from "../features/calendar/utils/getInitials";

function SettingsPage() {
  const {
    members,
    addMember,
    updateMember,
    deleteMember,
  } = useFamilyMembers();

  const [editingMember, setEditingMember] = useState<CalendarOwner | null>(
    null,
  );
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);

  const { currentMember, setCurrentMemberId } = useCurrentMember();
  const [isCurrentMemberPickerOpen, setIsCurrentMemberPickerOpen] =
    useState(false);
  const [currentMemberLinkError, setCurrentMemberLinkError] = useState<
    string | null
  >(null);

  function handleSelectCurrentMember(memberId: string): void {
    setCurrentMemberLinkError(null);
    setCurrentMemberId(memberId).then((error) => {
      if (error) {
        setCurrentMemberLinkError(error);
      }
    });
  }

  const { user, logout } = useSession();

  function handleOpenAddMember() {
    setEditingMember(null);
    setIsMemberDialogOpen(true);
  }

  function handleOpenEditMember(member: CalendarOwner) {
    setEditingMember(member);
    setIsMemberDialogOpen(true);
  }

  function handleSaveMember(
    input: Parameters<typeof addMember>[0],
  ) {
    if (editingMember) {
      void updateMember(editingMember.id, input);
    } else {
      void addMember(input);
    }
  }

  const {
    isConnected: isGoogleCalendarConnected,
    reconnect: reconnectGoogleCalendar,
  } = useGoogleCalendarConnection();

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

  const [isOutlookCalendarBusy, setIsOutlookCalendarBusy] = useState(false);

  // Kalender-til-medlem-visning (kun læsning her — selve tildelingen sker i
  // FamilyMemberDialog) — hentes én gang, så familielisten kan vise hvilken
  // kalender hvert medlem allerede er koblet til.
  const [calendarOptions, setCalendarOptions] = useState<
    MappableCalendarOption[]
  >([]);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([
      listAllMappableCalendars(),
      refreshCalendarMemberMappingsFromServer(),
    ])
      .then(([options]) => {
        if (!isCancelled) {
          setCalendarOptions(options);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCalendarOptions([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const calendarLabelByRawId = new Map(
    calendarOptions.map((option) => [option.rawCalendarId, option.label]),
  );

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

  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  function handleExportData() {
    const backup = createDataBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `boholts-familie-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setBackupFeedback({
      severity: "success",
      message: "Backup downloadet.",
    });
  }

  function handleImportFileSelected(
    changeEvent: ChangeEvent<HTMLInputElement>,
  ) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        restoreDataBackup(parsed);

        // Al app-state (familiemedlemmer, kalenderaftaler, indstillinger) er
        // allerede indlæst i hukommelsen af de forskellige hooks — en
        // genindlæsning er den simple, pålidelige måde at få dem til at læse
        // den nyligt genskrevne localStorage igen.
        window.location.reload();
      } catch {
        setBackupFeedback({
          severity: "error",
          message: "Filen kunne ikke importeres — den er ikke en gyldig backup.",
        });
      }
    };

    reader.readAsText(file);
  }

  function getProviderConnectionStatusText(
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

  const googleCalendarStatusText = isGoogleCalendarConnected
    ? "Forbundet"
    : "Forbindelsen mangler";

  const outlookCalendarStatusText = getProviderConnectionStatusText(
    isOutlookCalendarConfigured,
    isOutlookCalendarConnected,
    isAttemptingOutlookSilentReconnect,
    wasOutlookCalendarEverConnected,
    outlookConfigurationError,
  );

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Indstillinger</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Administrer familie, kalendere og appens indstillinger.
        </Typography>
      </Box>

      <Box sx={{ display: "grid", gap: 2.5 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  <FamilyRestroomRounded />
                </Avatar>

                <Box>
                  <Typography variant="h6">Familien</Typography>

                  <Typography variant="body2" color="text.secondary">
                    Administrer familiens profiler
                  </Typography>
                </Box>
              </Box>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddMember}
              >
                Tilføj familiemedlem
              </Button>
            </Box>

            <Box sx={{ display: "grid", gap: 0 }}>
              {members.map((member, index) => {
                const mappedCalendarId = getCalendarIdForOwner(member.id);
                const mappedCalendarLabel = mappedCalendarId
                  ? calendarLabelByRawId.get(mappedCalendarId)
                  : undefined;

                return (
                  <Box key={member.id}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        py: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          flexGrow: 1,
                        }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: member.color,
                            width: 42,
                            height: 42,
                            fontWeight: 700,
                          }}
                        >
                          {getInitials(member.name)}
                        </Avatar>

                        {/* Avataren er venstrejusteret (fast x-position for
                            hele rækken), men selve teksten centreres i sin
                            egen kolonne — de tre linjer (navn/relation/
                            kalender) kan have forskellig bredde, og ser
                            pænere ud centreret om hinanden end venstrestillet. */}
                        <Box sx={{ textAlign: "center" }}>
                          <Typography sx={{ fontWeight: 600 }}>
                            {member.name}
                          </Typography>

                          <Typography variant="body2" color="text.secondary">
                            {member.relation ?? "Delt profil"}
                          </Typography>

                          {mappedCalendarLabel && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.5,
                              }}
                            >
                              <CalendarMonthRounded sx={{ fontSize: 14 }} />
                              {mappedCalendarLabel}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <IconButton
                        aria-label={`Rediger ${member.name}`}
                        onClick={() => handleOpenEditMember(member)}
                      >
                        <ChevronRightRounded />
                      </IconButton>
                    </Box>

                    {index < members.length - 1 && <Divider />}
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        <FamilyMemberDialog
          open={isMemberDialogOpen}
          member={editingMember}
          onClose={() => setIsMemberDialogOpen(false)}
          onSave={handleSaveMember}
          onDelete={deleteMember}
        />

        <InviteCodeCard />

        <ShareLinkCard />

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Avatar sx={{ bgcolor: "secondary.main" }}>
                <CalendarMonthRounded />
              </Avatar>

              <Box>
                <Typography variant="h6">Kalenderforbindelser</Typography>

                <Typography variant="body2" color="text.secondary">
                  Saml familiens eksterne kalendere
                </Typography>
              </Box>
            </Box>

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

            <Divider />

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
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mb: 2.5,
              }}
            >
              <Avatar sx={{ bgcolor: "background.default", color: "text.primary" }}>
                <SaveRounded />
              </Avatar>

              <Box>
                <Typography variant="h6">Data &amp; backup</Typography>

                <Typography variant="body2" color="text.secondary">
                  Dine data ligger kun i denne browser — tag en backup for at
                  undgå at miste dem
                </Typography>
              </Box>
            </Box>

            {backupFeedback && (
              <Alert
                severity={backupFeedback.severity}
                onClose={() => setBackupFeedback(null)}
                sx={{ mb: 2 }}
              >
                {backupFeedback.message}
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<CloudDownloadRounded />}
                onClick={handleExportData}
              >
                Eksportér data
              </Button>

              <Button
                variant="outlined"
                startIcon={<CloudUploadRounded />}
                onClick={() => importFileInputRef.current?.click()}
              >
                Importér data
              </Button>

              <input
                ref={importFileInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={handleImportFileSelected}
              />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Appindstillinger
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", py: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  flexGrow: 1,
                }}
              >
                <NotificationsRounded color="action" />

                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    Notifikationer
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {pushNotificationSubtitle}
                  </Typography>
                </Box>
              </Box>

              <Switch
                checked={pushNotificationStatus === "subscribed"}
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
                  justifyContent: "center",
                  gap: 1.5,
                  flexGrow: 1,
                }}
              >
                <DarkModeRounded color="action" />

                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    Mørkt tema
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Forberedt til en senere sprint
                  </Typography>
                </Box>
              </Box>

              <Switch disabled />
            </Box>

            <Divider />

            <Box sx={{ display: "flex", alignItems: "center", py: 1.5 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  flexGrow: 1,
                }}
              >
                <PersonRounded color="action" />

                <Box sx={{ textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    Min profil
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {currentMember?.name ?? "Vælg din profil"}
                  </Typography>
                </Box>
              </Box>

              <IconButton
                aria-label="Åbn min profil"
                onClick={() => setIsCurrentMemberPickerOpen(true)}
              >
                <ChevronRightRounded />
              </IconButton>
            </Box>

            {currentMemberLinkError && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {currentMemberLinkError}
              </Alert>
            )}

            {user && (
              <>
                <Divider />

                <Box sx={{ display: "flex", alignItems: "center", py: 1.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1.5,
                      flexGrow: 1,
                    }}
                  >
                    <LogoutRounded color="action" />

                    <Box sx={{ textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 600 }}>Log ud</Typography>

                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>

                  <Button color="error" onClick={() => void logout()}>
                    Log ud
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      <CurrentMemberPickerDialog
        open={isCurrentMemberPickerOpen}
        members={members}
        onClose={() => setIsCurrentMemberPickerOpen(false)}
        onSelect={handleSelectCurrentMember}
      />
    </Box>
  );
}

export default SettingsPage;