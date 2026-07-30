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
  FormGroup,
} from "@mui/material";

import type { CalendarSource } from "../models/calendarProvider";
import { getExcludedGoogleCalendarIds } from "../preferences/googleCalendarExclusionStorage";

function getInitiallyCheckedIds(calendars: CalendarSource[]): Set<string> {
  const excludedIds = new Set(getExcludedGoogleCalendarIds());

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

interface GoogleCalendarSelectionDialogProps {
  open: boolean;
  calendars: CalendarSource[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSkip: () => void;
  onConfirm: (excludedGoogleCalendarIds: string[]) => void;
}

export function GoogleCalendarSelectionDialog({
  open,
  calendars,
  isLoading,
  error,
  onRetry,
  onSkip,
  onConfirm,
}: GoogleCalendarSelectionDialogProps) {
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
    getInitiallyCheckedIds(calendars),
  );

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setCheckedIds(getInitiallyCheckedIds(calendars));
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

  function handleConfirm() {
    // externalReference er kalenderens rå Google-id — det er dét,
    // eksklusionslisten gemmer, ikke det kodede sourceId (som afhænger af,
    // om kalenderen overhovedet bliver hentet igen).
    const excludedGoogleCalendarIds = calendars
      .filter((calendar) => !checkedIds.has(calendar.id))
      .map((calendar) => calendar.externalReference)
      .filter((id): id is string => Boolean(id));

    onConfirm(excludedGoogleCalendarIds);
  }

  return (
    <Dialog open={open} onClose={onSkip} fullWidth maxWidth="xs">
      <DialogTitle>Vælg Google-kalendere</DialogTitle>

      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
          <DialogContentText>
            Hvilke af dine Google-kalendere skal bringes med ind i
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
              Ingen kalendere fundet på din Google-konto.
            </Alert>
          )}

          {!isLoading && !error && calendars.length > 0 && (
            <FormGroup>
              {calendars.map((calendar) => (
                <FormControlLabel
                  key={calendar.id}
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
              ))}
            </FormGroup>
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
