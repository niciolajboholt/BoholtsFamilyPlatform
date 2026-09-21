import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  ChevronRightRounded,
  CloudDownloadRounded,
  CloudUploadRounded,
  DeleteForeverRounded,
  LogoutRounded,
  PersonRounded,
  SaveRounded,
} from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, TextField, Typography } from "@mui/material";

import { useSession } from "../../auth/hooks/useSession";
import { CurrentMemberPickerDialog } from "../../calendar/components/CurrentMemberPickerDialog";
import { useCurrentMember } from "../../calendar/hooks/useCurrentMember";
import { useFamilyId } from "../../calendar/hooks/useFamilyId";
import { useFamilyMembers } from "../../calendar/hooks/useFamilyMembers";
import { createDataBackup, restoreDataBackup } from "../../calendar/preferences/dataBackupStorage";
import type { FamilyRole } from "../../family/familyApi";
import { getCachedFamily } from "../../family/familySessionCache";
import {
  beginReauth,
  cancelAccountDeletion,
  cancelFamilyDeletion,
  downloadFamilyExport,
  getAccountDeletionPreview,
  getFamilyDeletionPreview,
  requestAccountDeletion,
  requestFamilyDeletion,
  type AccountDeletionPreviewMembership,
  type FamilyDeletionPreview,
} from "../deletionApi";
import { SettingsLinkRow, SettingsSectionHeader } from "./SettingsPrimitives";

type DeletionStep = "review" | "reauth" | "confirm";

// Sprint 50: hvilken af de to sletningsdialoger (konto/familie) der skal
// genåbnes direkte på bekræftelses-trinnet, når brugeren lander tilbage
// her efter en frisk OAuth-gen-autentificering (se auth.ts's
// /reauth/google og /reauth/microsoft — returnTo peger tilbage hertil med
// disse forespørgselsparametre, og callbacket tilføjer "&reauth=success").
function readPendingDeletionReturn(): "account" | "family" | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reauth") !== "success") return null;
  if (params.get("accountDeletion") === "confirm") return "account";
  if (params.get("familyDeletion") === "confirm") return "family";
  return null;
}

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
  const familyId = useFamilyId();
  const [familyRole, setFamilyRole] = useState<FamilyRole | null>(null);

  useEffect(() => {
    let isCancelled = false;
    getCachedFamily().then((result) => {
      if (!isCancelled && result.ok) {
        setFamilyRole(result.data.role ?? null);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  // ---------------------------------------------------------------------
  // Sprint 50: kontosletning
  // ---------------------------------------------------------------------
  // Lazy useState-initializere (ikke en effekt) læser URL'en ved første
  // render, så dialogen åbner direkte på bekræftelses-trinnet efter en
  // gen-autentificerings-roundtrip, uden det ekstra render en
  // effekt-baseret setState ville give.
  const [isAccountDeletionOpen, setIsAccountDeletionOpen] = useState(
    () => readPendingDeletionReturn() === "account",
  );
  const [accountDeletionStep, setAccountDeletionStep] = useState<DeletionStep>(() =>
    readPendingDeletionReturn() === "account" ? "confirm" : "review",
  );
  const [accountDeletionPreview, setAccountDeletionPreview] = useState<
    AccountDeletionPreviewMembership[] | null
  >(null);
  const [accountDeletionError, setAccountDeletionError] = useState<string | null>(null);
  const [accountDeletionBusy, setAccountDeletionBusy] = useState(false);
  const [accountDeletionConfirmation, setAccountDeletionConfirmation] = useState("");
  const [cancelDeletionFeedback, setCancelDeletionFeedback] = useState<string | null>(null);

  // Sprint 50: familiesletning (kun ejer)
  const [isFamilyDeletionOpen, setIsFamilyDeletionOpen] = useState(
    () => readPendingDeletionReturn() === "family",
  );
  const [familyDeletionStep, setFamilyDeletionStep] = useState<DeletionStep>(() =>
    readPendingDeletionReturn() === "family" ? "confirm" : "review",
  );
  const [familyDeletionPreview, setFamilyDeletionPreview] = useState<FamilyDeletionPreview | null>(null);
  const [familyDeletionError, setFamilyDeletionError] = useState<string | null>(null);
  const [familyDeletionBusy, setFamilyDeletionBusy] = useState(false);
  const [familyDeletionConfirmation, setFamilyDeletionConfirmation] = useState("");

  useEffect(() => {
    // Fjerner kun de midlertidige OAuth-returparametre med det samme, så
    // et genindlæst faneblad ikke ved et uheld genåbner bekræftelses-
    // trinnet igen — selve state'et er allerede sat af useState-
    // initializerne ovenfor. "tab" (og enhver anden fremtidig parameter)
    // bevares bevidst — reviewfund: en tidligere udgave ryddede HELE
    // forespørgselsstrengen (url.search = ""), hvilket også fjernede
    // "?tab=account" og sendte brugeren tilbage til standardfanen
    // ("Familie") midt i sletningsflowet.
    if (readPendingDeletionReturn()) {
      const url = new URL(window.location.href);
      url.searchParams.delete("accountDeletion");
      url.searchParams.delete("familyDeletion");
      url.searchParams.delete("reauth");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // OAuth-roundtrippet genindlæser siden, så preview-state fra første trin
  // findes ikke længere. Hent konsekvensen igen på confirm-trinnet, så
  // ejerskabsblokering og familiens præcise navn stadig vises korrekt.
  useEffect(() => {
    if (!isAccountDeletionOpen || accountDeletionStep !== "confirm" || accountDeletionPreview) return;

    void getAccountDeletionPreview().then((result) => {
      if (result.ok) setAccountDeletionPreview(result.data.memberships);
    });
  }, [accountDeletionPreview, accountDeletionStep, isAccountDeletionOpen]);

  useEffect(() => {
    if (
      !familyId ||
      !isFamilyDeletionOpen ||
      familyDeletionStep !== "confirm" ||
      familyDeletionPreview
    ) {
      return;
    }

    void getFamilyDeletionPreview(familyId).then((result) => {
      if (result.ok) setFamilyDeletionPreview(result.data);
    });
  }, [familyDeletionPreview, familyDeletionStep, familyId, isFamilyDeletionOpen]);

  function openAccountDeletionDialog(): void {
    setAccountDeletionError(null);
    setAccountDeletionConfirmation("");
    setAccountDeletionStep("review");
    setIsAccountDeletionOpen(true);
    getAccountDeletionPreview().then((result) => {
      if (result.ok) {
        setAccountDeletionPreview(result.data.memberships);
      }
    });
  }

  async function handleConfirmAccountDeletion(): Promise<void> {
    setAccountDeletionBusy(true);
    setAccountDeletionError(null);

    const result = await requestAccountDeletion(accountDeletionConfirmation);

    setAccountDeletionBusy(false);

    if (!result.ok) {
      if (result.status === 403) {
        setAccountDeletionError("Bekræftelsen er udløbet. Bekræft din identitet igen.");
        setAccountDeletionStep("reauth");
      } else {
        setAccountDeletionError(result.data.error ?? "Sletningen kunne ikke gennemføres. Prøv igen.");
        if (result.data.code === "ownership_transfer_required") {
          setAccountDeletionStep("review");
          void getAccountDeletionPreview().then((previewResult) => {
            if (previewResult.ok) setAccountDeletionPreview(previewResult.data.memberships);
          });
        }
      }
      return;
    }

    // Sessionen er slettet af selve anmodningen (se
    // accountDeletion.ts's requestAccountDeletion) — brugeren er allerede
    // logget ud på serveren, en fuld navigation viser det med det samme.
    window.location.href = "/";
  }

  async function handleCancelAccountDeletion(): Promise<void> {
    const result = await cancelAccountDeletion();
    setCancelDeletionFeedback(
      result.ok
        ? "Sletningen er fortrudt. Din konto er fuldt genoprettet."
        : (result.data.error ?? "Ingen igangværende sletningsanmodning fundet."),
    );
  }

  function openFamilyDeletionDialog(): void {
    if (!familyId) return;
    setFamilyDeletionError(null);
    setFamilyDeletionConfirmation("");
    setFamilyDeletionStep("review");
    setIsFamilyDeletionOpen(true);
    getFamilyDeletionPreview(familyId).then((result) => {
      if (result.ok) {
        setFamilyDeletionPreview(result.data);
      }
    });
  }

  async function handleConfirmFamilyDeletion(): Promise<void> {
    if (!familyId) return;
    setFamilyDeletionBusy(true);
    setFamilyDeletionError(null);

    const result = await requestFamilyDeletion(familyId, familyDeletionConfirmation);

    setFamilyDeletionBusy(false);

    if (!result.ok) {
      if (result.status === 403) {
        setFamilyDeletionError("Bekræftelsen er udløbet. Bekræft din identitet igen.");
        setFamilyDeletionStep("reauth");
      } else {
        setFamilyDeletionError(result.data.error ?? "Sletningen kunne ikke gennemføres. Prøv igen.");
      }
      return;
    }

    window.location.href = "/";
  }

  async function handleCancelFamilyDeletion(): Promise<void> {
    if (!familyId) return;
    const result = await cancelFamilyDeletion(familyId);
    setCancelDeletionFeedback(
      result.ok
        ? "Familiens sletning er fortrudt. Alt er fuldt genoprettet."
        : (result.data.error ?? "Ingen igangværende sletningsanmodning fundet."),
    );
  }

  async function handleDownloadServerExport(): Promise<void> {
    if (!familyId) return;
    const result = await downloadFamilyExport(familyId);
    setExportFeedback(
      result.ok
        ? { severity: "success", message: "Familiedata downloadet." }
        : { severity: "error", message: result.error ?? "Eksporten kunne ikke hentes." },
    );
  }

  function handleExportData() {
    const backup = createDataBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `hjemmecentralen-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

  const ownedFamilies = accountDeletionPreview?.filter((membership) => membership.role === "owner") ?? [];

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

          {user && (
            <>
              <Divider />

              <SettingsLinkRow
                icon={<DeleteForeverRounded color="error" />}
                title="Slet min konto"
                subtitle="30 dages fortrydelsesperiode"
                onClick={openAccountDeletionDialog}
              />
            </>
          )}

          {familyId && familyRole === "owner" && (
            <>
              <Divider />

              <SettingsLinkRow
                icon={<DeleteForeverRounded color="error" />}
                title="Slet hele familien"
                subtitle="Kun for ejeren — 30 dages fortrydelsesperiode"
                onClick={openFamilyDeletionDialog}
              />
            </>
          )}

          {user && (
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", pt: 1.5 }}>
              <Button size="small" onClick={() => void handleCancelAccountDeletion()}>
                Fortryd tidligere kontosletning
              </Button>

              {familyId && familyRole === "owner" && (
                <Button size="small" onClick={() => void handleCancelFamilyDeletion()}>
                  Fortryd tidligere familiesletning
                </Button>
              )}
            </Box>
          )}

          {cancelDeletionFeedback && (
            <Alert
              severity="info"
              onClose={() => setCancelDeletionFeedback(null)}
              sx={{ mt: 1.5 }}
            >
              {cancelDeletionFeedback}
            </Alert>
          )}
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

          {familyId && (
            <>
              <Divider sx={{ my: 2 }} />

              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Familiedata (server)</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
                {familyRole === "owner"
                  ? "Som ejer får du en fuld kopi af familiens data, inkl. øvrige medlemmers navn og e-mail."
                  : "Du får en kopi af din egen konto samt din kalender og dine opgaver."}
              </Typography>

              {exportFeedback && (
                <Alert
                  severity={exportFeedback.severity}
                  onClose={() => setExportFeedback(null)}
                  sx={{ mb: 1.5 }}
                >
                  {exportFeedback.message}
                </Alert>
              )}

              <Button
                variant="outlined"
                startIcon={<CloudDownloadRounded />}
                onClick={() => void handleDownloadServerExport()}
              >
                Download familiedata
              </Button>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsBackupDialogOpen(false)}>Luk</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isAccountDeletionOpen}
        onClose={() => (accountDeletionBusy ? undefined : setIsAccountDeletionOpen(false))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Slet min konto</DialogTitle>

        <DialogContent>
          {accountDeletionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {accountDeletionError}
            </Alert>
          )}

          {accountDeletionStep === "review" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Din konto slettes efter 30 dage. Indtil da kan du fortryde
                ved at logge ind igen. Opgaver og udgifter, du har
                oprettet, bliver ikke slettet — de vises i stedet som
                oprettet af &quot;Tidligere medlem&quot;.
              </Typography>

              {accountDeletionPreview && accountDeletionPreview.length > 0 && (
                <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                  Du forlader samtidig{" "}
                  {accountDeletionPreview.map((membership) => membership.familyName).join(", ")}.
                </Typography>
              )}

              {ownedFamilies.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Du ejer {ownedFamilies.map((family) => family.familyName).join(", ")}. Overdrag først
                  ejerskabet til et andet medlem. Er du eneste bruger, skal du i stedet slette hele
                  familien først. En aktiv familie må ikke efterlades uden ejer.
                </Alert>
              )}
            </>
          )}

          {accountDeletionStep === "reauth" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Bekræft din identitet igen, før kontoen kan slettes.
              </Typography>

              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  onClick={() => beginReauth("google", "/settings?tab=account&accountDeletion=confirm")}
                >
                  Bekræft med Google
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => beginReauth("microsoft", "/settings?tab=account&accountDeletion=confirm")}
                >
                  Bekræft med Microsoft
                </Button>
              </Box>
            </>
          )}

          {accountDeletionStep === "confirm" && (
            <>
              {ownedFamilies.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Du ejer stadig en aktiv familie. Overdrag ejerskabet, eller slet familien først.
                </Alert>
              )}
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Din identitet er bekræftet. Skriv <strong>SLET MIN KONTO</strong> for at bekræfte
                permanent sletning efter fortrydelsesperioden.
              </Typography>
              <TextField
                autoComplete="off"
                fullWidth
                label="Bekræftelsestekst"
                value={accountDeletionConfirmation}
                onChange={(event) => setAccountDeletionConfirmation(event.target.value)}
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsAccountDeletionOpen(false)} disabled={accountDeletionBusy}>
            Annullér
          </Button>

          {accountDeletionStep === "review" && (
            <Button
              variant="contained"
              color="error"
              disabled={accountDeletionPreview === null || ownedFamilies.length > 0}
              onClick={() => setAccountDeletionStep("reauth")}
            >
              Fortsæt
            </Button>
          )}

          {accountDeletionStep === "confirm" && (
            <Button
              variant="contained"
              color="error"
              disabled={
                accountDeletionBusy ||
                ownedFamilies.length > 0 ||
                accountDeletionConfirmation !== "SLET MIN KONTO"
              }
              onClick={() => void handleConfirmAccountDeletion()}
            >
              Slet min konto
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={isFamilyDeletionOpen}
        onClose={() => (familyDeletionBusy ? undefined : setIsFamilyDeletionOpen(false))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Slet hele familien</DialogTitle>

        <DialogContent>
          {familyDeletionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {familyDeletionError}
            </Alert>
          )}

          {familyDeletionStep === "review" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                ALT familiens data slettes permanent efter 30 dage — alle
                medlemmer, opgaver, indkøbslister, kalenderforbindelser og
                mere. Familien forsvinder for alle medlemmer med det
                samme. Du kan fortryde inden for 30 dage.
              </Typography>

              {familyDeletionPreview && (
                <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                  {familyDeletionPreview.memberCount} medlemmer,{" "}
                  {familyDeletionPreview.taskCount} opgaver,{" "}
                  {familyDeletionPreview.shoppingListCount} indkøbslister.
                </Typography>
              )}
            </>
          )}

          {familyDeletionStep === "reauth" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Bekræft din identitet igen, før hele familien kan slettes.
              </Typography>

              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  onClick={() => beginReauth("google", "/settings?tab=account&familyDeletion=confirm")}
                >
                  Bekræft med Google
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => beginReauth("microsoft", "/settings?tab=account&familyDeletion=confirm")}
                >
                  Bekræft med Microsoft
                </Button>
              </Box>
            </>
          )}

          {familyDeletionStep === "confirm" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Din identitet er bekræftet. Skriv familiens navn præcist —
                <strong> {familyDeletionPreview?.familyName ?? "familiens navn"}</strong> — for at
                bekræfte permanent sletning efter fortrydelsesperioden.
              </Typography>
              <TextField
                autoComplete="off"
                fullWidth
                label="Familiens navn"
                value={familyDeletionConfirmation}
                onChange={(event) => setFamilyDeletionConfirmation(event.target.value)}
              />
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setIsFamilyDeletionOpen(false)} disabled={familyDeletionBusy}>
            Annullér
          </Button>

          {familyDeletionStep === "review" && (
            <Button variant="contained" color="error" onClick={() => setFamilyDeletionStep("reauth")}>
              Fortsæt
            </Button>
          )}

          {familyDeletionStep === "confirm" && (
            <Button
              variant="contained"
              color="error"
              disabled={
                familyDeletionBusy ||
                !familyDeletionPreview?.familyName ||
                familyDeletionConfirmation !== familyDeletionPreview.familyName
              }
              onClick={() => void handleConfirmFamilyDeletion()}
            >
              Slet hele familien
            </Button>
          )}
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
