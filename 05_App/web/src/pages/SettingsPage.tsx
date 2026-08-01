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
import type {
  CalendarMemberAssignment,
  CalendarNameOverride,
} from "../features/calendar/components/CalendarSelectionDialog";
import { CalendarSelectionDialog } from "../features/calendar/components/CalendarSelectionDialog";
import { CurrentMemberPickerDialog } from "../features/calendar/components/CurrentMemberPickerDialog";
import { ProviderConnectionRow } from "../features/calendar/components/ProviderConnectionRow";
import type { CalendarOwner } from "../features/calendar/data/calendarOwners";
import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { useFamilyMembers } from "../features/calendar/hooks/useFamilyMembers";
import { useGoogleCalendarConnection } from "../features/calendar/hooks/useGoogleCalendarConnection";
import { useOutlookCalendarConnection } from "../features/calendar/hooks/useOutlookCalendarConnection";
import type { CalendarSource } from "../features/calendar/models/calendarProvider";
import {
  clearCalendarMemberMappings,
  getOwnerIdForGoogleCalendar,
  setCalendarMemberMapping,
} from "../features/calendar/preferences/calendarMemberMappingStorage";
import {
  createDataBackup,
  restoreDataBackup,
} from "../features/calendar/preferences/dataBackupStorage";
import {
  clearExcludedGoogleCalendars,
  getExcludedGoogleCalendarIds,
  setExcludedGoogleCalendars,
} from "../features/calendar/preferences/googleCalendarExclusionStorage";
import {
  clearExcludedOutlookCalendars,
  getExcludedOutlookCalendarIds,
  setExcludedOutlookCalendars,
} from "../features/calendar/providers/outlook/outlookCalendarExclusionStorage";
import {
  listAllGoogleCalendars,
  listAllOutlookCalendars,
} from "../features/calendar/providers/calendarProviderFactory";
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

  const {
    isConfigured: isOutlookCalendarConfigured,
    isConnected: isOutlookCalendarConnected,
    wasEverConnected: wasOutlookCalendarEverConnected,
    isAttemptingSilentReconnect: isAttemptingOutlookSilentReconnect,
    redirectDiagnostic: outlookRedirectDiagnostic,
    connect: connectOutlookCalendar,
    disconnect: disconnectOutlookCalendar,
  } = useOutlookCalendarConnection();

  const [isGoogleCalendarBusy, setIsGoogleCalendarBusy] = useState(false);
  const [isOutlookCalendarBusy, setIsOutlookCalendarBusy] = useState(false);

  const [activeSelectionProvider, setActiveSelectionProvider] = useState<
    "google" | "outlook" | null
  >(null);
  const [calendarsForSelection, setCalendarsForSelection] = useState<
    CalendarSource[]
  >([]);
  const [isFetchingCalendarsForSelection, setIsFetchingCalendarsForSelection] =
    useState(false);
  const [fetchCalendarsForSelectionError, setFetchCalendarsForSelectionError] =
    useState<string | null>(null);

  async function fetchCalendarsForSelection(
    provider: "google" | "outlook",
  ): Promise<void> {
    setIsFetchingCalendarsForSelection(true);
    setFetchCalendarsForSelectionError(null);

    try {
      const sources =
        provider === "google"
          ? await listAllGoogleCalendars()
          : await listAllOutlookCalendars();

      setCalendarsForSelection(sources);
    } catch {
      setFetchCalendarsForSelectionError(
        `Dine ${provider === "google" ? "Google" : "Outlook"}-kalendere kunne ikke hentes.`,
      );
    } finally {
      setIsFetchingCalendarsForSelection(false);
    }
  }

  function openCalendarSelectionDialog(provider: "google" | "outlook") {
    setActiveSelectionProvider(provider);
    void fetchCalendarsForSelection(provider);
  }

  async function handleToggleGoogleCalendar(): Promise<void> {
    if (isGoogleCalendarConnected) {
      disconnectGoogleCalendar();

      // En (gen)forbindelse — evt. med en anden konto — bør starte forfra
      // med alle kalendere til rådighed, ikke arve en tidligere kontos
      // fravalg eller familie-tildelinger.
      clearExcludedGoogleCalendars();
      clearCalendarMemberMappings();

      return;
    }

    setIsGoogleCalendarBusy(true);
    try {
      await connectGoogleCalendar();

      // Lige efter en vellykket, interaktiv forbindelse — ikke ved Sprint
      // 14's stille genoprettelse ved appstart, som slet ikke rører denne
      // handler — spørger vi, hvilke af de fundne kalendere der skal vises.
      openCalendarSelectionDialog("google");
    } catch {
      // Fejlen undlader blot at markere som forbundet — Kalender-siden
      // viser fortsat "ikke forbundet", som er tilstrækkelig feedback.
    } finally {
      setIsGoogleCalendarBusy(false);
    }
  }

  async function handleToggleOutlookCalendar(): Promise<void> {
    if (isOutlookCalendarConnected) {
      disconnectOutlookCalendar();
      clearExcludedOutlookCalendars();
      clearCalendarMemberMappings();

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

  function handleConfirmCalendarSelection(
    excludedCalendarIds: string[],
    memberAssignments: CalendarMemberAssignment[],
    nameOverrides: CalendarNameOverride[],
  ) {
    if (activeSelectionProvider === "google") {
      setExcludedGoogleCalendars(excludedCalendarIds);
    } else if (activeSelectionProvider === "outlook") {
      setExcludedOutlookCalendars(excludedCalendarIds);
    }

    for (const assignment of memberAssignments) {
      setCalendarMemberMapping(assignment.calendarId, assignment.ownerId);
    }

    for (const override of nameOverrides) {
      const currentMember = members.find(
        (member) => member.id === override.ownerId,
      );
      if (!currentMember) continue;

      updateMember(override.ownerId, {
        name: override.newName,
        relation: currentMember.relation,
        color: currentMember.color,
        isPlaceholderName: false,
      });
    }

    setActiveSelectionProvider(null);
  }

  function handleSkipCalendarSelection() {
    setActiveSelectionProvider(null);
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
  ): string {
    if (!isConfigured) return "Ikke konfigureret";
    if (isConnected) return "Forbundet";
    if (isAttemptingSilentReconnect) return "Genopretter forbindelsen...";
    return wasEverConnected ? "Ikke forbundet i denne session" : "Ikke forbundet endnu";
  }

  const googleCalendarStatusText = getProviderConnectionStatusText(
    isGoogleCalendarConfigured,
    isGoogleCalendarConnected,
    isAttemptingGoogleSilentReconnect,
    wasGoogleCalendarEverConnected,
  );

  const outlookCalendarStatusText = getProviderConnectionStatusText(
    isOutlookCalendarConfigured,
    isOutlookCalendarConnected,
    isAttemptingOutlookSilentReconnect,
    wasOutlookCalendarEverConnected,
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

            <ProviderConnectionRow
              label="Google Calendar"
              statusText={googleCalendarStatusText}
              isConnected={isGoogleCalendarConnected}
              isConfigured={isGoogleCalendarConfigured}
              isBusy={isGoogleCalendarBusy}
              isAttemptingSilentReconnect={isAttemptingGoogleSilentReconnect}
              onManageCalendars={() => openCalendarSelectionDialog("google")}
              onToggleConnection={() => {
                void handleToggleGoogleCalendar();
              }}
            />

            <Divider />

            <ProviderConnectionRow
              label="Outlook Calendar"
              statusText={outlookCalendarStatusText}
              isConnected={isOutlookCalendarConnected}
              isConfigured={isOutlookCalendarConfigured}
              isBusy={isOutlookCalendarBusy}
              isAttemptingSilentReconnect={isAttemptingOutlookSilentReconnect}
              onManageCalendars={() => openCalendarSelectionDialog("outlook")}
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
                  {currentMember?.name ?? "Vælg din profil"}
                </Typography>
              </Box>

              <IconButton
                aria-label="Åbn min profil"
                onClick={() => setIsCurrentMemberPickerOpen(true)}
              >
                <ChevronRightRounded />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <CurrentMemberPickerDialog
        open={isCurrentMemberPickerOpen}
        members={members}
        onClose={() => setIsCurrentMemberPickerOpen(false)}
        onSelect={setCurrentMemberId}
      />

      <CalendarSelectionDialog
        open={activeSelectionProvider !== null}
        providerLabel={activeSelectionProvider === "outlook" ? "Outlook" : "Google"}
        calendars={calendarsForSelection}
        isLoading={isFetchingCalendarsForSelection}
        error={fetchCalendarsForSelectionError}
        getExcludedIds={() =>
          activeSelectionProvider === "outlook"
            ? getExcludedOutlookCalendarIds()
            : getExcludedGoogleCalendarIds()
        }
        getOwnerId={getOwnerIdForGoogleCalendar}
        onRetry={() => {
          if (activeSelectionProvider) void fetchCalendarsForSelection(activeSelectionProvider);
        }}
        onSkip={handleSkipCalendarSelection}
        onConfirm={handleConfirmCalendarSelection}
      />
    </Box>
  );
}

export default SettingsPage;