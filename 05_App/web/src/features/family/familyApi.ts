// Tynd klient for /api/families-ruterne (Fase 2). Svarene mappes til
// CalendarOwner[]-formen i bridgeMembersToCalendarOwners, ikke her — denne
// fil kender kun til serverens rå JSON-form.

export interface FamilyMemberDto {
  id: string;
  name: string;
  color: string;
  relation: string | null;
  isPlaceholderName: number;
  linkedUserId: string | null;
}

export interface FamilyDto {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
}

export type FamilyRole = "owner" | "admin" | "member";

export interface FamilyResponse {
  family: FamilyDto | null;
  role?: FamilyRole;
  members?: FamilyMemberDto[];
  inviteCode?: string | null;
}

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

export function getMyFamily() {
  return request<FamilyResponse>("/api/families/mine");
}

export function createFamily(name: string) {
  return request<FamilyResponse & { error?: string }>("/api/families", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function acceptInvite(code: string) {
  return request<FamilyResponse & { error?: string }>(
    `/api/families/invites/${encodeURIComponent(code)}/accept`,
    { method: "POST" },
  );
}

export function regenerateInvite(familyId: string) {
  return request<{ inviteCode?: string; error?: string }>(
    `/api/families/${familyId}/invites/regenerate`,
    { method: "POST" },
  );
}

export function renameFamily(familyId: string, name: string) {
  return request<{ family?: FamilyDto; error?: string }>(
    `/api/families/${familyId}`,
    { method: "PATCH", body: JSON.stringify({ name }) },
  );
}

export function addFamilyMember(
  familyId: string,
  member: { name: string; color: string; relation?: string | null },
) {
  return request<{ members?: FamilyMemberDto[]; error?: string }>(
    `/api/families/${familyId}/members`,
    { method: "POST", body: JSON.stringify(member) },
  );
}

export function updateFamilyMember(
  familyId: string,
  memberId: string,
  patch: { name?: string; color?: string; relation?: string | null },
) {
  return request<{ members?: FamilyMemberDto[]; error?: string }>(
    `/api/families/${familyId}/members/${memberId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export function linkFamilyMemberToMe(familyId: string, memberId: string) {
  return request<{ members?: FamilyMemberDto[]; error?: string }>(
    `/api/families/${familyId}/members/${memberId}/link-me`,
    { method: "POST" },
  );
}

export function deleteFamilyMember(familyId: string, memberId: string) {
  return request<{ members?: FamilyMemberDto[]; error?: string }>(
    `/api/families/${familyId}/members/${memberId}`,
    { method: "DELETE" },
  );
}

export function changeMemberRole(
  familyId: string,
  userId: string,
  role: "admin" | "member",
) {
  return request<{ ok?: boolean; error?: string }>(
    `/api/families/${familyId}/memberships/${userId}/role`,
    { method: "POST", body: JSON.stringify({ role }) },
  );
}

export function transferOwnership(familyId: string, newOwnerUserId: string) {
  return request<{ family?: FamilyDto; error?: string }>(
    `/api/families/${familyId}/transfer-ownership`,
    { method: "POST", body: JSON.stringify({ newOwnerUserId }) },
  );
}

export function removeMembership(familyId: string, userId: string) {
  return request<{ ok?: boolean; error?: string }>(
    `/api/families/${familyId}/memberships/${userId}`,
    { method: "DELETE" },
  );
}

export interface CalendarMemberMappingDto {
  googleCalendarId: string;
  familyMemberId: string;
}

export function getCalendarMappings(familyId: string) {
  return request<{ mappings?: CalendarMemberMappingDto[]; error?: string }>(
    `/api/families/${familyId}/calendar-mappings`,
  );
}

export function setCalendarMapping(
  familyId: string,
  calendarId: string,
  familyMemberId: string,
) {
  return request<{ mappings?: CalendarMemberMappingDto[]; error?: string }>(
    `/api/families/${familyId}/calendar-mappings/${encodeURIComponent(calendarId)}`,
    { method: "PUT", body: JSON.stringify({ familyMemberId }) },
  );
}

export function deleteCalendarMapping(familyId: string, calendarId: string) {
  return request<{ mappings?: CalendarMemberMappingDto[]; error?: string }>(
    `/api/families/${familyId}/calendar-mappings/${encodeURIComponent(calendarId)}`,
    { method: "DELETE" },
  );
}

export function clearAllCalendarMappings(familyId: string) {
  return request<{ mappings?: CalendarMemberMappingDto[]; error?: string }>(
    `/api/families/${familyId}/calendar-mappings`,
    { method: "DELETE" },
  );
}

// Sprint 26: read-only delelink til familiens kalender.
export interface ShareLinkDto {
  token: string;
  includedMemberIds: string[];
}

export function getShareLink(familyId: string) {
  return request<{ shareLink?: ShareLinkDto | null; error?: string }>(
    `/api/families/${familyId}/share-link`,
  );
}

export function createShareLink(familyId: string, memberIds: string[]) {
  return request<{ shareLink?: ShareLinkDto; error?: string }>(
    `/api/families/${familyId}/share-link`,
    { method: "POST", body: JSON.stringify({ memberIds }) },
  );
}

export function deleteShareLink(familyId: string) {
  return request<{ ok?: boolean; error?: string }>(
    `/api/families/${familyId}/share-link`,
    { method: "DELETE" },
  );
}
