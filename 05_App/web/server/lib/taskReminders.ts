// Sprint 27: tidsbaserede opgave-påmindelser. Kaldes fra index.ts's
// scheduled()-handler ved hvert "*/5 * * * *"-tick (se wrangler.jsonc).
//
// Første sted i appen, hvor SERVEREN selv skal udlede "hvilken dag/hvad
// klokken er" — alt andet (kalender-materialisering, opgave-datoer) er
// hidtil styret af klientens egen lokale dato/tid, sendt med i requesten.
// Et scheduled()-kald har ingen klient at spørge, så vi udleder Danmarks
// lokale tid eksplicit via Intl.DateTimeFormat, i stedet for at antage
// UTC (som Workers ellers kører i).

import type { Env } from "../env";
import { logError } from "./structuredLog";
import { materializeTasksForDate, notifyForTask } from "../routes/tasks";

interface CopenhagenTime {
  date: string; // "YYYY-MM-DD"
  minutesSinceMidnight: number;
}

function getCopenhagenTime(now: Date): CopenhagenTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // "24" i stedet for "00" ved midnat er en kendt Intl-kvirk for hour12:
  // false — normaliseres her, så minutsberegningen forbliver korrekt.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  return { date, minutesSinceMidnight: hour * 60 + minute };
}

function formatMinutesAsTime(minutesSinceMidnight: number): string {
  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Rund ned til nærmeste 5-minutters-bucket, [start, start+4] inklusivt —
// undgår enhver dato-/klokkeslæt-overløbshåndtering for dagens sidste
// bucket (23:55-23:59), i modsætning til en eksklusiv [start, start+5)-grænse
// der ville kræve at repræsentere "24:00".
function computeReminderWindow(minutesSinceMidnight: number): { start: string; end: string } {
  const windowStartMinutes = Math.floor(minutesSinceMidnight / 5) * 5;
  const windowEndMinutes = Math.min(windowStartMinutes + 4, 23 * 60 + 59);

  return {
    start: formatMinutesAsTime(windowStartMinutes),
    end: formatMinutesAsTime(windowEndMinutes),
  };
}

interface DueTaskRow {
  id: string;
  familyId: string;
  name: string;
  assignedMemberId: string | null;
}

/**
 * Kaldes ved hvert 5-minutters cron-tick. Materialiserer først dagens
 * rutine-opgaver for ALLE familier (Sprint 23's lazy-materialisering kører
 * ellers kun når nogen åbner opgavesiden — uden dette ville en påmindelse
 * intet have at pege på, hvis ingen har åbnet appen endnu i dag), finder
 * derefter opgaver med et tidspunkt inden for det aktuelle vindue, som
 * hverken er udført eller allerede har fået en påmindelse, sender en push
 * pr. opgave, og markerer den som påmindt.
 */
export async function sendDueTaskReminders(env: Env, now: Date = new Date()): Promise<void> {
  const { date, minutesSinceMidnight } = getCopenhagenTime(now);
  const window = computeReminderWindow(minutesSinceMidnight);

  const { results: families } = await env.DB.prepare("SELECT id FROM families").all<{
    id: string;
  }>();

  for (const family of families) {
    await materializeTasksForDate(env.DB, family.id, date);
  }

  const { results: dueTasks } = await env.DB
    .prepare(
      `SELECT id, family_id AS familyId, name, assigned_member_id AS assignedMemberId
       FROM tasks
       WHERE task_date = ? AND is_done = 0 AND reminded_at IS NULL
             AND time_of_day >= ? AND time_of_day <= ?`,
    )
    .bind(date, window.start, window.end)
    .all<DueTaskRow>();

  const remindedAt = new Date().toISOString();

  for (const task of dueTasks) {
    // notifyForTask()'s "acting user"-parameter bruges normalt til at
    // undtage den, der selv udløste en handling (fx opretteren af en
    // familie-opgave) — irrelevant her, da en tidsbaseret påmindelse ikke
    // har en handlende bruger at undtage. En tom streng matcher aldrig et
    // rigtigt bruger-id, så ingen relevant modtager udelades.
    await notifyForTask(env, task.familyId, "", task.assignedMemberId, {
      title: "Påmindelse",
      body: `"${task.name}" er nu.`,
      url: "/tasks",
    }).catch((error: unknown) => {
      logError("Kunne ikke sende opgave-påmindelse", error, { taskId: task.id });
    });

    await env.DB.prepare("UPDATE tasks SET reminded_at = ? WHERE id = ?")
      .bind(remindedAt, task.id)
      .run();
  }
}
