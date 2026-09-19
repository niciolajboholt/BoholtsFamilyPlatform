// Udtrukket fra taskRoutes/tasksCrud.ts's PATCH-håndtering (Sprint 53), så
// den almindelige Opgaver-sides afkrydsning og børneadgangens egen
// afkrydsning (routes/childAccess.ts) opdaterer is_done/done_at og
// bogfører lommepenge-belønningen på nøjagtig samme måde, ét sted.

export interface TaskCompletionInput {
  id: string;
  familyId: string;
  assignedMemberId: string | null;
  rewardAmount: number;
}

export async function setTaskDone(
  db: D1Database,
  task: TaskCompletionInput,
  isDone: boolean,
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .prepare("UPDATE tasks SET is_done = ?, done_at = ? WHERE id = ?")
    .bind(isDone ? 1 : 0, isDone ? now : null, task.id)
    .run();

  // Sprint 39: bogfør (eller fortryd) belønningen sammen med selve
  // fuldførelsen. INSERT OR IGNORE + det partielle unik-indeks på task_id
  // forhindrer, at et gentaget fuldført-klik (eller to samtidige kald)
  // bogfører beløbet flere gange; DELETE ved fortryd forhindrer at
  // gentagen afkrydsning/fortryd kan "høste" belønningen mere end én gang.
  if (task.assignedMemberId && task.rewardAmount > 0) {
    if (isDone) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO allowance_ledger (id, family_id, family_member_id, amount, task_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), task.familyId, task.assignedMemberId, task.rewardAmount, task.id, now)
        .run();
    } else {
      await db.prepare("DELETE FROM allowance_ledger WHERE task_id = ?").bind(task.id).run();
    }
  }
}
