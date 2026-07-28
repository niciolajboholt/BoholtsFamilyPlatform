import {
  useEffect,
  useMemo,
  useState,
} from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

import { EventConflictAlert } from "./EventConflictAlert";
import { EventDateTimeSection } from "./EventDateTimeSection";
import { EventParticipantsSection } from "./EventParticipantsSection";
import {
  createAllDayDate,
  createDateTime,
  ensureEndDateOnOrAfterStartDate,
  subtractOneCalendarDay,
  toDateInputValue,
  toTimeInputValue,
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

interface EditEventDialogProps {
  open: boolean;
  event: CalendarEvent | null;
  events: CalendarEvent[];
  isSaving: boolean;
  onClose: () => void;
  onUpdate: (
    event: CalendarEvent,
  ) => Promise<void>;
  onDelete: (
    eventId: string,
  ) => Promise<void>;
}

const validationMessages: EventFormValidationMessages = {
  titleRequired: "Skriv en titel til aftalen.",
  startDateRequired: "Vælg en startdato.",
  endDateRequired: "Vælg en slutdato.",
  endDateBeforeStartDate:
    "Slutdatoen må ikke ligge før startdatoen.",
  ownerRequired: "Vælg mindst én kalender.",
  endTimeBeforeStartTime:
    "Sluttidspunktet skal ligge efter starttidspunktet.",
};

function createInitialFormState(
  event: CalendarEvent | null,
): EventFormState {
  if (!event) {
    return {
      title: "",
      startDate: "",
      endDate: "",
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      ownerIds: [],
      description: "",
      location: "",
    };
  }

  const startDate = new Date(
    event.start,
  );

  const storedEndDate = new Date(
    event.end,
  );

  const visibleEndDate =
    event.allDay
      ? subtractOneCalendarDay(
          storedEndDate,
        )
      : storedEndDate;

  return {
    title: event.title,
    startDate:
      toDateInputValue(
        startDate,
      ),
    endDate:
      toDateInputValue(
        visibleEndDate,
      ),
    startTime:
      toTimeInputValue(
        startDate,
      ),
    endTime:
      toTimeInputValue(
        storedEndDate,
      ),
    allDay: event.allDay,
    ownerIds: [
      ...event.ownerIds,
    ],
    description:
      event.description ?? "",
    location:
      event.location ?? "",
  };
}

function EditEventDialog({
  open,
  event,
  events,
  isSaving,
  onClose,
  onUpdate,
  onDelete,
}: EditEventDialogProps) {
  const initialFormState =
    useMemo(
      () => createInitialFormState(event),
      [event],
    );

  const {
    values: formState,
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

  const [
    isDeleteConfirmationVisible,
    setIsDeleteConfirmationVisible,
  ] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    reset();

    setSubmitError(null);

    setIsDeleteConfirmationVisible(
      false,
    );
  }, [event, open, reset]);

  const { validationErrorCode } =
    useEventValidation(formState);

  const validationError =
    validationErrorCode
      ? validationMessages[
          validationErrorCode
        ]
      : null;

  const {
    conflicts: conflictingEvents,
  } = useEventConflicts({
    form: formState,
    events,
    validationError,
    excludedEventId: event?.id,
    isEnabled: event !== null,
  });

  function handleStartDateChange(
    value: string,
  ) {
    setField("startDate", value);

    setField(
      "endDate",
      ensureEndDateOnOrAfterStartDate(
        value,
        formState.endDate,
      ),
    );
  }

  async function handleSubmit() {
    if (
      !event ||
      validationError
    ) {
      return;
    }

    setSubmitError(null);

    const start =
      formState.allDay
        ? createAllDayDate(
            formState.startDate,
            false,
          )
        : createDateTime(
            formState.startDate,
            formState.startTime,
          );

    const end =
      formState.allDay
        ? createAllDayDate(
            formState.endDate,
            true,
          )
        : createDateTime(
            formState.endDate,
            formState.endTime,
          );

    const updatedEvent: CalendarEvent =
      {
        ...event,

        title:
          formState.title.trim(),

        start,
        end,

        allDay:
          formState.allDay,

        ownerIds: [
          ...formState.ownerIds,
        ],

        description:
          formState.description.trim() ||
          undefined,

        location:
          formState.location.trim() ||
          undefined,
      };

    try {
      await onUpdate(
        updatedEvent,
      );

      onClose();
    } catch (
      caughtError: unknown
    ) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke gemmes.",
      );
    }
  }

  async function handleDelete() {
    if (!event) {
      return;
    }

    setSubmitError(null);

    try {
      await onDelete(
        event.id,
      );

      onClose();
    } catch (
      caughtError: unknown
    ) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke slettes.",
      );
    }
  }

  const isInternalEvent =
    event?.source ===
    "internal";

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
        Rediger aftale
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: "flex",
            flexDirection:
              "column",
            gap: 2,
            pt: 1,
          }}
        >
          {!isInternalEvent && (
            <Alert severity="info">
              Kun interne aftaler kan
              redigeres eller slettes.
            </Alert>
          )}

          {submitError && (
            <Alert severity="error">
              {submitError}
            </Alert>
          )}

          <TextField
            label="Titel"
            value={
              formState.title
            }
            disabled={
              !isInternalEvent ||
              isSaving
            }
            required
            autoFocus
            onChange={(changeEvent) =>
              setField(
                "title",
                changeEvent.target.value,
              )
            }
          />

          <EventDateTimeSection
            form={formState}
            disabled={!isInternalEvent || isSaving}
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
            allDayLabel="Heldagsaftale"
            dateFieldsFullWidth={false}
          />

          <EventParticipantsSection
            ownerIds={formState.ownerIds}
            disabled={!isInternalEvent || isSaving}
            onToggleOwner={toggleParticipant}
            title="Kalender"
            variant="checkboxes"
          />

          {conflictingEvents.length >
            0 &&
            isInternalEvent && (
              <EventConflictAlert
                conflicts={conflictingEvents}
                continuationText="Du kan stadig gemme ændringerne."
              />
            )}

          <TextField
            label="Sted"
            value={
              formState.location
            }
            disabled={
              !isInternalEvent ||
              isSaving
            }
            onChange={(changeEvent) =>
              setField(
                "location",
                changeEvent.target.value,
              )
            }
          />

          <TextField
            label="Beskrivelse"
            value={
              formState.description
            }
            disabled={
              !isInternalEvent ||
              isSaving
            }
            multiline
            minRows={3}
            onChange={(changeEvent) =>
              setField(
                "description",
                changeEvent.target.value,
              )
            }
          />

          {validationError &&
            isInternalEvent && (
              <Alert severity="warning">
                {validationError}
              </Alert>
            )}

          {isDeleteConfirmationVisible && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="error"
                  size="small"
                  disabled={isSaving}
                  onClick={() =>
                    void handleDelete()
                  }
                >
                  Bekræft sletning
                </Button>
              }
            >
              Aftalen slettes fra denne
              browser. Den kan
              efterfølgende gendannes
              via Fortryd.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2,

          justifyContent:
            "space-between",
        }}
      >
        <Button
          color="error"
          startIcon={
            <DeleteOutlineIcon />
          }
          disabled={
            !isInternalEvent ||
            isSaving
          }
          onClick={() =>
            setIsDeleteConfirmationVisible(
              true,
            )
          }
        >
          Slet
        </Button>

        <Box
          sx={{
            display: "flex",
            gap: 1,
          }}
        >
          <Button
            disabled={isSaving}
            onClick={onClose}
          >
            Annuller
          </Button>

          <Button
            variant="contained"
            disabled={
              !isInternalEvent ||
              isSaving ||
              Boolean(
                validationError,
              )
            }
            onClick={() =>
              void handleSubmit()
            }
          >
            {isSaving
              ? "Gemmer..."
              : "Gem ændringer"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default EditEventDialog;
