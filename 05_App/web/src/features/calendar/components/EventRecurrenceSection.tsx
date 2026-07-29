import { useState } from "react";

import CloseRounded from "@mui/icons-material/CloseRounded";
import RepeatRounded from "@mui/icons-material/RepeatRounded";
import { Alert, Box, Button, IconButton, Typography } from "@mui/material";

import { RecurrenceDialog } from "./RecurrenceDialog";
import {
  defaultRecurrenceFormValue,
  describeRecurrenceFormValue,
  getDefaultRecurrenceUntil,
  parseEventStartDate,
  type RecurrenceFormValue,
} from "../form/recurrenceFormValue";

interface EventRecurrenceSectionProps {
  value: RecurrenceFormValue;
  eventStartDate: string;
  disabled: boolean;
  errorMessage: string | null;
  onChange: (value: RecurrenceFormValue) => void;
}

export function EventRecurrenceSection({
  value,
  eventStartDate,
  disabled,
  errorMessage,
  onChange,
}: EventRecurrenceSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isRecurring = value.frequency !== "none";

  function handleOpenDialog() {
    if (isRecurring) {
      setIsDialogOpen(true);
      return;
    }

    // Fornuftig standardværdi, når "Tilbagevendende" slås til første gang —
    // ugentligt, på aftalens egen ugedag, med "Indtil" seks måneder frem.
    const parsedStartDate = parseEventStartDate(eventStartDate);
    const startWeekday = Number.isNaN(parsedStartDate.getTime())
      ? undefined
      : (parsedStartDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6);

    onChange({
      ...defaultRecurrenceFormValue,
      frequency: "weekly",
      byWeekdays: startWeekday !== undefined ? [startWeekday] : [],
      endType: "until",
      until: getDefaultRecurrenceUntil(eventStartDate),
    });

    setIsDialogOpen(true);
  }

  function handleRemoveRecurrence() {
    onChange(defaultRecurrenceFormValue);
  }

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          variant={isRecurring ? "contained" : "outlined"}
          color={isRecurring ? "primary" : "inherit"}
          startIcon={<RepeatRounded />}
          disabled={disabled}
          onClick={handleOpenDialog}
        >
          Tilbagevendende
        </Button>

        {isRecurring && (
          <IconButton
            aria-label="Fjern tilbagevendende aftale"
            size="small"
            disabled={disabled}
            onClick={handleRemoveRecurrence}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        )}
      </Box>

      {isRecurring && (
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
