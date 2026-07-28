import type { EventFormState } from "./eventFormTypes";

export type EventFormValidationErrorCode =
  | "titleRequired"
  | "startDateRequired"
  | "startTimeRequired"
  | "endDateRequired"
  | "endTimeRequired"
  | "endDateBeforeStartDate"
  | "ownerRequired"
  | "endTimeBeforeStartTime";

export type EventFormValidationField =
  | "title"
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime"
  | "ownerIds";

export type EventFormValidationErrors = Partial<
  Record<
    EventFormValidationField,
    EventFormValidationErrorCode
  >
>;

export type EventFormValidationMessages = Record<
  EventFormValidationErrorCode,
  string
>;

export function validateEventForm(
  form: EventFormState,
  requireOwner = true,
): EventFormValidationErrors {
  const errors: EventFormValidationErrors = {};

  if (!form.title.trim()) {
    errors.title = "titleRequired";
  }

  if (!form.startDate) {
    errors.startDate = "startDateRequired";
  }

  if (!form.allDay && !form.startTime) {
    errors.startTime = "startTimeRequired";
  }

  if (!form.endDate) {
    errors.endDate = "endDateRequired";
  }

  if (!form.allDay && !form.endTime) {
    errors.endTime = "endTimeRequired";
  }

  if (
    form.startDate &&
    form.endDate &&
    form.endDate < form.startDate
  ) {
    errors.endDate = "endDateBeforeStartDate";
  }

  if (
    !form.allDay &&
    form.startDate === form.endDate &&
    form.startTime &&
    form.endTime &&
    form.endTime <= form.startTime
  ) {
    errors.endTime = "endTimeBeforeStartTime";
  }

  if (requireOwner && form.ownerIds.length === 0) {
    errors.ownerIds = "ownerRequired";
  }

  return errors;
}
