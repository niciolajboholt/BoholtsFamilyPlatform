import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import RefreshIcon from "@mui/icons-material/RefreshRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";

import { getMyFamily, regenerateInvite } from "./familyApi";
import type { FamilyRole } from "./familyApi";

interface InviteCodeDialogProps {
  open: boolean;
  onClose: () => void;
}

// Sprint 30 (omlægning): var tidligere et permanent kort i Indstillinger —
// er nu en dialogboks, åbnet fra "Inviter familiemedlem"-rækken, så et
// familiemedlem stadig altid kan finde koden igen, uden at den optager plads
// på selve siden.
export function InviteCodeDialog({ open, onClose }: InviteCodeDialogProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [role, setRole] = useState<FamilyRole | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Koden giver adgang til familien — skjult som udgangspunkt, så den ikke
  // ligger fremme for enhver, der lige kigger forbi indstillingerne.
  const [isCodeVisible, setIsCodeVisible] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (isCancelled) {
        return;
      }

      if (result.ok && result.data.family) {
        setFamilyId(result.data.family.id);
        setRole(result.data.role ?? null);
        setInviteCode(result.data.inviteCode ?? null);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleRegenerate() {
    if (!familyId) {
      return;
    }

    setIsRegenerating(true);
    const result = await regenerateInvite(familyId);
    setIsRegenerating(false);

    if (result.ok && result.data.inviteCode) {
      setInviteCode(result.data.inviteCode);
    }
  }

  function handleCopy() {
    if (inviteCode) {
      navigator.clipboard?.writeText(inviteCode).catch(() => {
        // Udklipsholder kan være utilgængelig — koden står stadig synligt.
      });
    }
  }

  const canRegenerate = role === "owner" || role === "admin";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Invitér til familien</DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : !familyId ? (
          <Typography color="text.secondary">
            Du er ikke medlem af en familie endnu.
          </Typography>
        ) : (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Del koden med dem, der skal have adgang.
            </Typography>

            {isCodeVisible ? (
              <>
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
                  <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 2 }}>
                    {inviteCode ?? "—"}
                  </Typography>

                  <IconButton aria-label="Kopiér invitationskode" onClick={handleCopy}>
                    <ContentCopyIcon />
                  </IconButton>
                </Box>

                {canRegenerate && (
                  <Button
                    sx={{ mt: 1.5 }}
                    startIcon={
                      isRegenerating ? (
                        <CircularProgress size={16} />
                      ) : (
                        <RefreshIcon />
                      )
                    }
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                  >
                    Lav en ny kode
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outlined"
                fullWidth
                startIcon={<VisibilityRounded />}
                onClick={() => setIsCodeVisible(true)}
              >
                Vis invitationskode
              </Button>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
