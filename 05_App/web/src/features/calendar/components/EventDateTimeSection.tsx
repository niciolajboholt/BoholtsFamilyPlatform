import type { RefObject } from "react";

import {
  Box,
  Checkbox,
  FormControlLabel,
  TextField,
} from "@mui/material";

import type { EventFormState } from "../form/eventFormTypes";

interface EventDateTimeSectionProps {
  form: EventFormState;
  disabled: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onAllDayChange: (value: boolean) => void;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onStartDateBlur: () => void;
  onStartDateFocus: () => void;
  onEndDateBlur: () => void;
  onEndDateFocus: () => void;
  onStartTimeBlur: () => void;
  onStartTimeFocus: () => void;
  onEndTimeBlur: () => void;
  onEndTimeFocus: () => void;
  startDateError: string | null;
  endDateError: string | null;
  startTimeError: string | null;
  endTimeError: string | null;
  inputRefs: {
    startDate: RefObject<HTMLInputElement | null>;
    endDate: RefObject<HTMLInputElement | null>;
    startTime: RefObject<HTMLInputElement | null>;
    endTime: RefObject<HTMLInputElement | null>;
  };
  allDayLabel: string;
  dateFieldsFullWidth: boolean;
}

export function EventDateTimeSection({
  form,
  disabled,
  onStartDateChange,
  onEndDateChange,
  onAllDayChange,
  onStartTimeChange,
  onEndTimeChange,
  onStartDateBlur,
  onStartDateFocus,
  onEndDateBlur,
  onEndDateFocus,
  onStartTimeBlur,
  onStartTimeFocus,
  onEndTimeBlur,
  onEndTimeFocus,
  startDateError,
  endDateError,
  startTimeError,
  endTimeError,
  inputRefs,
  allDayLabel,
  dateFieldsFullWidth,
}: EventDateTimeSectionProps) {
  return (
    <>
      <Box
        sx={{
          display: "grid",

          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
          },

          gap: 2,
        }}
      >
        <TextField
          label="Startdato"
          type="date"
          value={form.startDate}
          required
          error={Boolean(startDateError)}
          helperText={startDateError}
          fullWidth={dateFieldsFullWidth}
          disabled={disabled}
          inputRef={inputRefs.startDate}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
          onChange={(event) =>
            onStartDateChange(event.target.value)
          }
          onBlur={onStartDateBlur}
          onFocus={onStartDateFocus}
        />

        <TextField
          label="Slutdato"
          type="date"
          value={form.endDate}
          required
          error={Boolean(endDateError)}
          helperText={endDateError}
          fullWidth={dateFieldsFullWidth}
          disabled={disabled}
          inputRef={inputRefs.endDate}
          slotProps={{
            inputLabel: {
              shrink: true,
            },

            htmlInput: {
              min: form.startDate || undefined,
            },
          }}
          onChange={(event) =>
            onEndDateChange(event.target.value)
          }
          onBlur={onEndDateBlur}
          onFocus={onEndDateFocus}
        />
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            checked={form.allDay}
            disabled={disabled}
            onChange={(event) =>
              onAllDayChange(event.target.checked)
            }
          />
        }
        label={allDayLabel}
      />

      {!form.allDay && (
        <Box
          sx={{
            display: "grid",

            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
            },

            gap: 2,
          }}
        >
          <TextField
            label="Starttid"
            type="time"
            value={form.startTime}
            required
            error={Boolean(startTimeError)}
            helperText={startTimeError}
            disabled={disabled}
            inputRef={inputRefs.startTime}
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            onChange={(event) =>
              onStartTimeChange(event.target.value)
            }
            onBlur={onStartTimeBlur}
            onFocus={onStartTimeFocus}
          />

          <TextField
            label="Sluttid"
            type="time"
            value={form.endTime}
            required
            error={Boolean(endTimeError)}
            helperText={endTimeError}
            disabled={disabled}
            inputRef={inputRefs.endTime}
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            onChange={(event) =>
              onEndTimeChange(event.target.value)
            }
            onBlur={onEndTimeBlur}
            onFocus={onEndTimeFocus}
          />
        </Box>
      )}
    </>
  );
}
