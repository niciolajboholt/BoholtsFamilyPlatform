import {
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
  type DialogProps,
} from "@mui/material";

import { ConfirmDiscardDialog } from "./ConfirmDiscardDialog";
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
import { useUnsavedChanges } from "../form/useUnsavedChanges";
import { useEventValidation } from "../form/useEventValidation";
import { useEventValidationFeedback } from "../form/useEventValidationFeedback";
import {
  type EventFormValidationMessages,
} from "../form/eventFormValidation";
import type {
  CalendarEvent,
} from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import type { CalendarOwner } from "../data/calendarOwners";

interface EditEventDialogProps {
  open: boolean;
  event: CalendarEvent | null;
  events: CalendarEvent[];
  calendarSources: readonly CalendarSource[];
  members: readonly CalendarOwner[];
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
  startTimeRequired: "Angiv et starttidspunkt.",
  endDateRequired: "Vælg en slutdato.",
  endTimeRequired: "Angiv et sluttidspunkt.",
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
  calendarSources,
  members,
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

  const [
    isDiscardConfirmationVisible,
    setIsDiscardConfirmationVisible,
  ] = useState(false);

  const eventSource = event
    ? calendarSources.find(
      (source) => source.id === event.sourceId,
    )
    : undefined;
  const isInternalEvent = eventSource?.isReadOnly === false;

  const {
    validationErrorCode,
    validationErrors,
    firstInvalidField,
  } =
    useEventValidation(
      formState,
      eventSource?.providerType !== "google",
    );

  const {
    fieldRefs,
    getVisibleError,
    markFieldFocused,
    markFieldTouched,
    resetValidationFeedback,
    showAllErrorsAndFocusFirst,
  } = useEventValidationFeedback(
    validationErrors,
    firstInvalidField,
  );

  const eventId = event?.id ?? null;

  const [resetSignature, setResetSignature] = useState({
    wasOpen: open,
    eventId,
  });

  const justOpened = open && !resetSignature.wasOpen;
  const eventChangedWhileOpen =
    open &&
    resetSignature.wasOpen &&
    resetSignature.eventId !== eventId;

  if (justOpened || eventChangedWhileOpen) {
    reset();
    setSubmitError(null);
    setIsDeleteConfirmationVisible(false);
    setIsDiscardConfirmationVisible(false);
    resetValidationFeedback();
  }

  if (
    resetSignature.wasOpen !== open ||
    resetSignature.eventId !== eventId
  ) {
    setResetSignature({ wasOpen: open, eventId });
  }

  const { isDirty } = useUnsavedChanges(
    initialFormState,
    formState,
  );

  const validationError =
    validationErrorCode
      ? validationMessages[
          validationErrorCode
        ]
      : null;

  function getVisibleErrorMessage(
    field: keyof typeof validationErrors,
  ) {
    const errorCode = getVisibleError(field);

    return errorCode
      ? validationMessages[errorCode]
      : null;
  }

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

  function handleCloseRequest() {
    if (isSaving) {
      return;
    }

    if (isDirty) {
      setIsDiscardConfirmationVisible(true);

      return;
    }

    onClose();
  }

  const handleDialogClose: DialogProps["onClose"] =
    () => {
      handleCloseRequest();
    };

  function handleContinueEditing() {
    setIsDiscardConfirmationVisible(false);
  }

  function handleDiscardChanges() {
    setIsDiscardConfirmationVisible(false);
    onClose();
  }

  async function handleSubmit() {
    if (
      !event ||
      validationError
    ) {
      if (validationError) {
        showAllErrorsAndFocusFirst();
      }

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

        ownerIds: event.source === "google"
          ? []
          : [...formState.ownerIds],

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

  return (
    <>
    <Dialog
      open={open}
      onClose={
        isSaving
          ? undefined
          : handleDialogClose
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
              {eventSource?.providerType === "google"
                ? "Denne Google-kalender er skrivebeskyttet."
                : "Kun interne aftaler kan redigeres eller slettes."}
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
            autoFocus={isInternalEvent}
            error={Boolean(
              getVisibleErrorMessage("title"),
            )}
            helperText={getVisibleErrorMessage("title")}
            inputRef={fieldRefs.title}
            onChange={(changeEvent) =>
              setField(
                "title",
                changeEvent.target.value,
              )
            }
            onBlur={() => markFieldTouched("title")}
            onFocus={() => markFieldFocused("title")}
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
            onStartDateBlur={() =>
              markFieldTouched("startDate")
            }
            onStartDateFocus={() =>
              markFieldFocused("startDate")
            }
            onEndDateBlur={() =>
              markFieldTouched("endDate")
            }
            onEndDateFocus={() =>
              markFieldFocused("endDate")
            }
            onStartTimeBlur={() =>
              markFieldTouched("startTime")
            }
            onStartTimeFocus={() =>
              markFieldFocused("startTime")
            }
            onEndTimeBlur={() =>
              markFieldTouched("endTime")
            }
            onEndTimeFocus={() =>
              markFieldFocused("endTime")
            }
            startDateError={getVisibleErrorMessage("startDate")}
            endDateError={getVisibleErrorMessage("endDate")}
            startTimeError={getVisibleErrorMessage("startTime")}
            endTimeError={getVisibleErrorMessage("endTime")}
            inputRefs={fieldRefs}
            allDayLabel="Heldagsaftale"
            dateFieldsFullWidth={false}
          />

          {eventSource?.providerType !== "google" && (
            <EventParticipantsSection
              ownerIds={formState.ownerIds}
              members={members}
              disabled={!isInternalEvent || isSaving}
              onToggleOwner={(ownerId) => {
                toggleParticipant(ownerId);
                markFieldTouched("ownerIds");
              }}
              title="Kalender"
              variant="checkboxes"
              errorText={getVisibleErrorMessage("ownerIds")}
            />
          )}

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
            onClick={handleCloseRequest}
            autoFocus={!isInternalEvent}
          >
            Annuller
          </Button>

          <Button
            variant="contained"
            disabled={
              !isInternalEvent ||
              isSaving
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

    <ConfirmDiscardDialog
      open={isDiscardConfirmationVisible}
      onContinueEditing={handleContinueEditing}
      onDiscard={handleDiscardChanges}
    />
    </>
  );
}

export default EditEventDialog;
