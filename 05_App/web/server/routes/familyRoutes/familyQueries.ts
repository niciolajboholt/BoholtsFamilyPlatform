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
}

export async function listFamilyMembers(db: D1Database, familyId: string): Promise<FamilyMemberRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, color, relation, is_placeholder_name AS isPlaceholderName, linked_user_id AS linkedUserId
       FROM family_members WHERE family_id = ? ORDER BY created_at ASC`,
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
