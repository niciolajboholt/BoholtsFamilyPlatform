import type { RefObject } from "react";

import {
  Box,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import { DanishDateField, DanishTimeField } from "../../../components/DanishDateTimeFields";
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
        <DanishDateField
          label="Startdato"
          value={form.startDate}
          required
          error={Boolean(startDateError)}
          helperText={startDateError}
          fullWidth={dateFieldsFullWidth}
          disabled={disabled}
          inputRef={inputRefs.startDate}
          onChange={onStartDateChange}
          onBlur={onStartDateBlur}
          onFocus={onStartDateFocus}
        />

        <DanishDateField
          label="Slutdato"
          value={form.endDate}
          required
          error={Boolean(endDateError)}
          helperText={endDateError}
          fullWidth={dateFieldsFullWidth}
          disabled={disabled}
          inputRef={inputRefs.endDate}
          minDate={form.startDate}
          onChange={onEndDateChange}
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
          <DanishTimeField
            label="Starttid"
            value={form.startTime}
            required
            error={Boolean(startTimeError)}
            helperText={startTimeError}
            disabled={disabled}
            inputRef={inputRefs.startTime}
            onChange={onStartTimeChange}
            onBlur={onStartTimeBlur}
            onFocus={onStartTimeFocus}
          />

          <DanishTimeField
            label="Sluttid"
            value={form.endTime}
            required
            error={Boolean(endTimeError)}
            helperText={endTimeError}
            disabled={disabled}
            inputRef={inputRefs.endTime}
            onChange={onEndTimeChange}
            onBlur={onEndTimeBlur}
            onFocus={onEndTimeFocus}
          />
        </Box>
      )}
    </>
  );
}
