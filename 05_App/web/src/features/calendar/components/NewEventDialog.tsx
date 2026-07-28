import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import { EventConflictAlert } from "./EventConflictAlert";
import { EventDateTimeSection } from "./EventDateTimeSection";
import {
  createAllDayDate,
  createDateTime,
  ensureEndDateOnOrAfterStartDate,
  toDateInputValue,
} from "../form/eventFormDateUtils";
import type { EventFormState } from "../form/eventFormTypes";
import { useEventConflicts } from "../form/useEventConflicts";
import { useEventFormState } from "../form/useEventFormState";
import { useEventValidation } from "../form/useEventValidation";
import {
  type EventFormValidationMessages,
} from "../form/eventFormValidation";
import type {
  CalendarEvent,
} from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../services/CalendarService";

interface NewEventDialogProps {
  open: boolean;
  initialDate: Date;
  events: CalendarEvent[];
  isSaving: boolean;
  onClose: () => void;
  onCreate: (
    input: CreateCalendarEventInput,
  ) => Promise<void>;
}

const validationMessages: EventFormValidationMessages = {
  titleRequired: "Skriv en titel på aftalen.",
  startDateRequired: "Vælg en startdato.",
  endDateRequired: "Vælg en slutdato.",
  endDateBeforeStartDate:
    "Slutdatoen må ikke ligge før startdatoen.",
  ownerRequired: "Vælg mindst én kalender.",
  endTimeBeforeStartTime:
    "Sluttidspunktet skal ligge efter starttidspunktet.",
};

function createInitialState(
  initialDate: Date,
): EventFormState {
  const date =
    toDateInputValue(initialDate);

  return {
    title: "",
    startDate: date,
    endDate: date,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    ownerIds: ["family"],
    description: "",
    location: "",
  };
}

function NewEventDialog({
  open,
  initialDate,
  events,
  isSaving,
  onClose,
  onCreate,
}: NewEventDialogProps) {
  const initialFormState =
    useMemo(
      () => createInitialState(initialDate),
      [initialDate],
    );

  const {
    values: form,
    setField,
    reset,
    toggleParticipant,
  } = useEventFormState(
    initialFormState,
  );

  const [
    submitError,
    setSubmitError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    reset();

    setSubmitError(null);
  }, [
    open,
    initialDate,
    reset,
  ]);

  const { validationErrorCode } =
    useEventValidation(form);

  const validationError =
    validationErrorCode
      ? validationMessages[
          validationErrorCode
        ]
      : null;

  const {
    conflicts: conflictingEvents,
  } = useEventConflicts({
    form,
    events,
    validationError,
  });

  function handleStartDateChange(
    startDate: string,
  ) {
    setField("startDate", startDate);

    setField(
      "endDate",
      ensureEndDateOnOrAfterStartDate(
        startDate,
        form.endDate,
      ),
    );
  }

  async function handleSubmit() {
    if (validationError) {
      setSubmitError(
        validationError,
      );

      return;
    }

    const input: CreateCalendarEventInput =
      {
        title:
          form.title.trim(),

        allDay:
          form.allDay,

        ownerIds: [
          ...form.ownerIds,
        ],

        start: form.allDay
          ? createAllDayDate(
              form.startDate,
              false,
            )
          : createDateTime(
              form.startDate,
              form.startTime,
            ),

        end: form.allDay
          ? createAllDayDate(
              form.endDate,
              true,
            )
          : createDateTime(
              form.endDate,
              form.endTime,
            ),

        description:
          form.description.trim() ||
          undefined,

        location:
          form.location.trim() ||
          undefined,
      };

    try {
      setSubmitError(null);

      await onCreate(input);

      onClose();
    } catch (
      caughtError: unknown
    ) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke gemmes. Prøv igen.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={
        isSaving
          ? undefined
          : onClose
      }
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Ny aftale
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            pt: 1,
          }}
        >
          {submitError && (
            <Alert severity="error">
              {submitError}
            </Alert>
          )}

          <TextField
            label="Titel"
            value={form.title}
            autoFocus
            required
            fullWidth
            disabled={isSaving}
            onChange={(event) =>
              setField(
                "title",
                event.target.value,
              )
            }
          />

          <EventDateTimeSection
            form={form}
            disabled={isSaving}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={(value) =>
              setField("endDate", value)
            }
            onAllDayChange={(value) =>
              setField("allDay", value)
            }
            onStartTimeChange={(value) =>
              setField("startTime", value)
            }
            onEndTimeChange={(value) =>
              setField("endTime", value)
            }
            allDayLabel="Hele dagen"
            dateFieldsFullWidth
          />

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1 }}
            >
              Kalender og deltagere
            </Typography>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {Object.values(
                calendarOwners,
              ).map((owner) => {
                const isSelected =
                  form.ownerIds.includes(
                    owner.id,
                  );

                return (
                  <Chip
                    key={owner.id}
                    label={owner.name}
                    clickable={
                      !isSaving
                    }
                    disabled={isSaving}
                    onClick={() =>
                      toggleParticipant(
                        owner.id,
                      )
                    }
                    variant={
                      isSelected
                        ? "filled"
                        : "outlined"
                    }
                    sx={{
                      borderColor:
                        owner.color,

                      backgroundColor:
                        isSelected
                          ? owner.color
                          : "transparent",

                      color: isSelected
                        ? "#ffffff"
                        : owner.color,

                      fontWeight: 600,
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {conflictingEvents.length >
            0 && (
              <EventConflictAlert
                conflicts={conflictingEvents}
                continuationText="Du kan stadig oprette aftalen."
              />
          )}

          <TextField
            label="Sted"
            value={
              form.location
            }
            fullWidth
            disabled={isSaving}
            onChange={(event) =>
              setField(
                "location",
                event.target.value,
              )
            }
          />

          <TextField
            label="Beskrivelse"
            value={
              form.description
            }
            fullWidth
            multiline
            minRows={3}
            disabled={isSaving}
            onChange={(event) =>
              setField(
                "description",
                event.target.value,
              )
            }
          />

          {validationError && (
            <Alert severity="warning">
              {validationError}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
        }}
      >
        <Button
          onClick={onClose}
          disabled={isSaving}
        >
          Annuller
        </Button>

        <Button
          variant="contained"
          onClick={() =>
            void handleSubmit()
          }
          disabled={
            isSaving ||
            Boolean(
              validationError,
            )
          }
          startIcon={
            isSaving ? (
              <CircularProgress
                size={18}
                color="inherit"
              />
            ) : undefined
          }
        >
          {isSaving
            ? "Gemmer..."
            : "Opret aftale"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewEventDialog;
