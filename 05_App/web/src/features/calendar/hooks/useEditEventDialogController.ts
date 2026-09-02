import { useMemo, useState } from "react";

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
import type { EventFormValidationMessages } from "../form/eventFormValidation";
import {
  getRecurrenceFormValidationError,
  recurrenceFormValueToRule,
  recurrenceRuleToFormValue,
  type RecurrenceFormValue,
} from "../form/recurrenceFormValue";
import type { CalendarEvent } from "../models/calendarEvent";
import { isExternalCalendarEventSource } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import { isExternalCalendarProviderType } from "../models/calendarProvider";
import type { RecurrenceExceptionOverride } from "../preferences/recurrenceExceptionsStorage";
import { useEventReminder } from "../eventReminders/useEventReminder";

export type EditScope = "occurrence" | "series";

export interface UseEditEventDialogControllerArgs {
  open: boolean;
  event: CalendarEvent | null;
  events: CalendarEvent[];
  calendarSources: readonly CalendarSource[];
  isSaving: boolean;
  onClose: () => void;
  onUpdate: (event: CalendarEvent) => Promise<void>;
  onDelete: (eventId: string, sourceId?: string) => Promise<void>;
  onUpdateOccurrence: (
    masterEventId: string,
    occurrenceStart: string,
    override: RecurrenceExceptionOverride,
  ) => void;
  onDeleteOccurrence: (masterEventId: string, occurrenceStart: string) => void;
}

const validationMessages: EventFormValidationMessages = {
  titleRequired: "Skriv en titel til aftalen.",
  startDateRequired: "Vælg en startdato.",
  startTimeRequired: "Angiv et starttidspunkt.",
  endDateRequired: "Vælg en slutdato.",
  endTimeRequired: "Angiv et sluttidspunkt.",
  endDateBeforeStartDate: "Slutdatoen må ikke ligge før startdatoen.",
  ownerRequired: "Vælg mindst én kalender.",
  endTimeBeforeStartTime: "Sluttidspunktet skal ligge efter starttidspunktet.",
};

function createInitialFormState(event: CalendarEvent | null): EventFormState {
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
      privacy: "details",
    };
  }

  const startDate = new Date(event.start);
  const storedEndDate = new Date(event.end);
  const visibleEndDate = event.allDay ? subtractOneCalendarDay(storedEndDate) : storedEndDate;

  return {
    title: event.title,
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(visibleEndDate),
    startTime: toTimeInputValue(startDate),
    endTime: toTimeInputValue(storedEndDate),
    allDay: event.allDay,
    ownerIds: [...event.ownerIds],
    description: event.description ?? "",
    location: event.location ?? "",
    privacy: event.privacy === "busy" ? "busy" : "details",
  };
}

export function useEditEventDialogController({
  open,
  event,
  events,
  calendarSources,
  isSaving,
  onClose,
  onUpdate,
  onDelete,
  onUpdateOccurrence,
  onDeleteOccurrence,
}: UseEditEventDialogControllerArgs) {
  // En udfoldet forekomst af en lokal eller Google-baseret gentagelsesrække.
  // Begge får et eksplicit valg mellem denne forekomst og hele rækken.
  const isRecurringLocalOccurrence =
    Boolean(event?.recurrenceMasterId) && event?.source === "internal";
  const isRecurringGoogleOccurrence =
    Boolean(event?.recurrenceMasterId) && event?.source === "google";
  const isRecurringOccurrence = isRecurringLocalOccurrence || isRecurringGoogleOccurrence;

  const [editScope, setEditScope] = useState<EditScope>("occurrence");

  const masterEvent = event?.recurrenceMasterId
    ? (events.find((candidate) => candidate.id === event.recurrenceMasterId) ?? null)
    : null;

  const effectiveEvent =
    isRecurringLocalOccurrence && editScope === "series" ? masterEvent : event;

  // En almindelig Google-aftale kan omdannes til en gentagen serie. Når
  // Google allerede har udfoldet serien til forekomster, styrer appen kun
  // om almindelige feltændringer gælder forekomsten eller hele rækken;
  // selve RRULE-mønsteret ændres fortsat i Google Kalender.
  const canEditRecurrenceRule = effectiveEvent?.source === "google"
    ? !isRecurringGoogleOccurrence
    : !isRecurringLocalOccurrence || editScope === "series";

  const initialFormState = useMemo(() => createInitialFormState(effectiveEvent), [effectiveEvent]);

  const { values: formState, setField, reset, toggleParticipant } = useEventFormState(initialFormState);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isDiscardConfirmationVisible, setIsDiscardConfirmationVisible] = useState(false);

  // Åbnes som udgangspunkt, hvis aftalen allerede har indhold i et af
  // felterne herunder — ellers ville en redigering af sted/beskrivelse på
  // en eksisterende aftale kræve et ekstra klik for overhovedet at se dem.
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(() =>
    Boolean(
      initialFormState.location || initialFormState.description || initialFormState.ownerIds.length > 0,
    ),
  );

  const eventSource = effectiveEvent
    ? calendarSources.find((source) => source.id === effectiveEvent.sourceId)
    : undefined;
  const isInternalEvent = eventSource?.isReadOnly === false && !effectiveEvent?.privacyRedacted;

  // Kun Google-aftaler kan skifte kalender i dag (se
  // GoogleCalendarProvider.updateEvent — Googles "move"-handling har ingen
  // parallel i den lokale/Outlook-kode endnu). Initialiseres til aftalens
  // NUVÆRENDE kalender, nulstilles sammen med resten af formularen i
  // reset-blokken nedenfor.
  const canChangeCalendar = effectiveEvent?.source === "google" && isInternalEvent;
  const [requestedSourceId, setRequestedSourceId] = useState(() => effectiveEvent?.sourceId ?? "");

  const [recurrence, setRecurrence] = useState<RecurrenceFormValue>(() =>
    recurrenceRuleToFormValue(effectiveEvent?.recurrence),
  );
  const recurrenceError = getRecurrenceFormValidationError(recurrence);

  // Kun Google-aftaler understøtter en påmindelse i dag (se
  // server/routes/eventReminders.ts — event-id'et skal kunne afkodes til en
  // Google-kalender/-aftale). Uafhængig af skrivbarhed, i modsætning til
  // canChangeCalendar ovenfor — man må gerne påmindes om en aftale på en
  // skrivebeskyttet, abonneret kalender, blot ikke redigere selve aftalen.
  const canSetReminder = effectiveEvent?.source === "google" && !effectiveEvent.privacyRedacted;
  const { offsetMinutes: reminderOffsetMinutes, setReminder } = useEventReminder(
    canSetReminder ? effectiveEvent.id : null,
  );

  const { validationErrorCode, validationErrors, firstInvalidField } = useEventValidation(
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
  } = useEventValidationFeedback(validationErrors, firstInvalidField);

  const eventId = event?.id ?? null;
  // editScope indgår i nøglen, så et skift mellem "denne forekomst" og
  // "hele rækken" nulstiller formularen til den relevante datakilde
  // (occurrence vs. masterEvent), på samme måde som et helt nyt event gør.
  const resetKey = `${eventId ?? "none"}::${editScope}`;

  const [resetSignature, setResetSignature] = useState({ wasOpen: open, resetKey });

  const justOpened = open && !resetSignature.wasOpen;
  const targetChangedWhileOpen = open && resetSignature.wasOpen && resetSignature.resetKey !== resetKey;

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
        initialFormState.location || initialFormState.description || initialFormState.ownerIds.length > 0,
      ),
    );

    if (justOpened) {
      setEditScope("occurrence");
    }
  }

  if (resetSignature.wasOpen !== open || resetSignature.resetKey !== resetKey) {
    setResetSignature({ wasOpen: open, resetKey });
  }

  const { isDirty } = useUnsavedChanges(initialFormState, formState);

  const validationError = validationErrorCode ? validationMessages[validationErrorCode] : null;

  function getVisibleErrorMessage(field: keyof typeof validationErrors) {
    const errorCode = getVisibleError(field);

    return errorCode ? validationMessages[errorCode] : null;
  }

  const { conflicts: conflictingEvents } = useEventConflicts({
    form: formState,
    events,
    validationError,
    excludedEventId: event?.recurrenceMasterId ?? event?.id,
    isEnabled: event !== null,
  });

  function handleStartDateChange(value: string) {
    setField("startDate", value);
    setField("endDate", ensureEndDateOnOrAfterStartDate(value, formState.endDate));
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
    if (formState.endTime === "00:00" && formState.endDate > formState.startDate) {
      setField(
        "endDate",
        toDateInputValue(subtractOneCalendarDay(new Date(`${formState.endDate}T00:00:00`))),
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

  function handleContinueEditing() {
    setIsDiscardConfirmationVisible(false);
  }

  function handleDiscardChanges() {
    setIsDiscardConfirmationVisible(false);
    onClose();
  }

  async function handleSubmit() {
    if (!effectiveEvent || validationError) {
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

    const start = formState.allDay
      ? createAllDayDate(formState.startDate, false)
      : createDateTime(formState.startDate, formState.startTime);

    const end = formState.allDay
      ? createAllDayDate(formState.endDate, true)
      : createDateTime(formState.endDate, formState.endTime);

    const editedFields = {
      title: formState.title.trim(),
      start,
      end,
      allDay: formState.allDay,
      ownerIds: isExternalCalendarEventSource(effectiveEvent.source) ? [] : [...formState.ownerIds],
      description: formState.description.trim() || undefined,
      location: formState.location.trim() || undefined,
      privacy: formState.privacy === "busy" ? ("busy" as const) : undefined,
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
        onUpdateOccurrence(event.recurrenceMasterId, event.recurrenceOccurrenceStart, editedFields);
      } else {
        const updatedEvent: CalendarEvent = {
          ...effectiveEvent,
          ...editedFields,
          sourceId: canChangeCalendar ? requestedSourceId : effectiveEvent.sourceId,
          recurrence: canEditRecurrenceRule
            ? recurrenceFormValueToRule(recurrence, start)
            : effectiveEvent.recurrence,
          recurrenceEditScope: isRecurringGoogleOccurrence ? editScope : undefined,
          recurrenceOriginalStart: isRecurringGoogleOccurrence ? event?.start : undefined,
          recurrenceOriginalEnd: isRecurringGoogleOccurrence ? event?.end : undefined,
        };

        await onUpdate(updatedEvent);
      }

      onClose();
    } catch (caughtError: unknown) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : "Aftalen kunne ikke gemmes.");
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
        onDeleteOccurrence(event.recurrenceMasterId, event.recurrenceOccurrenceStart);
      } else {
        const targetEventId =
          isRecurringGoogleOccurrence && editScope === "series" && event?.recurrenceMasterId
            ? event.recurrenceMasterId
            : effectiveEvent.id;
        await onDelete(targetEventId, effectiveEvent.sourceId);
      }

      onClose();
    } catch (caughtError: unknown) {
      setSubmitError(caughtError instanceof Error ? caughtError.message : "Aftalen kunne ikke slettes.");
    }
  }

  return {
    isRecurringLocalOccurrence,
    isRecurringOccurrence,
    editScope,
    setEditScope,
    effectiveEvent,
    canEditRecurrenceRule,
    formState,
    setField,
    toggleParticipant,
    submitError,
    isDeleteConfirmationVisible,
    setIsDeleteConfirmationVisible,
    isDiscardConfirmationVisible,
    isMoreOptionsOpen,
    setIsMoreOptionsOpen,
    eventSource,
    isInternalEvent,
    canChangeCalendar,
    requestedSourceId,
    setRequestedSourceId,
    recurrence,
    setRecurrence,
    recurrenceError,
    canSetReminder,
    reminderOffsetMinutes,
    setReminder,
    getVisibleErrorMessage,
    markFieldFocused,
    markFieldTouched,
    fieldRefs,
    conflictingEvents,
    handleStartDateChange,
    handleAllDayChange,
    handleCloseRequest,
    handleContinueEditing,
    handleDiscardChanges,
    handleSubmit,
    handleDelete,
  };
}
