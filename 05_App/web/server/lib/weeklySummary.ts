// Sprint 28: AI-genereret ugeresumé. Kaldes fra index.ts's scheduled()-
// handler ved det ugentlige "0 17 * * SUN"-tick (søndag kl. 17 UTC, ~18-19
// dansk tid afhængig af sommer-/vintertid — se 28_Sprint28_AI_Ugeresume_Plan.md,
// beslutning 1).

import type { Env } from "../env";
import { generateWeeklySummary } from "./aiAssistant";
import { fetchPublicFamilyCalendarEvents } from "./googleCalendarAggregation";
import { GoogleNotConnectedError } from "./googleConnection";
import { sendPushNotificationToFamily } from "./pushNotifications";
import { materializeTasksForDate } from "../routes/tasks";

function getCopenhagenDateString(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getUtcWeekday(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Den kommende uges mandag. Cron'en kører søndag aften (beslutning 1), så
// dette bliver typisk "i morgen" — men beregnes generelt (fremad til
// næste mandag, aldrig samme dag), så funktionen er robust/testbar
// uafhængigt af hvilken ugedag den rent faktisk kaldes på.
function computeUpcomingWeekStart(today: string): string {
  let candidate = addDays(today, 1);

  while (getUtcWeekday(candidate) !== 1) {
    candidate = addDays(candidate, 1);
  }

  return candidate;
}

interface FamilyRow {
  id: string;
  ownerUserId: string;
}

async function collectOpenTaskNames(
  db: D1Database,
  familyId: string,
  weekStart: string,
  weekEnd: string,
): Promise<string[]> {
  for (let offset = 0; offset < 7; offset += 1) {
    await materializeTasksForDate(db, familyId, addDays(weekStart, offset));
  }

  const { results } = await db
    .prepare(
      `SELECT name FROM tasks
       WHERE family_id = ? AND task_date BETWEEN ? AND ? AND is_done = 0
       ORDER BY task_date ASC, time_of_day ASC`,
    )
    .bind(familyId, weekStart, weekEnd)
    .all<{ name: string }>();

  return results.map((row) => row.name);
}

async function collectOpenShoppingItemNames(db: D1Database, familyId: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT sli.name AS name
       FROM shopping_list_items sli
       JOIN shopping_lists sl ON sl.id = sli.list_id
       WHERE sl.family_id = ? AND sli.is_checked = 0`,
    )
    .bind(familyId)
    .all<{ name: string }>();

  return results.map((row) => row.name);
}

// Samme begrænsning som Sprint 26's delelink: ét familiemedlems
// Google-forbindelse (familiens ejer) driver kalenderdelen — appen
// understøtter endnu ikke flere Google-konti pr. familie. Ingen
// forbindelse, eller ingen kortlagte kalendere, betyder blot en tom
// kalenderdel af resuméet, ikke en fejl (risiko 1 i sprint-planen).
async function collectUpcomingEvents(
  env: Env,
  familyId: string,
  ownerUserId: string,
  weekStart: string,
  weekEnd: string,
): Promise<{ title: string; start: string }[]> {
  const { results: mappings } = await env.DB.prepare(
    "SELECT DISTINCT family_member_id AS familyMemberId FROM calendar_member_mappings WHERE family_id = ?",
  )
    .bind(familyId)
    .all<{ familyMemberId: string }>();

  if (mappings.length === 0) {
    return [];
  }

  try {
    const events = await fetchPublicFamilyCalendarEvents(
      env,
      familyId,
      ownerUserId,
      mappings.map((mapping) => mapping.familyMemberId),
      { start: `${weekStart}T00:00:00.000Z`, end: `${addDays(weekEnd, 1)}T00:00:00.000Z` },
    );

    return events.map((event) => ({ title: event.title, start: event.start }));
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      return [];
    }

    throw error;
  }
}

async function hasExistingSummary(db: D1Database, familyId: string, weekStart: string): Promise<boolean> {
  const existing = await db
    .prepare("SELECT id FROM family_weekly_summaries WHERE family_id = ? AND week_start = ?")
    .bind(familyId, weekStart)
    .first<{ id: string }>();

  return existing !== null;
}

/**
 * Kaldes ved det ugentlige cron-tick. For hver familie: springer over hvis
 * et resumé for den kommende uge allerede er genereret (undgår dobbelt
 * Workers AI-forbrug og dobbelt push, hvis jobbet af en eller anden grund
 * kører to gange), samler kalender/opgaver/indkøbsliste, springer familien
 * over hvis intet af det tre findes (beslutning 7), beder ellers AI'en om
 * et resumé, gemmer det, og sender en push. Én families fejl må ikke
 * blokere resten — fejl logges og næste familie forsøges.
 */
export async function sendWeeklySummaries(env: Env, now: Date = new Date()): Promise<void> {
  const today = getCopenhagenDateString(now);
  const weekStart = computeUpcomingWeekStart(today);
  const weekEnd = addDays(weekStart, 6);

  const { results: families } = await env.DB.prepare("SELECT id, owner_user_id AS ownerUserId FROM families").all<
    FamilyRow
  >();

  for (const family of families) {
    try {
      if (await hasExistingSummary(env.DB, family.id, weekStart)) {
        continue;
      }

      const [openTasks, shoppingItems, events] = await Promise.all([
        collectOpenTaskNames(env.DB, family.id, weekStart, weekEnd),
        collectOpenShoppingItemNames(env.DB, family.id),
        collectUpcomingEvents(env, family.id, family.ownerUserId, weekStart, weekEnd),
      ]);

      if (openTasks.length === 0 && shoppingItems.length === 0 && events.length === 0) {
        continue;
      }

      const content = await generateWeeklySummary(env, { events, openTasks, shoppingItems });

      if (!content) {
        console.error(`Kunne ikke generere ugeresumé for familie ${family.id} — springer over.`);
        continue;
      }

      await env.DB.prepare(
        "INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), family.id, weekStart, content, new Date().toISOString())
        .run();

      // Ingen handlende bruger at undtage for et system-udløst resumé —
      // samme mønster/begrundelse som Sprint 27's task-påmindelser.
      await sendPushNotificationToFamily(env, family.id, "", {
        title: "Ugens resumé",
        body: content.length > 120 ? `${content.slice(0, 119)}…` : content,
        url: "/",
      });
    } catch (error: unknown) {
      console.error(`Ugeresumé fejlede for familie ${family.id}:`, error);
    }
  }
}
