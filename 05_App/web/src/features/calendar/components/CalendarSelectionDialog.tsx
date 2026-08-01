import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import { useFamilyMembers } from "../hooks/useFamilyMembers";
import type { CalendarOwnerId } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";

const unassignedValue = "";

function getInitiallyCheckedIds(
  calendars: CalendarSource[],
  excludedIds: Set<string>,
): Set<string> {
  return new Set(
    calendars
      .filter(
        (calendar) =>
          !calendar.externalReference ||
          !excludedIds.has(calendar.externalReference),
      )
      .map((calendar) => calendar.id),
  );
}

function getInitialMemberAssignments(
  calendars: CalendarSource[],
  getOwnerId: (calendarId: string) => CalendarOwnerId | undefined,
): Record<string, CalendarOwnerId | typeof unassignedValue> {
  const assignments: Record<string, CalendarOwnerId | typeof unassignedValue> = {};

  for (const calendar of calendars) {
    assignments[calendar.id] = calendar.externalReference
      ? (getOwnerId(calendar.externalReference) ?? unassignedValue)
      : unassignedValue;
  }

  return assignments;
}

export interface CalendarMemberAssignment {
  calendarId: string;
  ownerId: CalendarOwnerId | null;
}

export interface CalendarNameOverride {
  ownerId: CalendarOwnerId;
  newName: string;
}

interface CalendarSelectionDialogProps {
  open: boolean;
  providerLabel: string;
  calendars: CalendarSource[];
  isLoading: boolean;
  error: string | null;
  getExcludedIds: () => string[];
  getOwnerId: (calendarId: string) => CalendarOwnerId | undefined;
  onRetry: () => void;
  onSkip: () => void;
  onConfirm: (
    excludedCalendarIds: string[],
    memberAssignments: CalendarMemberAssignment[],
    nameOverrides: CalendarNameOverride[],
  ) => void;
}

/**
 * Generisk kalender-valg-dialog, brugt af både Google og Outlook (og senere
 * Apple) — provider-specifikke detaljer (eksklusionslager, kalender-til-
 * medlem-tildeling) kommer ind som props, i stedet for at dialogen selv
 * kender til en bestemt provider.
 */
export function CalendarSelectionDialog({
  open,
  providerLabel,
  calendars,
  isLoading,
  error,
  getExcludedIds,
  getOwnerId,
  onRetry,
  onSkip,
  onConfirm,
}: CalendarSelectionDialogProps) {
  const { members } = useFamilyMembers();
  // Forudmarkeres ud fra allerede gemte fravalg — dialogen genbruges både
  // ved første forbindelse (intet fravalgt endnu, så alt er markeret) og
  // senere for at redigere et eksisterende valg, hvor tidligere fravalgte
  // kalendere skal vises som afkrydsede fra. Nulstilles i render-fasen (ikke
  // en useEffect), samme mønster som fx FamilyMemberDialog, hver gang
  // dialogen åbnes eller den hentede kalenderliste ændrer sig.
  const resetKey = open
    ? calendars.map((calendar) => calendar.id).join(",")
    : "closed";
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() =>
    getInitiallyCheckedIds(calendars, new Set(getExcludedIds())),
  );
  const [memberAssignments, setMemberAssignments] = useState(() =>
    getInitialMemberAssignments(calendars, getOwnerId),
  );
  // Keyed by calendar.id — whether to replace an assigned member's still-
  // placeholder name (e.g. "Far") with this calendar's real name. Defaults
  // to true (checked) whenever the condition applies; absence of a key
  // just falls back to that default, so no separate init pass needed.
  const [nameOverrideChoices, setNameOverrideChoices] = useState<
    Record<string, boolean>
  >({});

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setCheckedIds(getInitiallyCheckedIds(calendars, new Set(getExcludedIds())));
    setMemberAssignments(getInitialMemberAssignments(calendars, getOwnerId));
    setNameOverrideChoices({});
  }

  function getNameOverrideCandidate(calendar: CalendarSource) {
    const ownerId = memberAssignments[calendar.id];
    if (!ownerId) return null;

    const member = members.find((candidate) => candidate.id === ownerId);
    if (!member?.isPlaceholderName) return null;
    if (!calendar.name || calendar.name === member.name) return null;

    return member;
  }

  function toggleCalendar(sourceId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);

      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }

      return next;
    });
  }

  function assignCalendarMember(sourceId: string, ownerId: string) {
    setMemberAssignments((current) => ({ ...current, [sourceId]: ownerId }));
  }

  function handleConfirm() {
    // externalReference er kalenderens rå id — det er dét, både
    // eksklusionslisten og familie-tildelingen gemmer, ikke det kodede
    // sourceId (som afhænger af, om kalenderen overhovedet bliver hentet igen).
    const excludedCalendarIds = calendars
      .filter((calendar) => !checkedIds.has(calendar.id))
      .map((calendar) => calendar.externalReference)
      .filter((id): id is string => Boolean(id));

    const memberMappings: CalendarMemberAssignment[] = calendars
      .filter((calendar) => Boolean(calendar.externalReference))
      .map((calendar) => ({
        calendarId: calendar.externalReference!,
        ownerId: memberAssignments[calendar.id] || null,
      }));

    const nameOverrides: CalendarNameOverride[] = calendars
      .filter((calendar) => {
        const candidate = getNameOverrideCandidate(calendar);
        return candidate && (nameOverrideChoices[calendar.id] ?? true);
      })
      .map((calendar) => ({
        ownerId: memberAssignments[calendar.id],
        newName: calendar.name,
      }));

    onConfirm(excludedCalendarIds, memberMappings, nameOverrides);
  }

  return (
    <Dialog open={open} onClose={onSkip} fullWidth maxWidth="xs">
      <DialogTitle>Vælg {providerLabel}-kalendere</DialogTitle>

      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
          <DialogContentText>
            Hvilke af dine {providerLabel}-kalendere skal bringes med ind i
            familie-appen? Fravalgte kalendere hentes slet ikke. Du kan altid
            ændre dit valg igen senere via synkroniseringsknappen under
            Kalenderforbindelser.
          </DialogContentText>

          {isLoading && (
            <Box
              role="status"
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <CircularProgress size={18} />
              Henter dine kalendere…
            </Box>
          )}

          {error && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={onRetry}>
                  Prøv igen
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {!isLoading && !error && calendars.length === 0 && (
            <Alert severity="info">
              Ingen kalendere fundet på din {providerLabel}-konto.
            </Alert>
          )}

          {!isLoading && !error && calendars.length > 0 && (
            <Box sx={{ display: "grid", gap: 1 }}>
              {calendars.map((calendar) => (
                <Box
                  key={calendar.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <FormControlLabel
                    sx={{ flexGrow: 1, mr: 0 }}
                    control={
                      <Checkbox
                        checked={checkedIds.has(calendar.id)}
                        onChange={() => toggleCalendar(calendar.id)}
                        sx={{
                          color: calendar.color,
                          "&.Mui-checked": { color: calendar.color },
                        }}
                      />
                    }
                    label={calendar.name}
                  />

                  <Select
                    size="small"
                    displayEmpty
                    value={memberAssignments[calendar.id] ?? unassignedValue}
                    onChange={(event) =>
                      assignCalendarMember(calendar.id, event.target.value)
                    }
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value={unassignedValue}>
                      <Typography color="text.secondary">
                        Ingen tildeling
                      </Typography>
                    </MenuItem>

                    {members.map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        {member.name}
                      </MenuItem>
                    ))}
                  </Select>

                  {(() => {
                    const overrideCandidate = getNameOverrideCandidate(calendar);
                    if (!overrideCandidate) return null;

                    return (
                      <FormControlLabel
                        sx={{ width: "100%", ml: 0 }}
                        control={
                          <Checkbox
                            size="small"
                            checked={nameOverrideChoices[calendar.id] ?? true}
                            onChange={(event) =>
                              setNameOverrideChoices((current) => ({
                                ...current,
                                [calendar.id]: event.target.checked,
                              }))
                            }
                          />
                        }
                        label={
                          <Typography variant="body2" color="text.secondary">
                            Brug "{calendar.name}" som navn for "
                            {overrideCandidate.name}"?
                          </Typography>
                        }
                      />
                    );
                  })()}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onSkip}>Spring over</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={isLoading || Boolean(error) || calendars.length === 0}
        >
          Bekræft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
