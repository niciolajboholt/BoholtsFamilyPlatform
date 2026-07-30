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

interface GoogleCalendarSelectionDialogProps {
  open: boolean;
  calendars: CalendarSource[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSkip: () => void;
  onConfirm: (hiddenSourceIds: string[]) => void;
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
  // Alle kalendere er markeret som udgangspunkt — samme standard som resten
  // af appen bruger for nyopdagede kilder. Nulstilles i render-fasen (ikke
  // en useEffect), samme mønster som fx FamilyMemberDialog, hver gang
  // dialogen åbnes eller den hentede kalenderliste ændrer sig.
  const resetKey = open
    ? calendars.map((calendar) => calendar.id).join(",")
    : "closed";
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(calendars.map((calendar) => calendar.id)),
  );

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setCheckedIds(new Set(calendars.map((calendar) => calendar.id)));
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
    const hiddenSourceIds = calendars
      .map((calendar) => calendar.id)
      .filter((id) => !checkedIds.has(id));

    onConfirm(hiddenSourceIds);
  }

  return (
    <Dialog open={open} onClose={onSkip} fullWidth maxWidth="xs">
      <DialogTitle>Vælg Google-kalendere</DialogTitle>

      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
          <DialogContentText>
            Hvilke af dine Google-kalendere skal vises i familie-appen? Du kan
            altid ændre det senere under "Vis kalendere" på Kalender-siden.
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
