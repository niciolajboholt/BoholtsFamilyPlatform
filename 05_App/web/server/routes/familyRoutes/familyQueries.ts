import type { Context } from "hono";

import type { SessionUser } from "../../lib/session";

export type Variables = { user: SessionUser };

// Requests med tomt/ugyldigt JSON-body behandles som "ingen felter angivet"
// i stedet for en fejl — hvert kaldested validerer selv de felter, det har
// brug for.
export async function parseJsonBody<T extends object>(c: Context): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

export interface FamilyRow {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  aiWeeklySummaryEnabled: number;
}

export async function getFamily(db: D1Database, familyId: string): Promise<FamilyRow | null> {
  const row = await db
    .prepare(
      `SELECT id, name, owner_user_id AS ownerUserId, created_at AS createdAt,
              ai_weekly_summary_enabled AS aiWeeklySummaryEnabled
       FROM families WHERE id = ?`,
    )
    .bind(familyId)
    .first<FamilyRow>();

  return row ?? null;
}

export interface FamilyMemberRow {
  id: string;
  name: string;
  color: string;
  relation: string | null;
  isPlaceholderName: number;
  linkedUserId: string | null;
  linkedUserEmail: string | null;
}

// LEFT JOIN (ikke JOIN): et medlem uden koblet konto (fx et barn) skal
// stadig komme med i listen, blot med linkedUserEmail: null — bruges
// client-side til at matche Google-aftalers deltagerliste mod medlemmet
// (matchAttendeesToOwnerIds.ts), mere præcist end kalender-tildelingen.
export async function listFamilyMembers(db: D1Database, familyId: string): Promise<FamilyMemberRow[]> {
  const result = await db
    .prepare(
      `SELECT family_members.id AS id, family_members.name AS name, family_members.color AS color,
              family_members.relation AS relation,
              family_members.is_placeholder_name AS isPlaceholderName,
              family_members.linked_user_id AS linkedUserId,
              users.email AS linkedUserEmail
       FROM family_members
       LEFT JOIN users ON users.id = family_members.linked_user_id
       WHERE family_members.family_id = ? ORDER BY family_members.created_at ASC`,
    )
    .bind(familyId)
    .all<FamilyMemberRow>();

  return result.results;
}

export interface ShareLinkRow {
  token: string;
  includedMemberIds: string;
  includeDescription: number;
  includeLocation: number;
}

export function parseIncludedMemberIds(csv: string): string[] {
  return csv.split(",").filter((id) => id.length > 0);
}

export interface FamilyMembershipRow {
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string;
}

export async function listFamilyMemberships(db: D1Database, familyId: string): Promise<FamilyMembershipRow[]> {
  const result = await db
    .prepare(
      `SELECT users.id AS userId, users.email AS email, users.name AS name,
              family_memberships.role AS role, family_memberships.joined_at AS joinedAt
       FROM family_memberships
       JOIN users ON users.id = family_memberships.user_id
       WHERE family_memberships.family_id = ?
       ORDER BY family_memberships.joined_at ASC`,
    )
    .bind(familyId)
    .all<FamilyMembershipRow>();

  return result.results;
}

export interface CalendarMemberMappingRow {
  googleCalendarId: string;
  familyMemberId: string;
}

export async function listCalendarMemberMappings(
  db: D1Database,
  familyId: string,
): Promise<CalendarMemberMappingRow[]> {
  const result = await db
    .prepare(
      `SELECT google_calendar_id AS googleCalendarId, family_member_id AS familyMemberId
       FROM calendar_member_mappings WHERE family_id = ?`,
    )
    .bind(familyId)
    .all<CalendarMemberMappingRow>();

  return result.results;
}
