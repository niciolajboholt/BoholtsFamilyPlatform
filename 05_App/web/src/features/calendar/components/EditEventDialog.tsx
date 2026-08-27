import {
  useMemo,
  useState,
} from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { ExpandMoreRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Collapse,
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
import { EventRecurrenceSection } from "./EventRecurrenceSection";
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
import {
  getRecurrenceFormValidationError,
  recurrenceFormValueToRule,
  recurrenceRuleToFormValue,
  type RecurrenceFormValue,
} from "../form/recurrenceFormValue";
import type {
  CalendarEvent,
} from "../models/calendarEvent";
import { isExternalCalendarEventSource } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import { isExternalCalendarProviderType } from "../models/calendarProvider";
import type { RecurrenceExceptionOverride } from "../preferences/recurrenceExceptionsStorage";
import type { CalendarOwner } from "../data/calendarOwners";
import { eventReminderOffsetOptions } from "../eventReminders/eventReminderApi";
import { useEventReminder } from "../eventReminders/useEventReminder";

type EditScope = "occurrence" | "series";

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
  onUpdateOccurrence: (
    masterEventId: string,
    occurrenceStart: string,
    override: RecurrenceExceptionOverride,
  ) => void;
  onDeleteOccurrence: (
    masterEventId: string,
    occurrenceStart: string,
  ) => void;
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
  onUpdateOccurrence,
  onDeleteOccurrence,
}: EditEventDialogProps) {
  // En udfoldet forekomst af en lokal gentagelsesrække (Sprint 16) — Google-
  // forekomster har intet valg her, jf. planen: de redigeres/slettes altid
  // som netop den ene Google-forekomst, uændret ift. eksisterende flow.
  const isRecurringLocalOccurrence =
    Boolean(event?.recurrenceMasterId) && event?.source === "internal";

  const [editScope, setEditScope] = useState<EditScope>("occurrence");

  const masterEvent = event?.recurrenceMasterId
    ? (events.find(
        (candidate) => candidate.id === event.recurrenceMasterId,
      ) ?? null)
    : null;

  const effectiveEvent =
    isRecurringLocalOccurrence && editScope === "series"
      ? masterEvent
      : event;

  const canEditRecurrenceRule =
    !isRecurringLocalOccurrence || editScope === "series";

  const initialFormState =
    useMemo(
      () => createInitialFormState(effectiveEvent),
      [effectiveEvent],
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

  // Åbnes som udgangspunkt, hvis aftalen allerede har indhold i et af
  // felterne herunder — ellers ville en redigering af sted/beskrivelse på
  // en eksisterende aftale kræve et ekstra klik for overhovedet at se dem.
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(() =>
    Boolean(
      initialFormState.location ||
        initialFormState.description ||
        initialFormState.ownerIds.length > 0,
    ),
  );

  const eventSource = effectiveEvent
    ? calendarSources.find(
      (source) => source.id === effectiveEvent.sourceId,
    )
    : undefined;
  const isInternalEvent =
    eventSource?.isReadOnly === false && !effectiveEvent?.privacyRedacted;

  // Kun Google-aftaler kan skifte kalender i dag (se
  // GoogleCalendarProvider.updateEvent — Googles "move"-handling har ingen
  // parallel i den lokale/Outlook-kode endnu). Initialiseres til aftalens
  // NUVÆRENDE kalender, nulstilles sammen med resten af formularen i
  // reset-blokken nedenfor.
  const canChangeCalendar =
    effectiveEvent?.source === "google" && isInternalEvent;
  const [requestedSourceId, setRequestedSourceId] = useState(
    () => effectiveEvent?.sourceId ?? "",
  );

  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(() =>
    recurrenceRuleToFormValue(effectiveEvent?.recurrence),
  );
  const recurrenceError = getRecurrenceFormValidationError(recurrence);

  // Kun Google-aftaler understøtter en påmindelse i dag (se
  // server/routes/eventReminders.ts — event-id'et skal kunne afkodes til en
  // Google-kalender/-aftale). Uafhængig af skrivbarhed, i modsætning til
  // canChangeCalendar ovenfor — man må gerne påmindes om en aftale på en
  // skrivebeskyttet, abonneret kalender, blot ikke redigere selve aftalen.
  const canSetReminder =
    effectiveEvent?.source === "google" && !effectiveEvent.privacyRedacted;
  const { offsetMinutes: reminderOffsetMinutes, setReminder } = useEventReminder(
    canSetReminder ? effectiveEvent.id : null,
  );

  const {
    validationErrorCode,
    validationErrors,
    firstInvalidField,
  } =
    useEventValidation(
      formState,
      !isExternalCalendarProviderType(eventSource?.providerType),
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
  // editScope indgår i nøglen, så et skift mellem "denne forekomst" og
  // "hele rækken" nulstiller formularen til den relevante datakilde
  // (occurrence vs. masterEvent), på samme måde som et helt nyt event gør.
  const resetKey = `${eventId ?? "none"}::${editScope}`;

  const [resetSignature, setResetSignature] = useState({
    wasOpen: open,
    resetKey,
  });

  const justOpened = open && !resetSignature.wasOpen;
  const targetChangedWhileOpen =
    open &&
    resetSignature.wasOpen &&
    resetSignature.resetKey !== resetKey;

  if (justOpened || targetChangedWhileOpen) {
    reset();
    setSubmitError(null);
    setIsDeleteConfirmationVisible(false);
    setIsDiscardConfirmationVisible(false);
    resetValidationFeedback();
    setRequestedSourceId(effectiveEvent?.sourceId ?? "");
    setRecurrence(recurrenceRuleToFormValue(effectiveEvent?.recurrence));
    setIsMoreOptionsOpen(
      Boolean(
        initialFormState.location ||
          initialFormState.description ||
          initialFormState.ownerIds.length > 0,
      ),
    );

    if (justOpened) {
      setEditScope("occurrence");
    }
  }

  if (
    resetSignature.wasOpen !== open ||
    resetSignature.resetKey !== resetKey
  ) {
    setResetSignature({ wasOpen: open, resetKey });
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
    excludedEventId: event?.recurrenceMasterId ?? event?.id,
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

  function handleAllDayChange(value: boolean) {
    setField("allDay", value);

    if (!value) {
      // En heldags-aftales start/slut er begge afledt af midnat samme dag
      // (se createInitialFormState) — starttid og sluttid ville derfor blive
      // ens med det samme, hvis "Heldagsaftale" slås fra uden dette, hvilket
      // udløser "Sluttidspunktet skal ligge efter starttidspunktet", uanset
      // hvad brugeren efterfølgende gør, før de selv har rettet begge felter.
      if (formState.startTime === formState.endTime) {
        setField("startTime", "09:00");
        setField("endTime", "10:00");
      }

      return;
    }

    // En tidsbestemt aftale, der slutter PRÆCIS ved midnat (fx en aftale
    // der varer et helt døgn eller flere), har allerede sin slutdato sat
    // til dagen EFTER sidste hele dag — samme konvention som en heldags-
    // aftales egen (eksklusive) slutdato bruger. Uden dette lægger
    // createAllDayDate (se handleSubmit) endnu en dag oveni, så aftalen
    // bliver én dag for lang, når "Heldagsaftale" slås til.
    if (
      formState.endTime === "00:00" &&
      formState.endDate > formState.startDate
    ) {
      setField(
        "endDate",
        toDateInputValue(
          subtractOneCalendarDay(
            new Date(`${formState.endDate}T00:00:00`),
          ),
        ),
      );
    }
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
      !effectiveEvent ||
      validationError
    ) {
      if (validationError) {
        showAllErrorsAndFocusFirst();
      }

      return;
    }

    if (canEditRecurrenceRule && recurrenceError) {
      setSubmitError(recurrenceError);

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

    const editedFields = {
      title: formState.title.trim(),
      start,
      end,
      allDay: formState.allDay,
      ownerIds:
        isExternalCalendarEventSource(effectiveEvent.source)
          ? []
          : [...formState.ownerIds],
      description:
        formState.description.trim() || undefined,
      location: formState.location.trim() || undefined,
    };

    try {
      if (
        isRecurringLocalOccurrence &&
        editScope === "occurrence" &&
        event?.recurrenceMasterId &&
        event.recurrenceOccurrenceStart
      ) {
        // "Denne forekomst" — skriver en undtagelse i stedet for at kalde
        // onUpdate, som ville fejle (occurrence-id'et er syntetisk og
        // findes ikke i lagringen).
        onUpdateOccurrence(
          event.recurrenceMasterId,
          event.recurrenceOccurrenceStart,
          editedFields,
        );
      } else {
        const updatedEvent: CalendarEvent = {
          ...effectiveEvent,
          ...editedFields,
          sourceId: canChangeCalendar
            ? requestedSourceId
            : effectiveEvent.sourceId,
          recurrence: canEditRecurrenceRule
            ? recurrenceFormValueToRule(recurrence, start)
            : effectiveEvent.recurrence,
        };

        await onUpdate(updatedEvent);
      }

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
    if (!effectiveEvent) {
      return;
    }

    setSubmitError(null);

    try {
      if (
        isRecurringLocalOccurrence &&
        editScope === "occurrence" &&
        event?.recurrenceMasterId &&
        event.recurrenceOccurrenceStart
      ) {
        onDeleteOccurrence(
          event.recurrenceMasterId,
          event.recurrenceOccurrenceStart,
        );
      } else {
        await onDelete(effectiveEvent.id);
      }

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
              {effectiveEvent?.privacyRedacted
                ? "Dette er en privat aftale. Kun det tilknyttede familiemedlem kan se eller redigere detaljerne."
                : isExternalCalendarProviderType(eventSource?.providerType)
                  ? "Denne kalender er skrivebeskyttet."
                  : "Kun interne aftaler kan redigeres eller slettes."}
            </Alert>
          )}

          {isRecurringLocalOccurrence && (
            <TextField
              select
              label="Gælder for"
              value={editScope}
              disabled={!isInternalEvent || isSaving}
              fullWidth
              onChange={(changeEvent) =>
                setEditScope(changeEvent.target.value as EditScope)
              }
            >
              <MenuItem value="occurrence">Kun denne forekomst</MenuItem>
              <MenuItem value="series">Hele rækken</MenuItem>
            </TextField>
          )}

          {canChangeCalendar && (
            <TextField
              select
              label="Hvem gælder aftalen for?"
              value={requestedSourceId}
              disabled={isSaving}
              fullWidth
              onChange={(changeEvent) =>
                setRequestedSourceId(changeEvent.target.value)
              }
            >
              {calendarSources
                .filter((source) => source.providerType === "google")
                .map((source) => (
                  <MenuItem
                    key={source.id}
                    value={source.id}
                    disabled={source.isReadOnly}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: source.color,
                        mr: 1.25,
                        flexShrink: 0,
                      }}
                    />
                    {source.name}
                    {source.isReadOnly ? " (skrivebeskyttet)" : ""}
                  </MenuItem>
                ))}
            </TextField>
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
            onAllDayChange={handleAllDayChange}
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

          {conflictingEvents.length >
            0 &&
            isInternalEvent && (
              <EventConflictAlert
                conflicts={conflictingEvents}
                continuationText="Du kan stadig gemme ændringerne."
              />
            )}

          <Button
            size="small"
            onClick={() => setIsMoreOptionsOpen((current) => !current)}
            endIcon={
              <ExpandMoreRounded
                sx={{
                  transition: "transform 150ms",
                  transform: isMoreOptionsOpen ? "rotate(180deg)" : "none",
                }}
              />
            }
            sx={{ justifySelf: "flex-start", px: 0 }}
          >
            Flere muligheder
          </Button>

          <Collapse in={isMoreOptionsOpen} timeout="auto">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {!isExternalCalendarProviderType(eventSource?.providerType) && canEditRecurrenceRule && (
                <EventRecurrenceSection
                  value={recurrence}
                  eventStartDate={formState.startDate}
                  disabled={!isInternalEvent || isSaving}
                  errorMessage={recurrenceError}
                  onChange={setRecurrence}
                />
              )}

              {!isExternalCalendarProviderType(eventSource?.providerType) && (
                <EventParticipantsSection
                  ownerIds={formState.ownerIds}
                  members={members}
                  disabled={!isInternalEvent || isSaving}
                  onToggleOwner={(ownerId) => {
                    toggleParticipant(ownerId);
                    markFieldTouched("ownerIds");
                  }}
                  title="Hvem gælder aftalen for?"
                  variant="checkboxes"
                  errorText={getVisibleErrorMessage("ownerIds")}
                />
              )}

              {canSetReminder && (
                <TextField
                  select
                  label="Påmindelse"
                  value={reminderOffsetMinutes ?? ""}
                  disabled={isSaving}
                  fullWidth
                  onChange={(changeEvent) =>
                    setReminder(
                      changeEvent.target.value === ""
                        ? null
                        : Number(changeEvent.target.value),
                    )
                  }
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {eventReminderOffsetOptions.map((option) => (
                    <MenuItem key={option.minutes} value={option.minutes}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                label="Sted (valgfrit)"
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
                label="Beskrivelse (valgfrit)"
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
            </Box>
          </Collapse>

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
