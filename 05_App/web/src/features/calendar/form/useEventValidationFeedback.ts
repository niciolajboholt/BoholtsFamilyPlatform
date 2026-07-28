import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  EventFormValidationErrorCode,
  EventFormValidationErrors,
  EventFormValidationField,
} from "./eventFormValidation";

type EventFormFieldRefs = Record<
  Exclude<EventFormValidationField, "ownerIds">,
  React.RefObject<HTMLInputElement | null>
>;

export interface UseEventValidationFeedbackResult {
  fieldRefs: EventFormFieldRefs;
  getVisibleError: (
    field: EventFormValidationField,
  ) => EventFormValidationErrorCode | null;
  markFieldTouched: (
    field: EventFormValidationField,
  ) => void;
  markFieldFocused: (
    field: EventFormValidationField,
  ) => void;
  showAllErrorsAndFocusFirst: () => void;
  resetValidationFeedback: () => void;
}

export function useEventValidationFeedback(
  validationErrors: EventFormValidationErrors,
  firstInvalidField: EventFormValidationField | null,
): UseEventValidationFeedbackResult {
  const [
    touchedFields,
    setTouchedFields,
  ] = useState<
    Partial<
      Record<EventFormValidationField, boolean>
    >
  >({});
  const [
    focusedFields,
    setFocusedFields,
  ] = useState<
    Partial<
      Record<EventFormValidationField, boolean>
    >
  >({});
  const [
    hasSubmitted,
    setHasSubmitted,
  ] = useState(false);

  const fieldRefs: EventFormFieldRefs = {
    title: useRef<HTMLInputElement>(null),
    startDate: useRef<HTMLInputElement>(null),
    startTime: useRef<HTMLInputElement>(null),
    endDate: useRef<HTMLInputElement>(null),
    endTime: useRef<HTMLInputElement>(null),
  };

  const visibleErrors = useMemo(() => {
    const errors: EventFormValidationErrors = {};

    for (const [field, errorCode] of Object.entries(
      validationErrors,
    ) as [
      EventFormValidationField,
      EventFormValidationErrorCode,
    ][]) {
      if (hasSubmitted || touchedFields[field]) {
        errors[field] = errorCode;
      }
    }

    return errors;
  }, [hasSubmitted, touchedFields, validationErrors]);

  function markFieldTouched(
    field: EventFormValidationField,
  ) {
    if (!focusedFields[field]) {
      return;
    }

    setTouchedFields((currentFields) => ({
      ...currentFields,
      [field]: true,
    }));
  }

  function markFieldFocused(
    field: EventFormValidationField,
  ) {
    setFocusedFields((currentFields) => ({
      ...currentFields,
      [field]: true,
    }));
  }

  function showAllErrorsAndFocusFirst() {
    setHasSubmitted(true);

    if (
      firstInvalidField &&
      firstInvalidField !== "ownerIds"
    ) {
      fieldRefs[firstInvalidField].current?.focus();
    }
  }

  const resetValidationFeedback = useCallback(() => {
    setTouchedFields({});
    setFocusedFields({});
    setHasSubmitted(false);
  }, []);

  function getVisibleError(
    field: EventFormValidationField,
  ): EventFormValidationErrorCode | null {
    return visibleErrors[field] ?? null;
  }

  return {
    fieldRefs,
    getVisibleError,
    markFieldTouched,
    markFieldFocused,
    showAllErrorsAndFocusFirst,
    resetValidationFeedback,
  };
}
