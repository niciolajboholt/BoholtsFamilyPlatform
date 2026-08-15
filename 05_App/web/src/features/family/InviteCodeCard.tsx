import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import RefreshIcon from "@mui/icons-material/RefreshRounded";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Typography,
} from "@mui/material";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";

import { getMyFamily, regenerateInvite } from "./familyApi";
import type { FamilyRole } from "./familyApi";

// Vist i Indstillinger, så et familiemedlem altid kan finde koden igen —
// den vises kun automatisk, mens familien lige er blevet oprettet.
export function InviteCodeCard() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [role, setRole] = useState<FamilyRole | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  if (isLoading || !familyId) {
    return null;
  }

  const canRegenerate = role === "owner" || role === "admin";

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Avatar sx={{ bgcolor: "primary.main" }}>
            <GroupAddRounded />
          </Avatar>

          <Box>
            <Typography variant="h6">Invitér til familien</Typography>
            <Typography variant="body2" color="text.secondary">
              Del koden med dem, der skal have adgang.
            </Typography>
          </Box>
        </Box>

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
      </CardContent>
    </Card>
  );
}
