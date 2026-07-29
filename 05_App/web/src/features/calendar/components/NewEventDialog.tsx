import {
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
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
  toDateInputValue,
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
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import type { CalendarOwner } from "../data/calendarOwners";

interface NewEventDialogProps {
  open: boolean;
  initialDate: Date;
  events: CalendarEvent[];
  calendarSources: readonly CalendarSource[];
  members: readonly CalendarOwner[];
  isSaving: boolean;
  onClose: () => void;
  onCreate: (
    input: CreateCalendarEventInput,
  ) => Promise<void>;
}

const validationMessages: EventFormValidationMessages = {
  titleRequired: "Skriv en titel på aftalen.",
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
  calendarSources,
  members,
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

  const [requestedSourceId, setRequestedSourceId] = useState("local:family");
  const selectedSource =
    calendarSources.find((source) => source.id === requestedSourceId) ??
    calendarSources.find((source) => !source.isReadOnly);
  const sourceId = selectedSource?.id ?? "";

  const [
    isDiscardConfirmationVisible,
    setIsDiscardConfirmationVisible,
  ] = useState(false);

  const {
    validationErrorCode,
    validationErrors,
    firstInvalidField,
  } =
    useEventValidation(form, selectedSource?.providerType !== "google");

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

  const initialDateMs = initialDate.getTime();

  const [resetSignature, setResetSignature] = useState({
    wasOpen: open,
    initialDateMs,
  });

  const justOpened = open && !resetSignature.wasOpen;
  const dateChangedWhileOpen =
    open &&
    resetSignature.wasOpen &&
    resetSignature.initialDateMs !== initialDateMs;

  if (justOpened || dateChangedWhileOpen) {
    reset();
    setSubmitError(null);
    setIsDiscardConfirmationVisible(false);
    resetValidationFeedback();
  }

  if (
    resetSignature.wasOpen !== open ||
    resetSignature.initialDateMs !== initialDateMs
  ) {
    setResetSignature({ wasOpen: open, initialDateMs });
  }

  const { isDirty } = useUnsavedChanges(
    initialFormState,
    form,
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
    if (validationError) {
      showAllErrorsAndFocusFirst();

      return;
    }

    const input: CreateCalendarEventInput =
      {
        title:
          form.title.trim(),

        allDay:
          form.allDay,

        ownerIds: selectedSource?.providerType === "google" ? [] : [...form.ownerIds],
        sourceId,

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
          <TextField
            select
            label="Kalender"
            value={sourceId}
            onChange={(event) => setRequestedSourceId(event.target.value)}
            disabled={isSaving}
            fullWidth
          >
            {calendarSources.map((source) => (
              <MenuItem key={source.id} value={source.id} disabled={source.isReadOnly}>
                {source.name}{source.isReadOnly ? " (skrivebeskyttet)" : ""}
              </MenuItem>
            ))}
          </TextField>
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
            error={Boolean(
              getVisibleErrorMessage("title"),
            )}
            helperText={getVisibleErrorMessage("title")}
            inputRef={fieldRefs.title}
            onChange={(event) =>
              setField(
                "title",
                event.target.value,
              )
            }
            onBlur={() => markFieldTouched("title")}
            onFocus={() => markFieldFocused("title")}
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
            allDayLabel="Hele dagen"
            dateFieldsFullWidth
          />

          {selectedSource?.providerType !== "google" && (
            <EventParticipantsSection
              ownerIds={form.ownerIds}
              members={members}
              disabled={isSaving}
              onToggleOwner={(ownerId) => {
                toggleParticipant(ownerId);
                markFieldTouched("ownerIds");
              }}
              title="Kalender og deltagere"
              variant="chips"
              errorText={getVisibleErrorMessage("ownerIds")}
            />
          )}

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

        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
        }}
      >
        <Button
          onClick={handleCloseRequest}
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
            isSaving || !selectedSource
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

    <ConfirmDiscardDialog
      open={isDiscardConfirmationVisible}
      onContinueEditing={handleContinueEditing}
      onDiscard={handleDiscardChanges}
    />
    </>
  );
}

export default NewEventDialog;
