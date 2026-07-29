import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import { familyMemberRelations } from "../data/familyMemberRelations";
import type { FamilyMemberRelation } from "../data/familyMemberRelations";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { FamilyMemberInput } from "../hooks/useFamilyMembers";

// A small, fixed swatch set rather than a full color wheel — no picker
// library exists in this project, and 8 choices is plenty for a family.
const colorSwatches = [
  "#2E7D32",
  "#C06C84",
  "#D99832",
  "#4D7EA8",
  "#6D597A",
  "#00838F",
  "#D32F2F",
  "#5D4037",
];

interface FamilyMemberDialogProps {
  open: boolean;
  member: CalendarOwner | null;
  onClose: () => void;
  onSave: (input: FamilyMemberInput) => void;
  onDelete: (id: string) => void | Promise<void>;
}

export function FamilyMemberDialog({
  open,
  member,
  onClose,
  onSave,
  onDelete,
}: FamilyMemberDialogProps) {
  const isFamilyPseudoMember = member?.id === familyPseudoMemberId;
  const isNew = member === null;

  const [name, setName] = useState(member?.name ?? "");
  const [relation, setRelation] = useState<FamilyMemberRelation | "">(
    member?.relation ?? "",
  );
  const [color, setColor] = useState(member?.color ?? colorSwatches[0]);
  const [isNameTouched, setIsNameTouched] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);

  // Same render-phase reset pattern established in Sprint 13 (NewEventDialog/
  // EditEventDialog) — avoids a useEffect that the react-hooks/
  // set-state-in-effect rule would flag, and avoids remounting the dialog
  // via a key (which would skip MUI's close transition).
  const resetKey = open ? (member?.id ?? "new") : null;
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  if (resetKey !== null && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setName(member?.name ?? "");
    setRelation(member?.relation ?? "");
    setColor(member?.color ?? colorSwatches[0]);
    setIsNameTouched(false);
    setIsDeleteConfirmVisible(false);
  }

  const trimmedName = name.trim();
  const nameError =
    !isFamilyPseudoMember && isNameTouched && trimmedName.length === 0
      ? "Skriv et navn."
      : null;

  function handleSave() {
    if (!isFamilyPseudoMember && trimmedName.length === 0) {
      setIsNameTouched(true);
      return;
    }

    onSave({
      name: isFamilyPseudoMember ? (member?.name ?? "Familien") : trimmedName,
      relation: isFamilyPseudoMember
        ? undefined
        : relation === ""
          ? undefined
          : relation,
      color,
    });
    onClose();
  }

  function handleConfirmDelete() {
    if (!member) {
      return;
    }

    setIsDeleteConfirmVisible(false);
    void onDelete(member.id);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>
          {isNew ? "Tilføj familiemedlem" : "Rediger familiemedlem"}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
            {isFamilyPseudoMember && (
              <Alert severity="info">
                "Familien" er en delt profil til fælles aftaler. Kun farven
                kan ændres — navnet kan ikke ændres, og profilen kan ikke
                slettes.
              </Alert>
            )}

            {!isFamilyPseudoMember && (
              <TextField
                label="Navn"
                value={name}
                autoFocus
                required
                fullWidth
                error={Boolean(nameError)}
                helperText={nameError}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setIsNameTouched(true)}
              />
            )}

            {!isFamilyPseudoMember && (
              <TextField
                select
                label="Relation"
                value={relation}
                fullWidth
                onChange={(event) =>
                  setRelation(event.target.value as FamilyMemberRelation)
                }
              >
                {familyMemberRelations.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Farve
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {colorSwatches.map((swatch) => (
                  <Box
                    key={swatch}
                    component="button"
                    type="button"
                    aria-label={`Vælg farven ${swatch}`}
                    aria-pressed={color === swatch}
                    onClick={() => setColor(swatch)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: swatch,
                      cursor: "pointer",
                      border: "3px solid",
                      borderColor:
                        color === swatch ? "text.primary" : "transparent",
                      outline: "1px solid",
                      outlineColor: "divider",
                      outlineOffset: -1,
                      p: 0,
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}
        >
          {!isNew && !isFamilyPseudoMember ? (
            <Button
              color="error"
              onClick={() => setIsDeleteConfirmVisible(true)}
            >
              Slet
            </Button>
          ) : (
            <span />
          )}

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={onClose}>Annuller</Button>
            <Button variant="contained" onClick={handleSave}>
              Gem
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isDeleteConfirmVisible}
        onClose={() => setIsDeleteConfirmVisible(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Slet {member?.name}?</DialogTitle>

        <DialogContent>
          <DialogContentText>
            Aftaler, der har {member?.name} som deltager, flyttes til
            "Familien" i stedet for at blive slettet.
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setIsDeleteConfirmVisible(false)}>
            Fortryd
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
          >
            Slet familiemedlem
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
