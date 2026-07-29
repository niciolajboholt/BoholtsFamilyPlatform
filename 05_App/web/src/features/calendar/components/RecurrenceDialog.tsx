import { useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import {
  describeRecurrenceFormValue,
  weekdayDisplayOrder,
  weekdayShortLabels,
  type RecurrenceFormValue,
} from "../form/recurrenceFormValue";
import type {
  CalendarWeekday,
  RecurrenceEndType,
  RecurrenceFrequency,
} from "../models/calendarEvent";

const frequencyUnitOptions: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "dag" },
  { value: "weekly", label: "uge" },
  { value: "monthly", label: "måned" },
  { value: "yearly", label: "år" },
];

const endTypeOptions: { value: RecurrenceEndType; label: string }[] = [
  { value: "never", label: "Aldrig" },
  { value: "until", label: "På en dato" },
  { value: "count", label: "Efter et antal gange" },
];

interface RecurrenceDialogProps {
  open: boolean;
  value: RecurrenceFormValue;
  eventStartDate: string;
  onCancel: () => void;
  onApply: (value: RecurrenceFormValue) => void;
}

export function RecurrenceDialog({
  open,
  value,
  eventStartDate,
  onCancel,
  onApply,
}: RecurrenceDialogProps) {
  // Lokalt kladde-udkast — "Annuller" skal kunne forkaste ændringer uden at
  // påvirke den overordnede formular, samme princip som resten af appens
  // dialoger (fx ConfirmDiscardDialog-mønsteret).
  const resetKey = open ? "open" : "closed";
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [draft, setDraft] = useState(value);

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setDraft(value);
  }

  const frequency = draft.frequency === "none" ? "weekly" : draft.frequency;

  function updateDraft(changes: Partial<RecurrenceFormValue>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function toggleWeekday(weekday: CalendarWeekday) {
    updateDraft({
      byWeekdays: draft.byWeekdays.includes(weekday)
        ? draft.byWeekdays.filter((day) => day !== weekday)
        : [...draft.byWeekdays, weekday],
    });
  }

  function handleApply() {
    onApply({ ...draft, frequency });
  }

  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Tilbagevendende aftale</DialogTitle>

      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {describeRecurrenceFormValue(
              { ...draft, frequency },
              eventStartDate,
            )}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ whiteSpace: "nowrap" }}>Gentag hver</Typography>

            <TextField
              type="number"
              value={draft.interval}
              size="small"
              sx={{ width: 80 }}
              slotProps={{ htmlInput: { min: 1 } }}
              onChange={(event) =>
                updateDraft({ interval: Number(event.target.value) || 1 })
              }
            />

            <TextField
              select
              value={frequency}
              size="small"
              sx={{ minWidth: 110 }}
              onChange={(event) =>
                updateDraft({
                  frequency: event.target.value as RecurrenceFrequency,
                })
              }
            >
              {frequencyUnitOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {frequency === "weekly" && (
            <ToggleButtonGroup
              value={draft.byWeekdays}
              size="small"
              aria-label="Ugedage"
              sx={{ flexWrap: "wrap" }}
            >
              {weekdayDisplayOrder.map((weekday) => (
                <ToggleButton
                  key={weekday}
                  value={weekday}
                  selected={draft.byWeekdays.includes(weekday)}
                  onClick={() => toggleWeekday(weekday)}
                  aria-label={weekdayShortLabels[weekday]}
                  sx={{ borderRadius: "50%", width: 40, height: 40, mr: 0.5 }}
                >
                  {weekdayShortLabels[weekday]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          <TextField
            select
            label="Slutter"
            value={draft.endType}
            fullWidth
            onChange={(event) =>
              updateDraft({ endType: event.target.value as RecurrenceEndType })
            }
          >
            {endTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {draft.endType === "until" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                label="Indtil"
                type="date"
                value={draft.until}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(event) => updateDraft({ until: event.target.value })}
              />

              <IconButton
                aria-label="Fjern slutdato"
                onClick={() => updateDraft({ endType: "never", until: "" })}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          )}

          {draft.endType === "count" && (
            <TextField
              label="Antal gange"
              type="number"
              value={draft.count}
              fullWidth
              slotProps={{ htmlInput: { min: 1 } }}
              onChange={(event) =>
                updateDraft({ count: Number(event.target.value) || 1 })
              }
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel}>Annuller</Button>
        <Button variant="contained" onClick={handleApply}>
          Anvend
        </Button>
      </DialogActions>
    </Dialog>
  );
}
