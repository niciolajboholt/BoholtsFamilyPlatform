import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import RefreshIcon from "@mui/icons-material/RefreshRounded";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Typography,
} from "@mui/material";

import {
  createShareLink,
  deleteShareLink,
  getMyFamily,
  getShareLink,
  type FamilyMemberDto,
  type FamilyRole,
  type ShareLinkDto,
} from "./familyApi";

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
}

// Sprint 26: read-only delelink til familiens kalender for udenforstående
// (fx bedsteforældre) uden login — se 26_Sprint26_Konflikter_Delelink_Plan.md.
// Sprint 30 (omlægning): var tidligere et permanent kort i Indstillinger —
// er nu en dialogboks, åbnet fra "Del kalender"-rækken.
export function ShareLinkDialog({ open, onClose }: ShareLinkDialogProps) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [role, setRole] = useState<FamilyRole | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [shareLink, setShareLink] = useState<ShareLinkDto | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [includeDescription, setIncludeDescription] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then(async (result) => {
      if (isCancelled || !result.ok || !result.data.family) {
        setIsLoading(false);
        return;
      }

      const id = result.data.family.id;
      setFamilyId(id);
      setRole(result.data.role ?? null);
      setMembers(result.data.members ?? []);

      const linkResult = await getShareLink(id);
      if (isCancelled) {
        return;
      }

      if (linkResult.ok && linkResult.data.shareLink) {
        setShareLink(linkResult.data.shareLink);
        setSelectedMemberIds(new Set(linkResult.data.shareLink.includedMemberIds));
        setIncludeDescription(linkResult.data.shareLink.includeDescription);
        setIncludeLocation(linkResult.data.shareLink.includeLocation);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!familyId || selectedMemberIds.size === 0) {
      return;
    }

    setIsSaving(true);
    const result = await createShareLink(familyId, [...selectedMemberIds], {
      includeDescription,
      includeLocation,
    });
    setIsSaving(false);

    if (result.ok && result.data.shareLink) {
      setShareLink(result.data.shareLink);
    }
  }

  async function handleDeactivate() {
    if (!familyId) {
      return;
    }

    setIsSaving(true);
    const result = await deleteShareLink(familyId);
    setIsSaving(false);

    if (result.ok) {
      setShareLink(null);
      setSelectedMemberIds(new Set());
      setIncludeDescription(false);
      setIncludeLocation(false);
    }
  }

  function handleCopy() {
    if (!shareLink) {
      return;
    }

    const url = `${window.location.origin}/share/${shareLink.token}`;
    navigator.clipboard?.writeText(url).catch(() => {
      // Udklipsholder kan være utilgængelig — linket kan stadig kopieres manuelt.
    });
  }

  const canManage = role === "owner" || role === "admin";
  const hasNothingToShow = !isLoading && (!familyId || (!canManage && !shareLink));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Del kalender</DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : hasNothingToShow ? (
          <Typography color="text.secondary">
            Der er ikke noget delelink endnu.
          </Typography>
        ) : (
          <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Read-only visning for udenforstående, fx bedsteforældre — uden
              login.
            </Typography>

            {shareLink && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1.5,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                }}
              >
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {window.location.origin}/share/{shareLink.token}
                </Typography>

                <IconButton aria-label="Kopiér delelink" onClick={handleCopy}>
                  <ContentCopyIcon />
                </IconButton>
              </Box>
            )}

            {canManage && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Hvilke familiemedlemmers kalendere skal deles?
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", mb: 2 }}>
                  {members.map((member) => (
                    <FormControlLabel
                      key={member.id}
                      control={
                        <Checkbox
                          checked={selectedMemberIds.has(member.id)}
                          onChange={() => toggleMember(member.id)}
                        />
                      }
                      label={member.name}
                    />
                  ))}
                </Box>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Hvad skal linket vise ud over titel og tidspunkt?
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeDescription}
                        onChange={(event) => setIncludeDescription(event.target.checked)}
                      />
                    }
                    label="Beskrivelse"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeLocation}
                        onChange={(event) => setIncludeLocation(event.target.checked)}
                      />
                    }
                    label="Lokation"
                  />
                </Box>

                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  <Button
                    variant="contained"
                    startIcon={isSaving ? <CircularProgress size={16} /> : <RefreshIcon />}
                    onClick={handleSave}
                    disabled={isSaving || selectedMemberIds.size === 0}
                  >
                    {shareLink ? "Opdatér delelink" : "Opret delelink"}
                  </Button>

                  {shareLink && (
                    <Button
                      color="error"
                      startIcon={<DeleteOutlineRounded />}
                      onClick={handleDeactivate}
                      disabled={isSaving}
                    >
                      Deaktivér
                    </Button>
                  )}
                </Box>
              </>
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
