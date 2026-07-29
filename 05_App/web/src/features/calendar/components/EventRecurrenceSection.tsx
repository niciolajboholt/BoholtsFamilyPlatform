import { useState } from "react";

import { Alert, Box, MenuItem, TextField, Typography } from "@mui/material";

import { RecurrenceDialog } from "./RecurrenceDialog";
import {
  defaultRecurrenceFormValue,
  describeRecurrenceFormValue,
  getRecurrenceDefaultsForStartDate,
  getRecurrencePresetOption,
  type RecurrenceFormValue,
  type RecurrencePresetOption,
} from "../form/recurrenceFormValue";

interface EventRecurrenceSectionProps {
  value: RecurrenceFormValue;
  eventStartDate: string;
  disabled: boolean;
  errorMessage: string | null;
  onChange: (value: RecurrenceFormValue) => void;
}

const presetOptions: { value: RecurrencePresetOption; label: string }[] = [
  { value: "none", label: "Aldrig" },
  { value: "daily", label: "Hver dag" },
  { value: "weekly", label: "Hver uge" },
  { value: "monthly", label: "Hver måned" },
  { value: "yearly", label: "Hvert år" },
  { value: "custom", label: "Tilpas…" },
];

export function EventRecurrenceSection({
  value,
  eventStartDate,
  disabled,
  errorMessage,
  onChange,
}: EventRecurrenceSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const selectedPreset = getRecurrencePresetOption(value, eventStartDate);

  function handlePresetChange(preset: RecurrencePresetOption) {
    if (preset === "custom") {
      // Åbner "Tilpas"-dialogen — hvis der ikke allerede er en gentagelse i
      // gang, sættes en fornuftig standard (ugentligt, på aftalens egen
      // ugedag) som udgangspunkt, ligesom Apple Kalender gør.
      if (value.frequency === "none") {
        onChange({
          ...defaultRecurrenceFormValue,
          frequency: "weekly",
          ...getRecurrenceDefaultsForStartDate(eventStartDate),
        });
      }

      setIsDialogOpen(true);
      return;
    }

    if (preset === "none") {
      onChange(defaultRecurrenceFormValue);
      return;
    }

    const defaults = getRecurrenceDefaultsForStartDate(eventStartDate);

    onChange({
      ...defaultRecurrenceFormValue,
      frequency: preset,
      byWeekdays: defaults.byWeekdays,
      byMonthDay: defaults.byMonthDay,
      ordinal: defaults.ordinal,
      ordinalWeekday: defaults.ordinalWeekday,
    });
  }

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <TextField
        select
        label="Gentages"
        value={selectedPreset}
        disabled={disabled}
        fullWidth
        onChange={(event) =>
          handlePresetChange(event.target.value as RecurrencePresetOption)
        }
      >
        {presetOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {value.frequency !== "none" && (
        <Typography variant="body2" color="text.secondary">
          {describeRecurrenceFormValue(value, eventStartDate)}
        </Typography>
      )}

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <RecurrenceDialog
        open={isDialogOpen}
        value={value}
        eventStartDate={eventStartDate}
        onCancel={() => setIsDialogOpen(false)}
        onApply={(nextValue) => {
          onChange(nextValue);
          setIsDialogOpen(false);
        }}
      />
    </Box>
  );
}
