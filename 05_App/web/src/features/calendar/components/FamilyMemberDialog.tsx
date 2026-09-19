import { useEffect, useState } from "react";

import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
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
import {
  clearChildAccessPin,
  generateChildAccessToken,
  getChildAccessStatus,
  getMyFamily,
  revokeChildAccessToken,
  setChildAccessPin,
} from "../../family/familyApi";

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

  // Sprint 53: børneadgang (link + PIN) til dette medlem — se
  // childAccessApi.ts/childAccessManagement.ts. familyId er ikke kendt af
  // denne dialog i forvejen (samme situation som ShareLinkDialog.tsx),
  // derfor hentes den her via getMyFamily() sammen med statussen.
  const [childAccessFamilyId, setChildAccessFamilyId] = useState<string | null>(null);
  const [childAccessToken, setChildAccessToken] = useState<string | null>(null);
  const [childAccessHasPin, setChildAccessHasPin] = useState(false);
  const [isLoadingChildAccess, setIsLoadingChildAccess] = useState(false);
  const [childAccessError, setChildAccessError] = useState<string | null>(null);
  const [isChildAccessBusy, setIsChildAccessBusy] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

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
    setChildAccessFamilyId(null);
    setChildAccessToken(null);
    setChildAccessHasPin(false);
    setChildAccessError(null);
    setNewPin("");
    setPinError(null);
  }

  // Et helt nyt medlem har intet id, før det er gemt server-side (Fase 2) —
  // kalender-tildelingen kan derfor først sættes, når man redigerer medlemmet
  // igen bagefter.
  const canAssignCalendar = !isNew;
  // Børneadgang giver ingen mening for "family"-pseudomedlemmet (ingen
  // konto/PIN kan pege på hele familien) — samme relation IS NOT NULL-
  // afgrænsning som serveren selv håndhæver (404 ellers).
  const canManageChildAccess = !isNew && !isFamilyPseudoMember;

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

  useEffect(() => {
    if (!open || !canManageChildAccess || !member) {
      return;
    }

    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingChildAccess(true);
    setChildAccessError(null);

    getMyFamily()
      .then(async (familyResponse) => {
        if (isCancelled) return;

        const familyId = familyResponse.data.family?.id;
        if (!familyResponse.ok || !familyId) {
          setChildAccessError("Kunne ikke hente familien.");
          return;
        }

        setChildAccessFamilyId(familyId);

        const statusResponse = await getChildAccessStatus(familyId, member.id);
        if (isCancelled) return;

        if (!statusResponse.ok) {
          setChildAccessError(statusResponse.data.error ?? "Kunne ikke hente børneadgang.");
          return;
        }

        setChildAccessToken(statusResponse.data.token);
        setChildAccessHasPin(statusResponse.data.hasPin);
      })
      .catch(() => {
        if (!isCancelled) {
          setChildAccessError("Kunne ikke hente børneadgang.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingChildAccess(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [open, canManageChildAccess, member]);

  async function handleGenerateOrRotateToken() {
    if (!childAccessFamilyId || !member) {
      return;
    }

    setIsChildAccessBusy(true);
    setChildAccessError(null);
    const response = await generateChildAccessToken(childAccessFamilyId, member.id);
    setIsChildAccessBusy(false);

    if (!response.ok || !response.data.token) {
      setChildAccessError(response.data.error ?? "Linket kunne ikke oprettes.");
      return;
    }

    setChildAccessToken(response.data.token);
    setChildAccessHasPin(false);
  }

  async function handleRevokeToken() {
    if (!childAccessFamilyId || !member) {
      return;
    }

    setIsChildAccessBusy(true);
    setChildAccessError(null);
    const response = await revokeChildAccessToken(childAccessFamilyId, member.id);
    setIsChildAccessBusy(false);

    if (!response.ok) {
      setChildAccessError(response.data.error ?? "Linket kunne ikke fjernes.");
      return;
    }

    setChildAccessToken(null);
    setChildAccessHasPin(false);
  }

  async function handleSetPin() {
    if (!childAccessFamilyId || !member) {
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setPinError("Koden skal være præcis 4 cifre.");
      return;
    }

    setPinError(null);
    setIsChildAccessBusy(true);
    setChildAccessError(null);
    const response = await setChildAccessPin(childAccessFamilyId, member.id, newPin);
    setIsChildAccessBusy(false);

    if (!response.ok) {
      setChildAccessError(response.data.error ?? "Koden kunne ikke gemmes.");
      return;
    }

    setChildAccessHasPin(true);
    setNewPin("");
  }

  async function handleClearPin() {
    if (!childAccessFamilyId || !member) {
      return;
    }

    setIsChildAccessBusy(true);
    setChildAccessError(null);
    const response = await clearChildAccessPin(childAccessFamilyId, member.id);
    setIsChildAccessBusy(false);

    if (!response.ok) {
      setChildAccessError(response.data.error ?? "Koden kunne ikke ryddes.");
      return;
    }

    setChildAccessHasPin(false);
  }

  function handleCopyChildAccessLink() {
    if (!childAccessToken) {
      return;
    }

    const url = `${window.location.origin}/barn/${childAccessToken}`;
    navigator.clipboard?.writeText(url).catch(() => {
      // Udklipsholder kan være utilgængelig — linket kan stadig kopieres manuelt.
    });
  }

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

            {canManageChildAccess && (
              <>
                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Børneadgang (uden login)
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Et link + en 4-cifret kode, som {member?.name ?? "medlemmet"} kan bruge til at
                    logge ind på egen enhed (fx en tablet) — uden en almindelig konto.
                  </Typography>

                  {childAccessError && (
                    <Alert severity="error" sx={{ mb: 1.5 }}>
                      {childAccessError}
                    </Alert>
                  )}

                  {isLoadingChildAccess ? (
                    <Typography variant="body2" color="text.secondary">
                      Henter…
                    </Typography>
                  ) : (
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                      {childAccessToken ? (
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
                            {window.location.origin}/barn/{childAccessToken}
                          </Typography>
                          <IconButton
                            aria-label="Kopiér børneadgangs-link"
                            size="small"
                            onClick={handleCopyChildAccessLink}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={isChildAccessBusy}
                          onClick={() => void handleGenerateOrRotateToken()}
                        >
                          Opret link
                        </Button>
                      )}

                      {childAccessToken && (
                        <>
                          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                            <TextField
                              label="Ny kode (4 cifre)"
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
                              disabled={isChildAccessBusy}
                              onClick={() => void handleSetPin()}
                              sx={{ mt: 0.25 }}
                            >
                              {childAccessHasPin ? "Skift kode" : "Sæt kode"}
                            </Button>
                          </Box>

                          <Box sx={{ display: "flex", gap: 1 }}>
                            {childAccessHasPin && (
                              <Button
                                size="small"
                                color="warning"
                                disabled={isChildAccessBusy}
                                onClick={() => void handleClearPin()}
                              >
                                Ryd kode
                              </Button>
                            )}
                            <Button
                              size="small"
                              color="error"
                              disabled={isChildAccessBusy}
                              onClick={() => void handleRevokeToken()}
                            >
                              Fjern link
                            </Button>
                          </Box>
                        </>
                      )}
                    </Box>
                  )}
                </Box>

                <Divider />
              </>
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
            Google-/Outlook-/iCloud-kalenderen.
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
