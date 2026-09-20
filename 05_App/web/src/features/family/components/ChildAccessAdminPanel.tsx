import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import { ChildAccessQrCode } from "./ChildAccessQrCode";
import {
  deleteChildMessage,
  getChildMessagesForMember,
  sendChildMessage,
  type ChildMessageDto,
  type FamilyMemberDto,
} from "../familyApi";
import { useChildAccessAdmin } from "../hooks/useChildAccessAdmin";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Aldrig";
  }

  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export interface ChildAccessAdminPanelProps {
  familyId: string;
  member: FamilyMemberDto;
}

// Sprint 56 (opfølgning på 55_Sprint55_Barn_Adgang_UX_Plan.md, Fase A):
// selve administrations-UI'et, udtrukket af den tidligere ChildAccessDialog.tsx
// (Indstillinger → Familie → "Børneadgang"), så det nu kan genbruges direkte
// på "Mit i dag" for det valgte medlem — samme logik (useChildAccessAdmin),
// bare uden Accordion-listen over alle medlemmer, da Mit i dag allerede har
// sin egen medlemsvælger.
export function ChildAccessAdminPanel({ familyId, member }: ChildAccessAdminPanelProps) {
  const admin = useChildAccessAdmin(familyId, member.id);
  const [newPin, setNewPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const childAccessUrl = admin.token ? `${window.location.origin}/barn/${admin.token}` : null;

  function handleCopyLink() {
    if (!childAccessUrl) {
      return;
    }

    navigator.clipboard?.writeText(childAccessUrl).catch(() => {
      // Udklipsholder kan være utilgængelig — linket kan stadig kopieres manuelt.
    });
  }

  async function handleSetPin() {
    if (!/^\d{4}$/.test(newPin)) {
      setPinError("Koden skal være præcis 4 cifre.");
      return;
    }

    setPinError(null);
    const ok = await admin.setPin(newPin);

    if (ok) {
      setNewPin("");
    }
  }

  if (admin.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={24} aria-label="Indlæser børneadgang" />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {admin.error && <Alert severity="error">{admin.error}</Alert>}

      {!admin.token ? (
        <Button variant="outlined" disabled={admin.isBusy} onClick={() => void admin.generateOrRotateToken()}>
          Opret børneadgangs-link
        </Button>
      ) : (
        <>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Link
            </Typography>

            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Linket og koden er en adgangsoplysning til {member.name}s data — del dem kun med{" "}
              {member.name} selv, samme som en adgangskode.
            </Alert>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1.25,
                borderRadius: 2,
                bgcolor: "action.hover",
              }}
            >
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {childAccessUrl}
              </Typography>
              <IconButton aria-label="Kopiér børneadgangs-link" size="small" onClick={handleCopyLink}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>

            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => setShowQr((current) => !current)}
              aria-expanded={showQr}
            >
              {showQr ? "Skjul QR-kode" : "Vis QR-kode"}
            </Button>

            {showQr && childAccessUrl && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <ChildAccessQrCode value={childAccessUrl} />
              </Box>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Kode
            </Typography>

            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <TextField
                label={admin.hasPin ? "Ny kode (4 cifre)" : "Kode (4 cifre)"}
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                error={Boolean(pinError)}
                helperText={pinError}
                size="small"
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                size="small"
                disabled={admin.isBusy}
                onClick={() => void handleSetPin()}
                sx={{ mt: 0.25 }}
              >
                {admin.hasPin ? "Skift kode" : "Sæt kode"}
              </Button>
            </Box>

            {admin.hasPin && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Sat {formatTimestamp(admin.pinSetAt)}
              </Typography>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Aktive enheder ({admin.sessions.length})
            </Typography>

            {admin.sessions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ingen enheder er logget ind lige nu.
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gap: 0.5, mb: 1 }}>
                {admin.sessions.map((session) => (
                  <Box
                    key={session.id}
                    sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Logget ind {formatTimestamp(session.createdAt)} · senest aktiv{" "}
                      {formatTimestamp(session.lastSeenAt)}
                    </Typography>
                    <Button
                      size="small"
                      disabled={admin.isBusy}
                      onClick={() => void admin.revokeSession(session.id)}
                    >
                      Log ud
                    </Button>
                  </Box>
                ))}
              </Box>
            )}

            {admin.sessions.length > 0 && (
              <Button
                size="small"
                color="warning"
                disabled={admin.isBusy}
                onClick={() => void admin.revokeAllSessions()}
              >
                Log ud på alle enheder
              </Button>
            )}
          </Box>

          <Divider />

          <ChildMessagesPanel familyId={familyId} member={member} />

          <Divider />

          <Box sx={{ display: "flex", gap: 1 }}>
            {admin.hasPin && (
              <Button size="small" color="warning" disabled={admin.isBusy} onClick={() => void admin.clearPin()}>
                Ryd kode
              </Button>
            )}
            <Button size="small" color="error" disabled={admin.isBusy} onClick={() => void admin.revokeToken()}>
              Deaktivér børneadgang
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}

interface ChildMessagesPanelProps {
  familyId: string;
  member: FamilyMemberDto;
}

function ChildMessagesPanel({ familyId, member }: ChildMessagesPanelProps) {
  const [messages, setMessages] = useState<ChildMessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    getChildMessagesForMember(familyId, member.id).then((result) => {
      if (!isCancelled && result.ok) {
        setMessages(result.data.messages ?? []);
      }
      if (!isCancelled) {
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [familyId, member.id]);

  async function handleSend() {
    const trimmed = draft.trim();

    if (!trimmed) {
      return;
    }

    setIsSending(true);
    setError(null);
    const response = await sendChildMessage(familyId, member.id, trimmed);
    setIsSending(false);

    if (!response.ok || !response.data.message) {
      setError(response.data.error ?? "Beskeden kunne ikke sendes.");
      return;
    }

    setMessages((current) => [response.data.message!, ...current]);
    setDraft("");
  }

  async function handleDelete(messageId: string) {
    const response = await deleteChildMessage(familyId, messageId);

    if (response.ok) {
      setMessages((current) => current.filter((message) => message.id !== messageId));
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Besked til {member.name}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 1.5 }}>
        <TextField
          label="Kort besked (maks. 280 tegn)"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 280))}
          size="small"
          fullWidth
          multiline
          maxRows={3}
        />
        <Button variant="outlined" size="small" disabled={isSending || !draft.trim()} onClick={() => void handleSend()}>
          Send
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <CircularProgress size={20} aria-label="Indlæser beskeder" />
      ) : messages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen beskeder sendt endnu.
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {messages.map((message) => (
            <Box key={message.id} sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{message.body}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTimestamp(message.createdAt)} · {message.readAt ? "Læst" : "Ikke læst endnu"}
                </Typography>
              </Box>
              <IconButton aria-label="Slet besked" size="small" onClick={() => void handleDelete(message.id)}>
                <DeleteOutlineRounded fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
