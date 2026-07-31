import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import {
  CalendarMonthRounded,
  ChevronRightRounded,
  CloudDownloadRounded,
  CloudUploadRounded,
  DarkModeRounded,
  FamilyRestroomRounded,
  NotificationsRounded,
  PersonRounded,
  SaveRounded,
  SyncRounded,
} from "@mui/icons-material";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Switch,
  Typography,
} from "@mui/material";

import { FamilyMemberDialog } from "../features/calendar/components/FamilyMemberDialog";
import { GoogleCalendarSelectionDialog } from "../features/calendar/components/GoogleCalendarSelectionDialog";
import type { CalendarOwner } from "../features/calendar/data/calendarOwners";
import { useFamilyMembers } from "../features/calendar/hooks/useFamilyMembers";
import { useGoogleCalendarConnection } from "../features/calendar/hooks/useGoogleCalendarConnection";
import type { CalendarSource } from "../features/calendar/models/calendarProvider";
import {
  createDataBackup,
  restoreDataBackup,
} from "../features/calendar/preferences/dataBackupStorage";
import {
  clearExcludedGoogleCalendars,
  setExcludedGoogleCalendars,
} from "../features/calendar/preferences/googleCalendarExclusionStorage";
import { listAllGoogleCalendars } from "../features/calendar/providers/calendarProviderFactory";

function getInitials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

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
      updateMember(editingMember.id, input);
    } else {
      addMember(input);
    }
  }

  const {
    isConfigured: isGoogleCalendarConfigured,
    isConnected: isGoogleCalendarConnected,
    wasEverConnected: wasGoogleCalendarEverConnected,
    isAttemptingSilentReconnect: isAttemptingGoogleSilentReconnect,
    connect: connectGoogleCalendar,
    disconnect: disconnectGoogleCalendar,
  } = useGoogleCalendarConnection();

  const [isGoogleCalendarBusy, setIsGoogleCalendarBusy] = useState(false);

  const [isCalendarSelectionOpen, setIsCalendarSelectionOpen] =
    useState(false);
  const [googleCalendarsForSelection, setGoogleCalendarsForSelection] =
    useState<CalendarSource[]>([]);
  const [isFetchingGoogleCalendars, setIsFetchingGoogleCalendars] =
    useState(false);
  const [fetchGoogleCalendarsError, setFetchGoogleCalendarsError] = useState<
    string | null
  >(null);

  async function fetchGoogleCalendarsForSelection(): Promise<void> {
    setIsFetchingGoogleCalendars(true);
    setFetchGoogleCalendarsError(null);

    try {
      const sources = await listAllGoogleCalendars();

      setGoogleCalendarsForSelection(sources);
    } catch {
      setFetchGoogleCalendarsError(
        "Dine Google-kalendere kunne ikke hentes.",
      );
    } finally {
      setIsFetchingGoogleCalendars(false);
    }
  }

  function openCalendarSelectionDialog() {
    setIsCalendarSelectionOpen(true);
    void fetchGoogleCalendarsForSelection();
  }

  async function handleToggleGoogleCalendar(): Promise<void> {
    if (isGoogleCalendarConnected) {
      disconnectGoogleCalendar();

      // En (gen)forbindelse — evt. med en anden konto — bør starte forfra
      // med alle kalendere til rådighed, ikke arve en tidligere kontos
      // fravalg.
      clearExcludedGoogleCalendars();

      return;
    }

    setIsGoogleCalendarBusy(true);
    try {
      await connectGoogleCalendar();

      // Lige efter en vellykket, interaktiv forbindelse — ikke ved Sprint
      // 14's stille genoprettelse ved appstart, som slet ikke rører denne
      // handler — spørger vi, hvilke af de fundne kalendere der skal vises.
      openCalendarSelectionDialog();
    } catch {
      // Fejlen undlader blot at markere som forbundet — Kalender-siden
      // viser fortsat "ikke forbundet", som er tilstrækkelig feedback.
    } finally {
      setIsGoogleCalendarBusy(false);
    }
  }

  function handleConfirmCalendarSelection(
    excludedGoogleCalendarIds: string[],
  ) {
    setExcludedGoogleCalendars(excludedGoogleCalendarIds);
    setIsCalendarSelectionOpen(false);
  }

  function handleSkipCalendarSelection() {
    setIsCalendarSelectionOpen(false);
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

  const googleCalendarStatusText = !isGoogleCalendarConfigured
    ? "Ikke konfigureret"
    : isGoogleCalendarConnected
      ? "Forbundet"
      : isAttemptingGoogleSilentReconnect
        ? "Genopretter forbindelsen..."
        : wasGoogleCalendarEverConnected
          ? "Ikke forbundet i denne session"
          : "Ikke forbundet endnu";

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
              {members.map((member, index) => (
                <Box key={member.id}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      py: 1.5,
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

                    <Box sx={{ flexGrow: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {member.name}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {member.relation ?? "Delt profil"}
                      </Typography>
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
              ))}
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

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <IconButton
                aria-label="Administrer Google-kalendere"
                disabled={!isGoogleCalendarConnected}
                onClick={openCalendarSelectionDialog}
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
                  Google Calendar
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {googleCalendarStatusText}
                </Typography>
              </Box>

              <IconButton
                aria-label={
                  isGoogleCalendarConnected
                    ? "Afbryd Google Calendar"
                    : "Forbind Google Calendar"
                }
                disabled={
                  !isGoogleCalendarConfigured ||
                  isGoogleCalendarBusy ||
                  isAttemptingGoogleSilentReconnect
                }
                onClick={() => {
                  void handleToggleGoogleCalendar();
                }}
              >
                {isGoogleCalendarBusy || isAttemptingGoogleSilentReconnect ? (
                  <CircularProgress size={20} />
                ) : (
                  <ChevronRightRounded />
                )}
              </IconButton>
            </Box>
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

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <NotificationsRounded color="action" />

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Notifikationer
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Påmindelser om aftaler og opgaver
                </Typography>
              </Box>

              <Switch defaultChecked />
            </Box>

            <Divider />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <DarkModeRounded color="action" />

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Mørkt tema
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Forberedt til en senere sprint
                </Typography>
              </Box>

              <Switch disabled />
            </Box>

            <Divider />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
              }}
            >
              <PersonRounded color="action" />

              <Box sx={{ flexGrow: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  Min profil
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Nicolaj
                </Typography>
              </Box>

              <IconButton aria-label="Åbn min profil">
                <ChevronRightRounded />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <GoogleCalendarSelectionDialog
        open={isCalendarSelectionOpen}
        calendars={googleCalendarsForSelection}
        isLoading={isFetchingGoogleCalendars}
        error={fetchGoogleCalendarsError}
        onRetry={() => {
          void fetchGoogleCalendarsForSelection();
        }}
        onSkip={handleSkipCalendarSelection}
        onConfirm={handleConfirmCalendarSelection}
      />
    </Box>
  );
}

export default SettingsPage;