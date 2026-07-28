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
          fullWidth={dateFieldsFullWidth}
          disabled={disabled}
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
          onChange={(event) =>
            onStartDateChange(event.target.value)
          }
        />

        <TextField
          label="Slutdato"
          type="date"
          value={form.endDate}
          required
          fullWidth={dateFieldsFullWidth}
          disabled={disabled}
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
            disabled={disabled}
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            onChange={(event) =>
              onStartTimeChange(event.target.value)
            }
          />

          <TextField
            label="Sluttid"
            type="time"
            value={form.endTime}
            required
            disabled={disabled}
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            onChange={(event) =>
              onEndTimeChange(event.target.value)
            }
          />
        </Box>
      )}
    </>
  );
}
