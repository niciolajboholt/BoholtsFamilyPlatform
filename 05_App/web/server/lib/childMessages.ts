// Sprint 55 (se 55_Sprint55_Barn_Adgang_UX_Plan.md): korte, envejs
// beskeder fra en voksen til ét bestemt familiemedlem — v1-afgrænset til
// ren tekst, ingen billeder/filer/links, intet svar fra barnet. Delt
// mellem den almindelige familie-rute (familyRoutes/childMessages.ts,
// enhver logget ind voksen) og børnesessionens egen rute
// (routes/childAccess.ts, kun modtagerens egen session), samme mønster
// som lib/taskCompletion.ts's deling mellem de to opgave-ruter.

export const childMessageMaxLength = 280;

export interface ChildMessageDto {
  id: string;
  familyMemberId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export function isValidChildMessageBody(body: unknown): body is string {
  return typeof body === "string" && body.trim().length > 0 && body.trim().length <= childMessageMaxLength;
}

export async function createChildMessage(
  db: D1Database,
  input: { familyId: string; familyMemberId: string; createdByUserId: string; body: string },
): Promise<ChildMessageDto> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const body = input.body.trim();

  await db
    .prepare(
      `INSERT INTO child_messages (id, family_id, family_member_id, created_by_user_id, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.familyId, input.familyMemberId, input.createdByUserId, body, now)
    .run();

  return { id, familyMemberId: input.familyMemberId, body, createdAt: now, readAt: null };
}

export async function listChildMessagesForMember(
  db: D1Database,
  familyMemberId: string,
): Promise<ChildMessageDto[]> {
  const { results } = await db
    .prepare(
      `SELECT id, family_member_id AS familyMemberId, body, created_at AS createdAt, read_at AS readAt
       FROM child_messages
       WHERE family_member_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(familyMemberId)
    .all<ChildMessageDto>();

  return results;
}

// Bruges kun af barnets EGEN session (routes/childAccess.ts) — markerer
// læst, men kun hvis beskeden rent faktisk tilhører DET medlem, der
// spørger (returnerer false ellers, så ruten kan svare 404).
export async function markChildMessageRead(
  db: D1Database,
  familyMemberId: string,
  messageId: string,
): Promise<boolean> {
  const existing = await db
    .prepare("SELECT id FROM child_messages WHERE id = ? AND family_member_id = ?")
    .bind(messageId, familyMemberId)
    .first<{ id: string }>();

  if (!existing) {
    return false;
  }

  await db
    .prepare("UPDATE child_messages SET read_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), messageId)
    .run();

  return true;
}

// Afsenderen selv eller ejer/admin (håndhævet af kaldestedet, ikke her) kan
// slette en besked — bruges kun fra den almindelige familie-rute, aldrig
// fra en børnesession.
export async function deleteChildMessage(db: D1Database, familyId: string, messageId: string): Promise<void> {
  await db.prepare("DELETE FROM child_messages WHERE id = ? AND family_id = ?").bind(messageId, familyId).run();
}
