// Delt fetch-wrapper for alle *Api.ts-klienter (Sprint 31: fandtes tidligere
// som 6 identiske kopier — se statusrapporten 2026-08-26). Ingen ændring i
// adfærd, kun i hvor koden bor.

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const data = (await response.json().catch(() => ({}))) as T;

  return { ok: response.ok, status: response.status, data };
}
