import type { EventFormState } from "./eventFormTypes";

export type EventFormValidationErrorCode =
  | "titleRequired"
  | "startDateRequired"
  | "endDateRequired"
  | "endDateBeforeStartDate"
  | "ownerRequired"
  | "endTimeBeforeStartTime";

export type EventFormValidationMessages = Record<
  EventFormValidationErrorCode,
  string
>;

export function validateEventForm(
  form: EventFormState,
): EventFormValidationErrorCode | null {
  if (!form.title.trim()) {
    return "titleRequired";
  }

  if (!form.startDate) {
    return "startDateRequired";
  }

  if (!form.endDate) {
    return "endDateRequired";
  }

  if (form.endDate < form.startDate) {
    return "endDateBeforeStartDate";
  }

  if (form.ownerIds.length === 0) {
    return "ownerRequired";
  }

  if (
    !form.allDay &&
    form.startDate === form.endDate &&
    form.endTime <= form.startTime
  ) {
    return "endTimeBeforeStartTime";
  }

  return null;
}
