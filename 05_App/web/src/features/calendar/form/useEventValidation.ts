import { useMemo } from "react";

import type { EventFormState } from "./eventFormTypes";
import {
  type EventFormValidationErrors,
  type EventFormValidationErrorCode,
  type EventFormValidationField,
  validateEventForm,
} from "./eventFormValidation";

export interface UseEventValidationResult {
  validationErrors: EventFormValidationErrors;
  validationErrorCode: EventFormValidationErrorCode | null;
  firstInvalidField: EventFormValidationField | null;
}

const validationFieldOrder: EventFormValidationField[] = [
  "title",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "ownerIds",
];

export function useEventValidation(
  form: EventFormState,
  requireOwner = true,
): UseEventValidationResult {
  const validationErrors = useMemo(
    () => validateEventForm(form, requireOwner),
    [form, requireOwner],
  );

  const firstInvalidField =
    validationFieldOrder.find(
      (field) => validationErrors[field],
    ) ?? null;

  const validationErrorCode = firstInvalidField
    ? validationErrors[firstInvalidField] ?? null
    : null;

  return {
    validationErrors,
    validationErrorCode,
    firstInvalidField,
  };
}
