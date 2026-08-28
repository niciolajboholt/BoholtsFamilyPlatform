import { useEffect, useState } from "react";

import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { useSession } from "../auth/hooks/useSession";
import { getInitials } from "../calendar/utils/getInitials";
import {
  changeMemberRole,
  getFamilyMemberships,
  getMyFamily,
  removeMembership,
  type FamilyMembershipDto,
  type FamilyRole,
} from "./familyApi";

interface FamilyMembershipsDialogProps {
  open: boolean;
  onClose: () => void;
}

const roleLabels: Record<FamilyRole, string> = {
  owner: "Ejer",
  admin: "Admin",
  member: "Medlem",
};

// Fase 5: administration af familiens KONTI (rigtige brugere med en rolle),
// ikke at forveksle med FamilySection's profiler (family_members — kan være
// børn uden egen konto). Åbnes fra en selvstændig række i Indstillinger,
// samme mønster som InviteCodeDialog.
export function FamilyMembershipsDialog({ open, onClose }: FamilyMembershipsDialogProps) {
  const { user } = useSession();

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [ownRole, setOwnRole] = useState<FamilyRole | null>(null);
  const [memberships, setMemberships] = useState<FamilyMembershipDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // userId for den række, hvis rolle/fjernelse lige nu er i gang med at blive
  // gemt — bruges til at deaktivere netop den rækkes kontroller, ikke hele
  // dialogen, mens kaldet er undervejs.
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;
    // Genkører hver gang dialogen genåbnes, ikke kun ved mount — ellers ville
    // et nyt besøg vise den forrige tilstand et øjeblik. Samme accepterede
    // mønster som IcsSubscriptionsPanel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setErrorMessage(null);

    getMyFamily().then(async (result) => {
      if (isCancelled || !result.ok || !result.data.family) {
        setIsLoading(false);
        return;
      }

      const id = result.data.family.id;
      setFamilyId(id);
      setOwnRole(result.data.role ?? null);

      const membershipsResult = await getFamilyMemberships(id);
      if (!isCancelled) {
        if (membershipsResult.ok && membershipsResult.data.memberships) {
          setMemberships(membershipsResult.data.memberships);
        } else {
          setErrorMessage(membershipsResult.data.error ?? "Kunne ikke hente familiens medlemmer.");
        }
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  async function handleRoleChange(targetUserId: string, role: FamilyRole) {
    if (!familyId || (role !== "admin" && role !== "member")) {
      return;
    }

    setSavingUserId(targetUserId);
    setErrorMessage(null);
    const result = await changeMemberRole(familyId, targetUserId, role);
    setSavingUserId(null);

    if (result.ok) {
      setMemberships((current) =>
        current.map((membership) => (membership.userId === targetUserId ? { ...membership, role } : membership)),
      );
    } else {
      setErrorMessage(result.data.error ?? "Kunne ikke ændre rollen.");
    }
  }

  async function handleRemove(targetUserId: string) {
    if (!familyId) {
      return;
    }

    setSavingUserId(targetUserId);
    setErrorMessage(null);
    const result = await removeMembership(familyId, targetUserId);
    setSavingUserId(null);

    if (result.ok) {
      setMemberships((current) => current.filter((membership) => membership.userId !== targetUserId));
    } else {
      setErrorMessage(result.data.error ?? "Kunne ikke fjerne medlemmet.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Medlemmer og roller</DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : !familyId ? (
          <Typography color="text.secondary">Du er ikke medlem af en familie endnu.</Typography>
        ) : (
          <>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
              Ejeren kan ændre rolle for andre konti. Ejer og admin kan fjerne en
              konto fra familien.
            </Typography>

            {memberships.map((membership, index) => {
              const isSelf = membership.userId === user?.id;
              const isTargetOwner = membership.role === "owner";
              const canChangeRole = ownRole === "owner" && !isSelf && !isTargetOwner;
              const canRemove =
                (ownRole === "owner" || ownRole === "admin") && !isSelf && !isTargetOwner;
              const isSavingRow = savingUserId === membership.userId;

              return (
                <Box key={membership.userId}>
                  <Box sx={{ display: "flex", alignItems: "center", py: 1.25, gap: 1.5 }}>
                    <Avatar sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 700 }}>
                      {getInitials(membership.name)}
                    </Avatar>

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>
                        {membership.name}
                        {isSelf ? " (dig)" : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {membership.email}
                      </Typography>
                    </Box>

                    {canChangeRole ? (
                      <TextField
                        select
                        size="small"
                        aria-label={`Rolle for ${membership.name}`}
                        value={membership.role}
                        onChange={(event) =>
                          void handleRoleChange(membership.userId, event.target.value as FamilyRole)
                        }
                        disabled={isSavingRow}
                        sx={{ width: 110 }}
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="member">Medlem</MenuItem>
                      </TextField>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {roleLabels[membership.role]}
                      </Typography>
                    )}

                    {canRemove && (
                      <IconButton
                        aria-label={`Fjern ${membership.name}`}
                        onClick={() => void handleRemove(membership.userId)}
                        disabled={isSavingRow}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  {index < memberships.length - 1 && <Divider />}
                </Box>
              );
            })}

            {errorMessage && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {errorMessage}
              </Alert>
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
