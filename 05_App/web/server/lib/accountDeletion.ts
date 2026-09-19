// Sprint 50: kontosletning, og for en ejer også hele familiens sletning —
// se 01_Project_Documentation/Development/50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md.
//
// Implementeringen følger Nicolajs svar på planens fire åbne
// produktbeslutninger (launch-prep-samtalen):
// 1. En slettet brugers opgaver/udgifter forbliver, og vises som
//    "Tidligere medlem" — se anonymizeUser() nedenfor: kun users-rækken
//    ændres (ved purge), aldrig de rækker, der refererer til den via
//    created_by_user_id, så eksisterende fremmednøgler forbliver gyldige.
// 2. En ejer kan også bede om at få HELE familien slettet, ikke kun sin
//    egen konto — se requestFamilyDeletion()/hardDeleteFamily().
// 3. Eksportens omfang afhænger af hvem der beder om den (se
//    server/lib/dataExport.ts, ikke denne fil).
// 4. 30 dages fortrydelsesperiode, før noget rent faktisk fjernes/
//    anonymiseres for altid — se DELETION_RETENTION_DAYS og
//    purgeExpiredDeletions().
//
// To-trins bekræftelse + gen-autentificering: en preview-funktion
// (previewAccountDeletion/previewFamilyDeletion) viser konsekvensen, og
// selve request*()-funktionerne kræver en `reauthenticatedAt`-værdi, som
// ruterne SKAL have valideret er frisk (isReauthFresh()) via en nylig
// OAuth-roundtrip (auth.ts's /reauth/google og /reauth/microsoft) — denne
// fil har ingen adgang til sessionen og kan ikke selv håndhæve det.

import type { Env } from "../env";
import type { MembershipRow } from "./familyMembership";

export const DELETION_RETENTION_DAYS = 30;
export const REAUTH_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutter
export const ACCOUNT_DELETION_CONFIRMATION = "SLET MIN KONTO";

const ANONYMIZED_NAME = "Tidligere medlem";

export function isReauthFresh(reauthenticatedAt: string | null, now: Date = new Date()): boolean {
  if (!reauthenticatedAt) {
    return false;
  }

  const reauthenticatedAtMs = new Date(reauthenticatedAt).getTime();
  const ageMs = now.getTime() - reauthenticatedAtMs;

  return Number.isFinite(reauthenticatedAtMs) && ageMs >= 0 && ageMs < REAUTH_MAX_AGE_MS;
}

function purgeAfterFromNow(now: Date): string {
  return new Date(now.getTime() + DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Konto (selv-sletning)
// ---------------------------------------------------------------------------

export interface AccountDeletionPreviewMembership extends MembershipRow {
  familyName: string;
  memberCount: number;
}

export interface AccountDeletionPreview {
  memberships: AccountDeletionPreviewMembership[];
}

// Kun familier brugeren stadig reelt er medlem af (families.deleted_at IS
// NULL) — en familie, der allerede er under sletning, er ikke relevant for
// forhåndsvisningen af en kontosletning.
export async function previewAccountDeletion(
  db: D1Database,
  userId: string,
): Promise<AccountDeletionPreview> {
  const result = await db
    .prepare(
      `SELECT fm.family_id AS familyId, families.name AS familyName, fm.role AS role,
              (SELECT COUNT(*) FROM family_memberships fm2 WHERE fm2.family_id = fm.family_id) AS memberCount
       FROM family_memberships fm
       JOIN families ON families.id = fm.family_id
       WHERE fm.user_id = ? AND families.deleted_at IS NULL`,
    )
    .bind(userId)
    .all<AccountDeletionPreviewMembership>();

  return { memberships: result.results };
}

export class DeletionAlreadyRequestedError extends Error {}

export class InvalidDeletionConfirmationError extends Error {}

export interface OwnedFamilyBlockingDeletion {
  familyId: string;
  familyName: string;
  memberCount: number;
}

export class AccountOwnsFamiliesError extends Error {
  readonly families: OwnedFamilyBlockingDeletion[];

  constructor(families: OwnedFamilyBlockingDeletion[]) {
    super("Ejerskab skal overdrages, eller familien skal slettes, før kontoen kan slettes.");
    this.families = families;
  }
}

export async function requestAccountDeletion(
  db: D1Database,
  options: { userId: string; reauthenticatedAt: string; confirmation: string },
): Promise<{ purgeAfter: string }> {
  if (options.confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    throw new InvalidDeletionConfirmationError(
      `Skriv ${ACCOUNT_DELETION_CONFIRMATION} præcist for at bekræfte kontosletningen.`,
    );
  }

  // En aktiv familie må aldrig efterlades med owner_user_id pegende på en
  // anonymiseret tombstone. Ejeren skal derfor enten overdrage ejerskabet
  // eller vælge det særskilte familiesletningsflow først. Håndhæves her i
  // domænelaget (ikke kun i UI'et), så ruten ikke kan omgås.
  const ownedFamilies = await db
    .prepare(
      `SELECT families.id AS familyId, families.name AS familyName,
              (SELECT COUNT(*) FROM family_memberships fm
               WHERE fm.family_id = families.id) AS memberCount
       FROM families
       WHERE families.owner_user_id = ? AND families.deleted_at IS NULL`,
    )
    .bind(options.userId)
    .all<OwnedFamilyBlockingDeletion>();

  if (ownedFamilies.results.length > 0) {
    throw new AccountOwnsFamiliesError(ownedFamilies.results);
  }

  const existingOpen = await db
    .prepare(
      `SELECT id FROM deletion_requests
       WHERE scope = 'account' AND target_id = ? AND cancelled_at IS NULL AND purged_at IS NULL`,
    )
    .bind(options.userId)
    .first<{ id: string }>();

  if (existingOpen) {
    throw new DeletionAlreadyRequestedError(
      "Der er allerede en igangværende sletningsanmodning for denne konto.",
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const purgeAfter = purgeAfterFromNow(now);

  await db.batch([
    db
      .prepare(
        `INSERT INTO deletion_requests
           (id, scope, target_id, requested_by_user_id, reauthenticated_at, requested_at, purge_after)
         VALUES (?, 'account', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        options.userId,
        options.userId,
        options.reauthenticatedAt,
        nowIso,
        purgeAfter,
      ),
    db.prepare("UPDATE users SET deleted_at = ? WHERE id = ?").bind(nowIso, options.userId),
    // Logger brugeren ud øjeblikkeligt, overalt — en fortrydelse kræver et
    // helt nyt login (se cancelAccountDeletion()'s kommentar).
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(options.userId),
  ]);

  return { purgeAfter };
}

// Fortrydelse: brugeren skal logge ind igen (Google/Microsoft-identiteten
// er upåvirket af deleted_at — kun appens egen adgang er spærret), hvilket
// opretter en ny session. getMembership/getMembershipForFamily blokerer
// stadig al familie-adgang, indtil denne funktion rydder deleted_at.
export async function cancelAccountDeletion(db: D1Database, userId: string): Promise<boolean> {
  const openRequest = await db
    .prepare(
      `SELECT id FROM deletion_requests
       WHERE scope = 'account' AND target_id = ? AND cancelled_at IS NULL AND purged_at IS NULL`,
    )
    .bind(userId)
    .first<{ id: string }>();

  if (!openRequest) {
    return false;
  }

  const now = new Date().toISOString();

  await db.batch([
    db.prepare("UPDATE deletion_requests SET cancelled_at = ? WHERE id = ?").bind(now, openRequest.id),
    db.prepare("UPDATE users SET deleted_at = NULL WHERE id = ?").bind(userId),
  ]);

  return true;
}

// ---------------------------------------------------------------------------
// Familie (kun ejer)
// ---------------------------------------------------------------------------

export interface FamilyDeletionPreview {
  familyName: string;
  memberCount: number;
  taskCount: number;
  shoppingListCount: number;
  sharedExpenseCount: number;
  mealPlanEntryCount: number;
}

export async function previewFamilyDeletion(
  db: D1Database,
  familyId: string,
): Promise<FamilyDeletionPreview> {
  const [family, members, tasks, lists, expenses, meals] = await Promise.all([
    db.prepare("SELECT name FROM families WHERE id = ?").bind(familyId).first<{ name: string }>(),
    db.prepare("SELECT COUNT(*) AS count FROM family_members WHERE family_id = ?").bind(familyId).first<{
      count: number;
    }>(),
    db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE family_id = ?").bind(familyId).first<{
      count: number;
    }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM shopping_lists WHERE family_id = ?")
      .bind(familyId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM shared_expenses WHERE family_id = ?")
      .bind(familyId)
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM meal_plan_entries WHERE family_id = ?")
      .bind(familyId)
      .first<{ count: number }>(),
  ]);

  return {
    familyName: family?.name ?? "",
    memberCount: members?.count ?? 0,
    taskCount: tasks?.count ?? 0,
    shoppingListCount: lists?.count ?? 0,
    sharedExpenseCount: expenses?.count ?? 0,
    mealPlanEntryCount: meals?.count ?? 0,
  };
}

export async function requestFamilyDeletion(
  db: D1Database,
  options: {
    familyId: string;
    requestedByUserId: string;
    reauthenticatedAt: string;
    confirmation: string;
  },
): Promise<{ purgeAfter: string }> {
  const existingOpen = await db
    .prepare(
      `SELECT id FROM deletion_requests
       WHERE scope = 'family' AND target_id = ? AND cancelled_at IS NULL AND purged_at IS NULL`,
    )
    .bind(options.familyId)
    .first<{ id: string }>();

  if (existingOpen) {
    throw new DeletionAlreadyRequestedError(
      "Der er allerede en igangværende sletningsanmodning for denne familie.",
    );
  }

  const family = await db
    .prepare("SELECT name FROM families WHERE id = ? AND deleted_at IS NULL")
    .bind(options.familyId)
    .first<{ name: string }>();

  if (!family || options.confirmation !== family.name) {
    throw new InvalidDeletionConfirmationError(
      "Skriv familiens navn præcist for at bekræfte sletningen.",
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const purgeAfter = purgeAfterFromNow(now);

  await db.batch([
    db
      .prepare(
        `INSERT INTO deletion_requests
           (id, scope, target_id, requested_by_user_id, reauthenticated_at, requested_at, purge_after)
         VALUES (?, 'family', ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        options.familyId,
        options.requestedByUserId,
        options.reauthenticatedAt,
        nowIso,
        purgeAfter,
      ),
    db.prepare("UPDATE families SET deleted_at = ? WHERE id = ?").bind(nowIso, options.familyId),
  ]);

  return { purgeAfter };
}

// families.deleted_at gør familien 404 for ALLE medlemmer med det samme
// (getMembershipForFamily), inkl. ejeren selv — så fortrydelse kan ikke gå
// gennem den almindelige medlemskabs-tjek. I stedet identificeres
// anmodningen via deletion_requests.requested_by_user_id: kun den, der bad
// om sletningen, kan fortryde den.
export async function cancelFamilyDeletion(
  db: D1Database,
  options: { familyId: string; requestedByUserId: string },
): Promise<boolean> {
  const openRequest = await db
    .prepare(
      `SELECT id FROM deletion_requests
       WHERE scope = 'family' AND target_id = ? AND requested_by_user_id = ?
             AND cancelled_at IS NULL AND purged_at IS NULL`,
    )
    .bind(options.familyId, options.requestedByUserId)
    .first<{ id: string }>();

  if (!openRequest) {
    return false;
  }

  const now = new Date().toISOString();

  // Ejeren kan have bestilt personlig kontosletning, mens familien var
  // skjult og planlagt til sletning. Hvis familien gendannes, skal den
  // personlige anmodning derfor også fortrydes atomisk; ellers ville den
  // senere account-purge igen efterlade den gendannede familie uden ejer.
  const openAccountRequest = await db
    .prepare(
      `SELECT id FROM deletion_requests
       WHERE scope = 'account' AND target_id = ?
             AND cancelled_at IS NULL AND purged_at IS NULL`,
    )
    .bind(options.requestedByUserId)
    .first<{ id: string }>();

  const statements = [
    db.prepare("UPDATE deletion_requests SET cancelled_at = ? WHERE id = ?").bind(now, openRequest.id),
    db.prepare("UPDATE families SET deleted_at = NULL WHERE id = ?").bind(options.familyId),
  ];

  if (openAccountRequest) {
    statements.push(
      db
        .prepare("UPDATE deletion_requests SET cancelled_at = ? WHERE id = ?")
        .bind(now, openAccountRequest.id),
      db.prepare("UPDATE users SET deleted_at = NULL WHERE id = ?").bind(options.requestedByUserId),
    );
  }

  await db.batch(statements);

  return true;
}

// ---------------------------------------------------------------------------
// Purge (kaldes kun fra den daglige Cron Trigger, se index.ts)
// ---------------------------------------------------------------------------

// Overskriver users-rækken med et anonymt tombstone i stedet for at slette
// den: google_sub/microsoft_sub skal forblive UNIK og NOT NULL (se
// 0030_microsoft_login.sql), og enhver anden tabels created_by_user_id
// peger stadig på denne id — de rækker skal bestå (Nicolajs beslutning 1).
async function anonymizeUser(db: D1Database, userId: string): Promise<void> {
  const tombstoneSub = `deleted:${crypto.randomUUID()}`;

  await db.batch([
    db
      .prepare(
        `UPDATE users SET name = ?, email = ?, picture_url = NULL, google_sub = ?, microsoft_sub = NULL
         WHERE id = ?`,
      )
      .bind(ANONYMIZED_NAME, `${tombstoneSub}@fjernet.invalid`, tombstoneSub, userId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM google_connections WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM family_memberships WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM user_activity_cursors WHERE user_id = ?").bind(userId),
    db.prepare("UPDATE family_members SET linked_user_id = NULL WHERE linked_user_id = ?").bind(userId),
  ]);
}

// Fjerner ALT af familiens data, i den rækkefølge fremmednøglerne kræver
// (ingen migration definerer ON DELETE CASCADE — verificeret mod samtlige
// migrationer, se planens "Nuværende tilstand"). Leaf-tabeller først, så en
// fremmednøgle aldrig peger på en allerede-slettet forælder-række.
// rate_limit_attempts (driftsdata, ikke familiedata) og feedback (hører til
// afsenderen, ikke familien, jf. 0014_feedback.sql's kommentar) er bevidst
// UDELADT. Medlemmernes users-rækker slettes IKKE — kun deres medlemskab af
// DENNE familie.
async function hardDeleteFamily(db: D1Database, familyId: string): Promise<void> {
  await db.batch([
    db
      .prepare(
        "DELETE FROM task_routine_items WHERE routine_id IN (SELECT id FROM task_routines WHERE family_id = ?)",
      )
      .bind(familyId),
    db.prepare("DELETE FROM tasks WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM task_routines WHERE family_id = ?").bind(familyId),
    db
      .prepare(
        "DELETE FROM shopping_list_items WHERE list_id IN (SELECT id FROM shopping_lists WHERE family_id = ?)",
      )
      .bind(familyId),
    db
      .prepare(
        "DELETE FROM shopping_list_template_items WHERE template_id IN (SELECT id FROM shopping_list_templates WHERE family_id = ?)",
      )
      .bind(familyId),
    db.prepare("DELETE FROM shopping_lists WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM shopping_list_templates WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM shopping_item_category_overrides WHERE family_id = ?").bind(familyId),
    db
      .prepare(
        "DELETE FROM icloud_calendar_sync_state WHERE connection_id IN (SELECT id FROM icloud_calendar_connections WHERE family_id = ?)",
      )
      .bind(familyId),
    db.prepare("DELETE FROM icloud_calendar_connections WHERE family_id = ?").bind(familyId),
    db
      .prepare(
        `DELETE FROM calendar_event_snapshots WHERE google_calendar_id IN (
           SELECT google_calendar_id FROM calendar_sync_state WHERE family_id = ?
           UNION
           SELECT google_calendar_id FROM calendar_member_mappings WHERE family_id = ?
         )`,
      )
      .bind(familyId, familyId),
    db.prepare("DELETE FROM calendar_sync_state WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM calendar_activity_log WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM calendar_member_mappings WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM meal_plan_entries WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM birthday_gift_plans WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM shared_expense_settlements WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM shared_expenses WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM allowance_ledger WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM event_reminders WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM ics_calendar_subscriptions WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM family_share_links WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM family_weekly_summaries WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM family_enabled_features WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM family_invites WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM family_members WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM family_memberships WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM user_activity_cursors WHERE family_id = ?").bind(familyId),
    db.prepare("DELETE FROM families WHERE id = ?").bind(familyId),
  ]);
}

interface DueDeletionRow {
  id: string;
  scope: "account" | "family";
  targetId: string;
}

// Kaldes fra den eksisterende daglige Cron Trigger (index.ts's scheduled(),
// "0 4 * * *"-grenen) — ingen ny Cron Trigger oprettet, kontoen har et loft
// på 5 i alt, allerede brugt op af beta-miljøet (se wrangler.jsonc).
export async function purgeExpiredDeletions(env: Env): Promise<void> {
  const db = env.DB;
  const now = new Date().toISOString();

  const due = await db
    .prepare(
      `SELECT id, scope, target_id AS targetId FROM deletion_requests
       WHERE purge_after <= ? AND cancelled_at IS NULL AND purged_at IS NULL`,
    )
    .bind(now)
    .all<DueDeletionRow>();

  for (const request of due.results) {
    if (request.scope === "account") {
      await anonymizeUser(db, request.targetId);
    } else {
      await hardDeleteFamily(db, request.targetId);
    }

    await db
      .prepare("UPDATE deletion_requests SET purged_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), request.id)
      .run();
  }
}
