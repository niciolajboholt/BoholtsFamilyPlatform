import { useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  Alert,
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
  weekdayFullNames,
  weekdayOrdinalLabels,
  weekdayOrdinalOptions,
  weekdayShortLabels,
  type RecurrenceFormValue,
} from "../form/recurrenceFormValue";
import type {
  CalendarWeekday,
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurrenceMonthlyPattern,
  WeekdayOrdinal,
} from "../models/calendarEvent";

const frequencyOptions: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Dagligt" },
  { value: "weekly", label: "Ugentligt" },
  { value: "monthly", label: "Månedligt" },
  { value: "yearly", label: "Årligt" },
];

const intervalUnitLabels: Record<RecurrenceFrequency, string> = {
  daily: "dag(e)",
  weekly: "uge(r)",
  monthly: "måned(er)",
  yearly: "år",
};

const endTypeOptions: { value: RecurrenceEndType; label: string }[] = [
  { value: "never", label: "Aldrig" },
  { value: "until", label: "På en dato" },
  { value: "count", label: "Efter et antal gange" },
];

const daysInGrid = Array.from({ length: 31 }, (_, index) => index + 1);

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
      <DialogTitle>Gentag</DialogTitle>

      <DialogContent>
        <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {describeRecurrenceFormValue(
              { ...draft, frequency },
              eventStartDate,
            )}
          </Typography>

          <TextField
            select
            label="Gentagelse"
            value={frequency}
            fullWidth
            onChange={(event) =>
              updateDraft({
                frequency: event.target.value as RecurrenceFrequency,
              })
            }
          >
            {frequencyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ whiteSpace: "nowrap" }}>
              I interval på
            </Typography>

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

            <Typography sx={{ whiteSpace: "nowrap" }}>
              {intervalUnitLabels[frequency]}
            </Typography>
          </Box>

          {frequency === "weekly" && (
            <Box sx={{ display: "grid", gap: 1 }}>
              <Typography variant="body2">på en:</Typography>

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
                    sx={{
                      borderRadius: "50%",
                      width: 40,
                      height: 40,
                      mr: 0.5,
                    }}
                  >
                    {weekdayShortLabels[weekday]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          {frequency === "monthly" && (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <ToggleButtonGroup
                value={draft.monthlyPattern}
                exclusive
                fullWidth
                size="small"
                onChange={(_event, nextPattern: RecurrenceMonthlyPattern | null) => {
                  if (nextPattern) {
                    updateDraft({ monthlyPattern: nextPattern });
                  }
                }}
              >
                <ToggleButton value="dayOfMonth">Hver</ToggleButton>
                <ToggleButton value="dayOfWeek">Den</ToggleButton>
              </ToggleButtonGroup>

              {draft.monthlyPattern === "dayOfMonth" ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 0.5,
                  }}
                >
                  {daysInGrid.map((day) => (
                    <Button
                      key={day}
                      size="small"
                      variant={
                        draft.byMonthDay === day ? "contained" : "text"
                      }
                      onClick={() => updateDraft({ byMonthDay: day })}
                      sx={{ minWidth: 0, px: 0 }}
                    >
                      {day}
                    </Button>
                  ))}
                </Box>
              ) : (
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <TextField
                    select
                    value={draft.ordinal}
                    fullWidth
                    onChange={(event) =>
                      updateDraft({
                        ordinal:
                          event.target.value === "firstAndLast"
                            ? "firstAndLast"
                            : (Number(event.target.value) as WeekdayOrdinal),
                      })
                    }
                  >
                    {weekdayOrdinalOptions.map((ordinal) => (
                      <MenuItem key={ordinal} value={ordinal}>
                        {weekdayOrdinalLabels[ordinal]}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    value={draft.ordinalWeekday}
                    fullWidth
                    onChange={(event) =>
                      updateDraft({
                        ordinalWeekday: Number(
                          event.target.value,
                        ) as CalendarWeekday,
                      })
                    }
                  >
                    {weekdayDisplayOrder.map((weekday) => (
                      <MenuItem key={weekday} value={weekday}>
                        {weekdayFullNames[weekday]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              )}
            </Box>
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

          {frequency === "weekly" && draft.byWeekdays.length === 0 && (
            <Alert severity="error">Vælg mindst én ugedag.</Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel}>Annuller</Button>
        <Button variant="contained" onClick={handleApply}>
          Bekræft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
