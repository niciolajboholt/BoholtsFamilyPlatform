import type { ChangeEvent } from "react";
import { useRef, useState } from "react";

import {
  ChevronRightRounded,
  CloudDownloadRounded,
  CloudUploadRounded,
  LogoutRounded,
  PersonRounded,
  SaveRounded,
} from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Typography } from "@mui/material";

import { useSession } from "../../auth/hooks/useSession";
import { CurrentMemberPickerDialog } from "../../calendar/components/CurrentMemberPickerDialog";
import { useCurrentMember } from "../../calendar/hooks/useCurrentMember";
import { useFamilyMembers } from "../../calendar/hooks/useFamilyMembers";
import { createDataBackup, restoreDataBackup } from "../../calendar/preferences/dataBackupStorage";
import { SettingsLinkRow, SettingsSectionHeader } from "./SettingsPrimitives";

export function AccountDataSection() {
  const { members } = useFamilyMembers();
  const { currentMember, setCurrentMemberId } = useCurrentMember();
  const [isCurrentMemberPickerOpen, setIsCurrentMemberPickerOpen] = useState(false);
  const [currentMemberLinkError, setCurrentMemberLinkError] = useState<string | null>(null);

  function handleSelectCurrentMember(memberId: string): void {
    setCurrentMemberLinkError(null);
    setCurrentMemberId(memberId).then((error) => {
      if (error) {
        setCurrentMemberLinkError(error);
      }
    });
  }

  const { user, logout } = useSession();

  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
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

  function handleImportFileSelected(changeEvent: ChangeEvent<HTMLInputElement>) {
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

  return (
    <>
      <SettingsSectionHeader>Konto og data</SettingsSectionHeader>

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
              <PersonRounded color="action" />

              <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>Min profil</Typography>

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
                    gap: 1.5,
                    flexGrow: 1,
                  }}
                >
                  <LogoutRounded color="action" />

                  <Box sx={{ textAlign: "left", flexGrow: 1, minWidth: 0 }}>
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

          <Divider />

          <SettingsLinkRow
            icon={<SaveRounded color="action" />}
            title="Data & backup"
            subtitle="Eksportér eller importér"
            onClick={() => setIsBackupDialogOpen(true)}
          />
        </CardContent>
      </Card>

      <Dialog open={isBackupDialogOpen} onClose={() => setIsBackupDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Data &amp; backup</DialogTitle>

        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Backupfilen indeholder lokale indstillinger og kalenderdata,
            som ligger på denne enhed. Familie, opgaver og indkøbslister
            gemmes sikkert i appens database.
          </Typography>

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
            <Button variant="outlined" startIcon={<CloudDownloadRounded />} onClick={handleExportData}>
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
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsBackupDialogOpen(false)}>Luk</Button>
        </DialogActions>
      </Dialog>

      <CurrentMemberPickerDialog
        open={isCurrentMemberPickerOpen}
        members={members}
        onClose={() => setIsCurrentMemberPickerOpen(false)}
        onSelect={handleSelectCurrentMember}
      />
    </>
  );
}
