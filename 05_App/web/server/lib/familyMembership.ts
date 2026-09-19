// Delt af families.ts og shoppingLists.ts (Sprint 21, Del B) — samme
// medlemskabs-/rolle-opslag, uden at hver rute-fil skal have sin egen kopi.

export interface MembershipRow {
  familyId: string;
  role: "owner" | "admin" | "member";
}

// Sprint 50: JOINer families+users og udelader begge sider, hvis en
// sletning er anmodet (deleted_at sat) — en familie under sletning
// forsvinder øjeblikkeligt for ALLE medlemmer (inkl. ejeren, der bad om
// det), og en bruger, der har bedt om at få sin egen konto slettet,
// mister adgang til enhver familie med det samme, selv hvis vedkommende
// logger ind igen inden fortrydelsesperioden udløber — kun et eksplicit
// kald til cancelAccountDeletion() (accountDeletion.ts) genopretter
// adgangen. Se 50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md.
export async function getMembership(
  db: D1Database,
  userId: string,
): Promise<MembershipRow | null> {
  const row = await db
    .prepare(
      `SELECT family_memberships.family_id AS familyId, family_memberships.role AS role
       FROM family_memberships
       JOIN families ON families.id = family_memberships.family_id
       JOIN users ON users.id = family_memberships.user_id
       WHERE family_memberships.user_id = ? AND families.deleted_at IS NULL AND users.deleted_at IS NULL`,
    )
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
      `SELECT family_memberships.family_id AS familyId, family_memberships.role AS role
       FROM family_memberships
       JOIN families ON families.id = family_memberships.family_id
       JOIN users ON users.id = family_memberships.user_id
       WHERE family_memberships.family_id = ? AND family_memberships.user_id = ?
             AND families.deleted_at IS NULL AND users.deleted_at IS NULL`,
    )
    .bind(familyId, userId)
    .first<MembershipRow>();

  return row ?? null;
}
