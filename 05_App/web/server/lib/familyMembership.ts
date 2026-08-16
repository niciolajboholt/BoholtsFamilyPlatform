// Delt af families.ts og shoppingLists.ts (Sprint 21, Del B) — samme
// medlemskabs-/rolle-opslag, uden at hver rute-fil skal have sin egen kopi.

export interface MembershipRow {
  familyId: string;
  role: "owner" | "admin" | "member";
}

export async function getMembership(
  db: D1Database,
  userId: string,
): Promise<MembershipRow | null> {
  const row = await db
    .prepare(`SELECT family_id AS familyId, role FROM family_memberships WHERE user_id = ?`)
    .bind(userId)
    .first<MembershipRow>();

  return row ?? null;
}

export async function getMembershipForFamily(
  db: D1Database,
  familyId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const row = await db
    .prepare(
      `SELECT family_id AS familyId, role FROM family_memberships WHERE family_id = ? AND user_id = ?`,
    )
    .bind(familyId, userId)
    .first<MembershipRow>();

  return row ?? null;
}
