type LogContextValue = string | number | boolean | null | undefined;

export function logError(
  message: string,
  error?: unknown,
  context: Record<string, LogContextValue> = {},
): void {
  console.error(JSON.stringify({
    message,
    ...context,
    ...(error === undefined
      ? {}
      : { error: error instanceof Error ? error.message : String(error) }),
  }));
}
