import { Alert, Box, MenuItem, TextField } from "@mui/material";

import type { RecurrenceEndType, RecurrenceFrequency } from "../models/calendarEvent";
import type { RecurrenceFormValue } from "../form/recurrenceFormValue";

const frequencyOptions: { value: RecurrenceFrequency | "none"; label: string }[] = [
  { value: "none", label: "Gentages ikke" },
  { value: "daily", label: "Dagligt" },
  { value: "weekly", label: "Ugentligt" },
  { value: "monthly", label: "Månedligt" },
  { value: "yearly", label: "Årligt" },
];

const endTypeOptions: { value: RecurrenceEndType; label: string }[] = [
  { value: "never", label: "Aldrig" },
  { value: "until", label: "På en dato" },
  { value: "count", label: "Efter et antal gange" },
];

interface EventRecurrenceSectionProps {
  value: RecurrenceFormValue;
  disabled: boolean;
  errorMessage: string | null;
}

export interface EventRecurrenceSectionChangeProps {
  onChange: (value: RecurrenceFormValue) => void;
}

export function EventRecurrenceSection({
  value,
  disabled,
  errorMessage,
  onChange,
}: EventRecurrenceSectionProps & EventRecurrenceSectionChangeProps) {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <TextField
        select
        label="Gentages"
        value={value.frequency}
        disabled={disabled}
        fullWidth
        onChange={(event) =>
          onChange({
            ...value,
            frequency: event.target.value as RecurrenceFrequency | "none",
          })
        }
      >
        {frequencyOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {value.frequency !== "none" && (
        <>
          <TextField
            label="Interval"
            type="number"
            value={value.interval}
            disabled={disabled}
            fullWidth
            helperText="Fx 2 = hver anden gang."
            slotProps={{ htmlInput: { min: 1 } }}
            onChange={(event) =>
              onChange({
                ...value,
                interval: Number(event.target.value) || 1,
              })
            }
          />

          <TextField
            select
            label="Slutter"
            value={value.endType}
            disabled={disabled}
            fullWidth
            onChange={(event) =>
              onChange({
                ...value,
                endType: event.target.value as RecurrenceEndType,
              })
            }
          >
            {endTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          {value.endType === "until" && (
            <TextField
              label="Slutdato"
              type="date"
              value={value.until}
              disabled={disabled}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) =>
                onChange({ ...value, until: event.target.value })
              }
            />
          )}

          {value.endType === "count" && (
            <TextField
              label="Antal gange"
              type="number"
              value={value.count}
              disabled={disabled}
              fullWidth
              slotProps={{ htmlInput: { min: 1 } }}
              onChange={(event) =>
                onChange({
                  ...value,
                  count: Number(event.target.value) || 1,
                })
              }
            />
          )}

          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </>
      )}
    </Box>
  );
}
