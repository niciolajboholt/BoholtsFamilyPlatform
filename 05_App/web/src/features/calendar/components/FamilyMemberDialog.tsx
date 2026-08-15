import { useEffect, useState } from "react";

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
import { familyMemberColorSwatches as colorSwatches } from "../data/familyMemberColorSwatches";
import { familyMemberRelations } from "../data/familyMemberRelations";
import type { FamilyMemberRelation } from "../data/familyMemberRelations";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { FamilyMemberInput } from "../hooks/useFamilyMembers";
import type { MappableCalendarOption } from "../providers/calendarProviderFactory";
import { listAllMappableCalendars } from "../providers/calendarProviderFactory";
import {
  getCalendarIdForOwner,
  refreshCalendarMemberMappingsFromServer,
  setCalendarMemberMapping,
} from "../preferences/calendarMemberMappingStorage";

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
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [calendarOptions, setCalendarOptions] = useState<
    MappableCalendarOption[]
  >([]);
  const [isLoadingCalendarOptions, setIsLoadingCalendarOptions] =
    useState(false);
  const [calendarMappingError, setCalendarMappingError] = useState<
    string | null
  >(null);
  const [isSavingCalendarMapping, setIsSavingCalendarMapping] =
    useState(false);

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
    // Nulstillet her, ikke forudfyldt — den rigtige værdi (hvis nogen) sættes
    // af effekten herunder, når mappings er hentet friskt fra serveren.
    setSelectedCalendarId("");
    setCalendarMappingError(null);
  }

  // Et helt nyt medlem har intet id, før det er gemt server-side (Fase 2) —
  // kalender-tildelingen kan derfor først sættes, når man redigerer medlemmet
  // igen bagefter.
  const canAssignCalendar = !isNew;

  useEffect(() => {
    if (!open || !canAssignCalendar) {
      return;
    }

    let isCancelled = false;
    // Synkron ved effektens start (dialogen lige åbnet), ikke en kaskade fra
    // en tidligere renders state — samme mønster som Sprint 14's
    // useGoogleCalendarConnection brugte til attemptSilentReconnect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingCalendarOptions(true);

    Promise.all([
      listAllMappableCalendars(),
      refreshCalendarMemberMappingsFromServer(),
    ])
      .then(([options]) => {
        if (isCancelled) {
          return;
        }

        setCalendarOptions(options);

        // Mappings er nu friske fra serveren (Fase 4) — sikkert at læse
        // den synkrone cache her.
        if (member) {
          setSelectedCalendarId(getCalendarIdForOwner(member.id) ?? "");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCalendarOptions([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingCalendarOptions(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [open, canAssignCalendar, member]);

  const trimmedName = name.trim();
  const nameError =
    isNameTouched && trimmedName.length === 0 ? "Skriv et navn." : null;

  async function handleSave() {
    if (trimmedName.length === 0) {
      setIsNameTouched(true);
      return;
    }

    onSave({
      name: trimmedName,
      relation: isFamilyPseudoMember
        ? undefined
        : relation === ""
          ? undefined
          : relation,
      color,
      isPlaceholderName: false,
    });

    // Afventes og fejlhåndteres nu i stedet for `void`-kaldt fire-and-forget
    // — en tidligere stille fejl her (kalender-tildeling, der bare ikke
    // skete) var svær at opdage, netop fordi intet kald tjekkede resultatet.
    // Dialogen holdes åben ved fejl, så brugeren ser det og kan prøve igen,
    // i stedet for at antage succes og lukke.
    if (canAssignCalendar && member) {
      setCalendarMappingError(null);
      setIsSavingCalendarMapping(true);

      const previousCalendarId = getCalendarIdForOwner(member.id);
      let ok = true;

      if (previousCalendarId && previousCalendarId !== selectedCalendarId) {
        ok = (await setCalendarMemberMapping(previousCalendarId, null)) && ok;
      }

      if (ok && selectedCalendarId) {
        ok = await setCalendarMemberMapping(selectedCalendarId, member.id);
      }

      setIsSavingCalendarMapping(false);

      if (!ok) {
        setCalendarMappingError(
          "Kalender-tildelingen kunne ikke gemmes. Prøv igen.",
        );
        return;
      }
    }

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
                Dette er den delte profil til fælles aftaler. Navn og farve
                kan ændres, men profilen kan ikke slettes.
              </Alert>
            )}

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

            {canAssignCalendar && (
              <TextField
                select
                label="Kalender"
                value={selectedCalendarId}
                fullWidth
                disabled={isLoadingCalendarOptions}
                helperText={
                  isLoadingCalendarOptions
                    ? "Henter forbundne kalendere…"
                    : "Aftaler fra denne kalender vises som tilhørende dette medlem."
                }
                onChange={(event) => setSelectedCalendarId(event.target.value)}
              >
                <MenuItem value="">Ingen</MenuItem>
                {calendarOptions.map((option) => (
                  <MenuItem
                    key={option.rawCalendarId}
                    value={option.rawCalendarId}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {calendarMappingError && (
              <Alert severity="error">{calendarMappingError}</Alert>
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
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={isSavingCalendarMapping}
            >
              {isSavingCalendarMapping ? "Gemmer…" : "Gem"}
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
            Profilen fjernes fra familien. Aftaler i en kalender, der er
            tildelt {member?.name}, berøres ikke og forbliver i
            Google/Outlook-kalenderen.
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
