export type CalendarProviderErrorCode =
  | "authentication"
  | "authorization"
  | "network"
  | "not-found"
  | "conflict"
  | "validation"
  | "unavailable"
  | "unknown";

export class CalendarProviderError extends Error {
  readonly code: CalendarProviderErrorCode;

  constructor(
    code: CalendarProviderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CalendarProviderError";
    this.code = code;
  }
}

export function toCalendarProviderError(
  error: unknown,
): CalendarProviderError {
  if (error instanceof CalendarProviderError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message
      : "Der opstod en ukendt fejl.";

  return new CalendarProviderError(
    "unknown",
    message,
    { cause: error },
  );
}
