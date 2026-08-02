import { useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import {
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { acceptInvite, createFamily } from "../../family/familyApi";
import { syncFamilyMembersFromServer } from "../../family/familyMembersSync";

interface FamilySetupOnboardingProps {
  onDone: () => void;
}

type Mode = "choice" | "create" | "join" | "created";

export function FamilySetupOnboarding({ onDone }: FamilySetupOnboardingProps) {
  const [mode, setMode] = useState<Mode>("choice");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    const name = familyName.trim();

    if (!name) {
      setError("Skriv et navn til familien.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await createFamily(name);

    setIsSubmitting(false);

    if (!result.ok || !result.data.members) {
      setError(result.data.error ?? "Kunne ikke oprette familien. Prøv igen.");
      return;
    }

    syncFamilyMembersFromServer(result.data.members);

    // Koden vises kun her — der er endnu ingen "Del invitation"-visning i
    // Indstillinger, så dette er brugerens eneste chance for at se den, før
    // de fortsætter ind i appen.
    if (result.data.inviteCode) {
      setCreatedInviteCode(result.data.inviteCode);
      setMode("created");
      return;
    }

    onDone();
  }

  async function handleJoin() {
    const code = inviteCode.trim();

    if (!code) {
      setError("Skriv den invitationskode, du har fået.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await acceptInvite(code);

    setIsSubmitting(false);

    if (!result.ok || !result.data.members) {
      setError(result.data.error ?? "Ugyldig invitationskode. Prøv igen.");
      return;
    }

    syncFamilyMembersFromServer(result.data.members);
    onDone();
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(createdInviteCode).catch(() => {
      // Udklipsholder kan være utilgængelig (fx uden HTTPS) — koden står
      // stadig synligt på skærmen, så brugeren kan skrive den af manuelt.
    });
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Paper sx={{ p: 3, display: "grid", gap: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {mode === "created" ? "Familien er oprettet!" : "Velkommen!"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === "choice" &&
                "Opret jeres familie, eller tilslut jer med en invitationskode fra et andet familiemedlem."}
              {mode === "create" &&
                "Giv jeres familie et navn. I kan tilføje og navngive medlemmer bagefter under Indstillinger."}
              {mode === "join" &&
                "Indtast den invitationskode, du har fået af et familiemedlem."}
              {mode === "created" &&
                "Del denne kode med resten af familien, så de kan tilslutte sig. Du kan altid finde og lave en ny kode senere under Indstillinger."}
            </Typography>
          </Box>

          {mode === "choice" && (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Button variant="contained" onClick={() => setMode("create")}>
                Opret ny familie
              </Button>
              <Button variant="outlined" onClick={() => setMode("join")}>
                Jeg har en invitationskode
              </Button>
            </Box>
          )}

          {mode === "create" && (
            <Box sx={{ display: "grid", gap: 2 }}>
              <TextField
                label="Familiens navn"
                value={familyName}
                fullWidth
                autoFocus
                error={Boolean(error)}
                helperText={error}
                onChange={(event) => setFamilyName(event.target.value)}
              />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Button onClick={() => setMode("choice")} disabled={isSubmitting}>
                  Tilbage
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCreate}
                  disabled={isSubmitting}
                >
                  Opret familie
                </Button>
              </Box>
            </Box>
          )}

          {mode === "join" && (
            <Box sx={{ display: "grid", gap: 2 }}>
              <TextField
                label="Invitationskode"
                value={inviteCode}
                fullWidth
                autoFocus
                error={Boolean(error)}
                helperText={error}
                onChange={(event) => setInviteCode(event.target.value)}
              />

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Button onClick={() => setMode("choice")} disabled={isSubmitting}>
                  Tilbage
                </Button>
                <Button
                  variant="contained"
                  onClick={handleJoin}
                  disabled={isSubmitting}
                >
                  Tilslut familie
                </Button>
              </Box>
            </Box>
          )}

          {mode === "created" && (
            <Box sx={{ display: "grid", gap: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                }}
              >
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 700, letterSpacing: 2 }}
                >
                  {createdInviteCode}
                </Typography>
                <IconButton
                  aria-label="Kopiér invitationskode"
                  onClick={handleCopyCode}
                >
                  <ContentCopyIcon />
                </IconButton>
              </Box>

              <Button variant="contained" onClick={onDone}>
                Fortsæt til appen
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
