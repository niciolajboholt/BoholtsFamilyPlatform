// Sprint 50: klient for /api/account/deletion (egen konto) og
// /api/families/:id/deletion + /:id/export (kun ejer for det sidste
// omfang) — se
// 01_Project_Documentation/Development/50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md
// og server/lib/accountDeletion.ts's header-kommentar.

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const data = (await response.json().catch(() => ({}))) as T;

  return { ok: response.ok, status: response.status, data };
}

export interface AccountDeletionPreviewMembership {
  familyId: string;
  familyName: string;
  role: "owner" | "admin" | "member";
  memberCount: number;
}

export function getAccountDeletionPreview() {
  return request<{ memberships: AccountDeletionPreviewMembership[]; error?: string }>(
    "/api/account/deletion/preview",
  );
}

export function requestAccountDeletion() {
  return request<{ purgeAfter?: string; error?: string }>("/api/account/deletion/request", {
    method: "POST",
  });
}

export function cancelAccountDeletion() {
  return request<{ ok?: boolean; error?: string }>("/api/account/deletion/cancel", {
    method: "POST",
  });
}

export interface FamilyDeletionPreview {
  memberCount: number;
  taskCount: number;
  shoppingListCount: number;
  sharedExpenseCount: number;
  mealPlanEntryCount: number;
}

export function getFamilyDeletionPreview(familyId: string) {
  return request<FamilyDeletionPreview & { error?: string }>(
    `/api/families/${familyId}/deletion/preview`,
  );
}

export function requestFamilyDeletion(familyId: string) {
  return request<{ purgeAfter?: string; error?: string }>(
    `/api/families/${familyId}/deletion/request`,
    { method: "POST" },
  );
}

export function cancelFamilyDeletion(familyId: string) {
  return request<{ ok?: boolean; error?: string }>(`/api/families/${familyId}/deletion/cancel`, {
    method: "POST",
  });
}

// En gen-autentificerings-roundtrip er en fuld side-navigation (samme som
// selve login, se LoginPage.tsx), ikke et fetch-kald — /auth/reauth/...
// redirecter til Google/Microsofts samtykke-skærm. returnTo skal være en
// relativ sti (server.ts's safeReturnTo() afviser alt andet).
export function beginReauth(provider: "google" | "microsoft", returnTo: string): void {
  window.location.href = `/auth/reauth/${provider}/begin?returnTo=${encodeURIComponent(returnTo)}`;
}

// Selve eksporten er ikke JSON-svar-formet på samme måde som resten af
// klienten (den skal downloades som fil) — egen implementering i stedet
// for den delte request()-hjælper ovenfor.
export async function downloadFamilyExport(familyId: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`/api/families/${familyId}/export`, { credentials: "same-origin" });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "Eksporten kunne ikke hentes." };
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `hjemmecentralen-familiedata-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);

  return { ok: true };
}
