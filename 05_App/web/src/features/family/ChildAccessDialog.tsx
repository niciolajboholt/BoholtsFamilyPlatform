import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import { getInitials } from "../calendar/utils/getInitials";
import { ChildAccessQrCode } from "./components/ChildAccessQrCode";
import {
  deleteChildMessage,
  getChildMessagesForMember,
  getMyFamily,
  sendChildMessage,
  type ChildMessageDto,
  type FamilyMemberDto,
} from "./familyApi";
import { useChildAccessAdmin } from "./hooks/useChildAccessAdmin";

interface ChildAccessDialogProps {
  open: boolean;
  onClose: () => void;
}

// Sprint 55 (se 55_Sprint55_Barn_Adgang_UX_Plan.md, Fase A): den ENE,
// samlede administrationsside for børneadgang — erstatter den tidligere
// skjulte sektion i FamilyMemberDialog.tsx (som nu blot henviser hertil),
// så der kun findes ét administrations-flow, ikke to. Åbnes fra en
// selvstændig række i Indstillinger (ChildAccessSection.tsx), samme
// mønster som FamilyMembershipsDialog/ShareLinkDialog.
export function ChildAccessDialog({ open, onClose }: ChildAccessDialogProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setErrorMessage(null);

    getMyFamily().then((result) => {
      if (isCancelled) {
        return;
      }

      if (!result.ok || !result.data.family || !result.data.members) {
        setErrorMessage("Kunne ikke hente familien.");
        setIsLoading(false);
        return;
      }

      setFamilyId(result.data.family.id);
      setMembers(result.data.members.filter((member) => member.relation !== null));
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Børneadgang</DialogTitle>

      <DialogContent>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
          Giv et familiemedlem adgang til sin egen "Mit i dag"-visning på en
          separat enhed (fx en tablet), uden at logge ind med Google eller
          Microsoft — via et link og en 4-cifret kode.
        </Typography>

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress aria-label="Indlæser familiemedlemmer" />
          </Box>
        ) : errorMessage ? (
          <Alert severity="error">{errorMessage}</Alert>
        ) : !familyId || members.length === 0 ? (
          <Typography color="text.secondary">Ingen familiemedlemmer endnu.</Typography>
        ) : (
          members.map((member) => (
            <ChildAccessMemberAccordion
              key={member.id}
              familyId={familyId}
              member={member}
              expanded={expandedMemberId === member.id}
              onToggle={() => setExpandedMemberId((current) => (current === member.id ? null : member.id))}
            />
          ))
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Aldrig";
  }

  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

interface ChildAccessMemberAccordionProps {
  familyId: string;
  member: FamilyMemberDto;
  expanded: boolean;
  onToggle: () => void;
}

function ChildAccessMemberAccordion({ familyId, member, expanded, onToggle }: ChildAccessMemberAccordionProps) {
  const admin = useChildAccessAdmin(familyId, expanded ? member.id : null);
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

  return (
    <Accordion expanded={expanded} onChange={onToggle} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
          <Avatar sx={{ bgcolor: member.color, width: 36, height: 36, fontSize: 14, fontWeight: 700 }}>
            {getInitials(member.name)}
          </Avatar>
          <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{member.name}</Typography>
          {expanded && !admin.isLoading && (
            <Chip
              size="small"
              label={admin.token ? (admin.hasPin ? "Klar til brug" : "Link uden kode") : "Ikke oprettet"}
              color={admin.token && admin.hasPin ? "success" : "default"}
              variant={admin.token && admin.hasPin ? "filled" : "outlined"}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        {admin.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} aria-label="Indlæser børneadgang" />
          </Box>
        ) : (
          <Box sx={{ display: "grid", gap: 2 }}>
            {admin.error && <Alert severity="error">{admin.error}</Alert>}

            {!admin.token ? (
              <Button
                variant="outlined"
                disabled={admin.isBusy}
                onClick={() => void admin.generateOrRotateToken()}
              >
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
        )}
      </AccordionDetails>
    </Accordion>
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
