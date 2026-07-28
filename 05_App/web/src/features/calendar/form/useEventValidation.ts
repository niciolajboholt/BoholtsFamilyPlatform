import { useMemo } from "react";

import type { EventFormState } from "./eventFormTypes";
import {
  type EventFormValidationErrorCode,
  validateEventForm,
} from "./eventFormValidation";

export interface UseEventValidationResult {
  validationErrorCode: EventFormValidationErrorCode | null;
}

export function useEventValidation(
  form: EventFormState,
): UseEventValidationResult {
  const validationErrorCode = useMemo(
    () => validateEventForm(form),
    [form],
  );

  return {
    validationErrorCode,
  };
}
