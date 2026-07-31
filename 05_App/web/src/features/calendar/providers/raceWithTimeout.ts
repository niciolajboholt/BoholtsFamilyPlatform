// Races a promise against a timeout without ever rejecting — used so a
// silent-reconnect attempt an external provider never responds to (e.g.
// because it requires an interactive prompt) can't hang the app forever.
// Shared by every provider's session class (Google, Outlook, ...).
export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutValue: T,
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(timeoutValue), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(timeoutValue);
      },
    );
  });
}
