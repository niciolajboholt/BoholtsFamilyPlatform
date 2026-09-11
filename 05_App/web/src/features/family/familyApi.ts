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
  linkedUserEmail: string | null;
  // Sprint 40: "MM-DD", bevidst uden år (se
  // 40_Sprint40_Foedselsdag_Gaveplanlaegning_Plan.md).
  birthday: string | null;
}

export interface FamilyDto {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  aiWeeklySummaryEnabled: number;
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
  patch: { name?: string; color?: string; relation?: string | null; birthday?: string | null },
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

export interface FamilyMembershipDto {
  userId: string;
  email: string;
  name: string;
  role: FamilyRole;
  joinedAt: string;
}

export function getFamilyMemberships(familyId: string) {
  return request<{ memberships?: FamilyMembershipDto[]; error?: string }>(
    `/api/families/${familyId}/memberships`,
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

// Sprint 28: nyeste gemte AI-ugeresumé. Opdelt pr. familiemedlem (samt en
// "Fælles"-sektion for resten) i stedet for én sammenhængende tekst, så
// klienten kan vise hvert navn fremhævet uden selv at skulle gætte på
// tekstens formatering.
export interface WeeklySummarySectionDto {
  name: string;
  text: string;
}

export interface WeeklySummaryDto {
  weekStart: string;
  sections: WeeklySummarySectionDto[];
  createdAt: string;
}

export function getWeeklySummary(familyId: string) {
  return request<{ summary: WeeklySummaryDto | null; error?: string }>(
    `/api/families/${familyId}/weekly-summary`,
  );
}

export function refreshWeeklySummary(familyId: string) {
  return request<{ summary?: WeeklySummaryDto; error?: string }>(
    `/api/families/${familyId}/weekly-summary/refresh`,
    { method: "POST" },
  );
}

export function updateFamilyPrivacySettings(
  familyId: string,
  aiWeeklySummaryEnabled: boolean,
) {
  return request<{ aiWeeklySummaryEnabled?: boolean; error?: string }>(
    `/api/families/${familyId}/privacy-settings`,
    {
      method: "PATCH",
      body: JSON.stringify({ aiWeeklySummaryEnabled }),
    },
  );
}

// Sprint 26: read-only delelink til familiens kalender.
export interface ShareLinkDto {
  token: string;
  includedMemberIds: string[];
  // Sprint 29: tilvalg, slået fra som standard — se ShareLinkCard.
  includeDescription: boolean;
  includeLocation: boolean;
}

export function getShareLink(familyId: string) {
  return request<{ shareLink?: ShareLinkDto | null; error?: string }>(
    `/api/families/${familyId}/share-link`,
  );
}

export function createShareLink(
  familyId: string,
  memberIds: string[],
  fieldOptions: { includeDescription: boolean; includeLocation: boolean },
) {
  return request<{ shareLink?: ShareLinkDto; error?: string }>(
    `/api/families/${familyId}/share-link`,
    { method: "POST", body: JSON.stringify({ memberIds, ...fieldOptions }) },
  );
}

export function deleteShareLink(familyId: string) {
  return request<{ ok?: boolean; error?: string }>(
    `/api/families/${familyId}/share-link`,
    { method: "DELETE" },
  );
}

// Sprint 33 ("Siden sidst du var her"): aktivitet siden brugerens sidste
// besøg i DENNE familie. `hasActivity: false` er bevidst et smallere svar
// (ingen af de øvrige felter er meningsfulde, hvis der intet er at vise) —
// se server/routes/activity.ts.
export interface ActivityCalendarMovedDto {
  title: string;
  oldStart: string | null;
  newStart: string | null;
  // Kun sat, hvis aftalens kalender er kortlagt til et familiemedlem (se
  // calendar_member_mappings) — fx en ICS-abonnementskalender uden
  // medlemstildeling har ingen ejer at vise.
  memberName?: string;
}

export interface ActivityCalendarCancelledDto {
  title: string;
  oldStart: string | null;
  memberName?: string;
}

export interface ActivityCalendarCreatedDto {
  title: string;
  start: string | null;
  memberName?: string;
}

export interface ActivityFamilyMemberDto {
  name: string;
}

export type ActivitySummaryDto =
  | { hasActivity: false; since: string | null; asOf: string }
  | {
      hasActivity: true;
      since: string;
      asOf: string;
      calendar: {
        moved: ActivityCalendarMovedDto[];
        cancelled: ActivityCalendarCancelledDto[];
        created: ActivityCalendarCreatedDto[];
      };
      tasksCompletedCount: number;
      tasksCreatedCount: number;
      shoppingAddedCount: number;
      shoppingCheckedCount: number;
      newFamilyMembers: ActivityFamilyMemberDto[];
      totalCount: number;
    };

// Den indsnævrede variant, komponenter der allerede ved der ER aktivitet
// (dialogerne) kan bruge, uden selv at skulle udelukke `hasActivity: false`.
export type ActiveActivitySummary = Extract<ActivitySummaryDto, { hasActivity: true }>;
export type EmptyActivitySummary = Extract<ActivitySummaryDto, { hasActivity: false }>;

export function getActivitySince(familyId: string) {
  return request<ActivitySummaryDto & { error?: string }>(
    `/api/families/${familyId}/activity/since-last-visit`,
  );
}

export function acknowledgeActivity(familyId: string, asOf: string) {
  return request<{ ok?: boolean; error?: string }>(
    `/api/families/${familyId}/activity/acknowledge`,
    { method: "POST", body: JSON.stringify({ asOf }) },
  );
}

// Fase 9: delte kalendere tilføjet via et ICS-link.
export interface IcsCalendarSubscriptionDto {
  id: string;
  familyId: string;
  url: string;
  label: string;
  familyMemberId: string | null;
  color: string | null;
  lastFetchedAt: string | null;
  lastFetchStatus: string | null;
  createdAt: string;
}

export function getIcsSubscriptions(familyId: string) {
  return request<{ subscriptions?: IcsCalendarSubscriptionDto[]; error?: string }>(
    `/api/families/${familyId}/ics-subscriptions`,
  );
}

export function createIcsSubscription(
  familyId: string,
  input: { url: string; label: string; familyMemberId?: string | null; color?: string | null },
) {
  return request<{ subscriptions?: IcsCalendarSubscriptionDto[]; error?: string }>(
    `/api/families/${familyId}/ics-subscriptions`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateIcsSubscription(
  familyId: string,
  subscriptionId: string,
  input: { url?: string; label?: string; familyMemberId?: string | null; color?: string | null },
) {
  return request<{ subscriptions?: IcsCalendarSubscriptionDto[]; error?: string }>(
    `/api/families/${familyId}/ics-subscriptions/${subscriptionId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteIcsSubscription(familyId: string, subscriptionId: string) {
  return request<{ subscriptions?: IcsCalendarSubscriptionDto[]; error?: string }>(
    `/api/families/${familyId}/ics-subscriptions/${subscriptionId}`,
    { method: "DELETE" },
  );
}

// Fase 9: aftaler for ét ICS-abonnement, allerede hentet/parset/redigeret
// (privatliv, RRULE-udfoldning) server-side af server/lib/icsCalendar.ts.
export interface IcsCalendarEventDto {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
  isPrivate: boolean;
}

export function getIcsSubscriptionEvents(
  familyId: string,
  subscriptionId: string,
  range?: { start: string; end: string },
) {
  const query = range
    ? `?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`
    : "";
  return request<{ events?: IcsCalendarEventDto[]; error?: string }>(
    `/api/families/${familyId}/ics-subscriptions/${subscriptionId}/events${query}`,
  );
}

// Sprint 40: en gaveplan for medlem X skjules server-side for X selv, hvis
// X har en koblet konto (ADR-020) — svaret her viser derfor aldrig
// brugerens egne planer, uanset hvem der spørger.
export interface BirthdayGiftPlanDto {
  id: string;
  familyId: string;
  familyMemberId: string;
  year: number;
  giftIdea: string;
  budgetAmount: number | null;
  isPurchased: number;
  createdByUserId: string;
  createdAt: string;
}

export function getBirthdayGiftPlans(familyId: string) {
  return request<{ plans?: BirthdayGiftPlanDto[]; error?: string }>(
    `/api/families/${familyId}/birthday-gift-plans`,
  );
}

export function createBirthdayGiftPlan(
  familyId: string,
  plan: { familyMemberId: string; year: number; giftIdea: string; budgetAmount?: number | null },
) {
  return request<{ plans?: BirthdayGiftPlanDto[]; error?: string }>(
    `/api/families/${familyId}/birthday-gift-plans`,
    { method: "POST", body: JSON.stringify(plan) },
  );
}

export function updateBirthdayGiftPlan(
  familyId: string,
  planId: string,
  patch: { giftIdea?: string; budgetAmount?: number | null; isPurchased?: boolean },
) {
  return request<{ plans?: BirthdayGiftPlanDto[]; error?: string }>(
    `/api/families/${familyId}/birthday-gift-plans/${planId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export function deleteBirthdayGiftPlan(familyId: string, planId: string) {
  return request<{ plans?: BirthdayGiftPlanDto[]; error?: string }>(
    `/api/families/${familyId}/birthday-gift-plans/${planId}`,
    { method: "DELETE" },
  );
}

// Sprint 41: et simpelt "hvem betalte/hvem skylder"-overblik mellem
// forældre, ikke fuld bogføring — se
// 41_Sprint41_Deleoekonomi_Foraeldre_Plan.md. Kun medlemmer med en
// tilknyttet konto (linkedUserId) kan betale/deltage.
export interface SharedExpenseDto {
  id: string;
  familyId: string;
  description: string;
  amount: number;
  paidByMemberId: string;
  splitBetween: string[];
  expenseDate: string;
  createdByUserId: string;
  createdAt: string;
}

export interface SharedExpenseBalanceDto {
  debtorMemberId: string;
  creditorMemberId: string;
  amount: number;
}

export function getSharedExpenses(familyId: string) {
  return request<{ expenses?: SharedExpenseDto[]; error?: string }>(
    `/api/families/${familyId}/shared-expenses`,
  );
}

export function getSharedExpenseBalances(familyId: string) {
  return request<{ balances?: SharedExpenseBalanceDto[]; error?: string }>(
    `/api/families/${familyId}/shared-expense-balances`,
  );
}

export function createSharedExpense(
  familyId: string,
  expense: { description: string; amount: number; paidByMemberId: string; splitBetween: string[]; expenseDate: string },
) {
  return request<{ expenses?: SharedExpenseDto[]; error?: string }>(
    `/api/families/${familyId}/shared-expenses`,
    { method: "POST", body: JSON.stringify(expense) },
  );
}

export function deleteSharedExpense(familyId: string, expenseId: string) {
  return request<{ expenses?: SharedExpenseDto[]; error?: string }>(
    `/api/families/${familyId}/shared-expenses/${expenseId}`,
    { method: "DELETE" },
  );
}

export function settleSharedExpenseBalance(familyId: string, memberIdA: string, memberIdB: string) {
  return request<{ balances?: SharedExpenseBalanceDto[]; error?: string }>(
    `/api/families/${familyId}/shared-expense-settlements`,
    { method: "POST", body: JSON.stringify({ memberIdA, memberIdB }) },
  );
}

// "Flere funktioner" (Indstillinger → Hjælp og feedback): en familie kan
// selv slå disse dele af appen til/fra, alt starter slået fra. Nøglelisten
// er en duplikering af server/routes/familyRoutes/featureFlags.ts's
// allow-list — samme duplikeringskonvention som resten af projektet.
export const featureKeys = [
  "shopping-list",
  "tasks",
  "routines",
  "meal-plan",
  "task-rewards",
  "birthdays",
  "shared-expenses",
  "kiosk",
] as const;

export type FeatureKey = (typeof featureKeys)[number];

export function getEnabledFeatures(familyId: string) {
  return request<{ features?: FeatureKey[]; error?: string }>(
    `/api/families/${familyId}/enabled-features`,
  );
}

export function setFeatureEnabled(familyId: string, featureKey: FeatureKey, enabled: boolean) {
  return request<{ features?: FeatureKey[]; error?: string }>(
    `/api/families/${familyId}/enabled-features/${featureKey}`,
    { method: "PUT", body: JSON.stringify({ enabled }) },
  );
}
