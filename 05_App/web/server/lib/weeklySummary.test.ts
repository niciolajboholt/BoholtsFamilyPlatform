import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

vi.mock("../lib/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pushNotifications")>();
  return { ...actual, sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("./aiAssistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./aiAssistant")>();
  return { ...actual, generateWeeklySummary: vi.fn() };
});

vi.mock("./googleCalendarAggregation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./googleCalendarAggregation")>();
  return { ...actual, fetchPublicFamilyCalendarEvents: vi.fn().mockResolvedValue([]) };
});

const { sendPushNotificationToFamily } = await import("../lib/pushNotifications");
const { generateWeeklySummary } = await import("./aiAssistant");
const { fetchPublicFamilyCalendarEvents } = await import("./googleCalendarAggregation");
const { GoogleNotConnectedError } = await import("./googleConnection");
const { sendWeeklySummaries, generateWeeklySummaryForFamily, computeCurrentWeekStart } = await import(
  "./weeklySummary"
);

const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);
const generateWeeklySummaryMock = vi.mocked(generateWeeklySummary);
const fetchPublicFamilyCalendarEventsMock = vi.mocked(fetchPublicFamilyCalendarEvents);

// 2026-08-16 er en søndag — matcher det ugentlige cron-tidspunkt
// (beslutning 1), og den kommende uges mandag bliver dermed 2026-08-17.
const aSunday = new Date("2026-08-16T17:00:00.000Z");
const expectedWeekStart = "2026-08-17";

async function seedFamily(env: ReturnType<typeof createFakeEnv>, familyId = "family-1"): Promise<void> {
  await seedUser(env.DB as never, { id: "owner" });
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Boholt", "owner", new Date().toISOString())
    .run();
}

describe("sendWeeklySummaries", () => {
  beforeEach(() => {
    sendPushNotificationToFamilyMock.mockReset().mockResolvedValue(undefined);
    generateWeeklySummaryMock.mockReset().mockResolvedValue("Et roligt resumé af ugen.");
    fetchPublicFamilyCalendarEventsMock.mockReset().mockResolvedValue([]);
  });

  it("skips a family with no tasks, shopping items, or events", async () => {
    const env = createFakeEnv();
    await seedFamily(env);

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).not.toHaveBeenCalled();
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();

    const saved = await env.DB.prepare("SELECT * FROM family_weekly_summaries").all();
    expect(saved.results).toHaveLength(0);
  });

  it("does not collect or process data when the family disabled AI summaries", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      "UPDATE families SET ai_weekly_summary_enabled = 0 WHERE id = ?",
    ).bind("family-1").run();
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, is_done, task_date, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'fritid', 0, ?, 'owner', ?)`,
    ).bind("private-task", "family-1", "Privat opgave", expectedWeekStart, new Date().toISOString()).run();

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).not.toHaveBeenCalled();
    expect(fetchPublicFamilyCalendarEventsMock).not.toHaveBeenCalled();
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("generates, saves, and sends a push when the family has open tasks", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, is_done, task_date, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'fritid', 0, ?, 'owner', ?)`,
    )
      .bind("task-1", "family-1", "Køb gave", expectedWeekStart, new Date().toISOString())
      .run();

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ openTasks: [{ name: "Køb gave" }] }),
    );
    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "",
      expect.objectContaining({ title: "Ugens resumé" }),
    );

    const saved = await env.DB.prepare("SELECT family_id AS familyId, week_start AS weekStart, content FROM family_weekly_summaries").all<{
      familyId: string;
      weekStart: string;
      content: string;
    }>();
    expect(saved.results).toEqual([
      { familyId: "family-1", weekStart: expectedWeekStart, content: "Et roligt resumé af ugen." },
    ]);
  });

  it("does not save or push when the AI call fails", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      `INSERT INTO shopping_lists (id, family_id, name, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind("list-1", "family-1", "Dagligvarer", new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO shopping_list_items (id, list_id, name, category, is_checked, added_by_user_id, created_at)
       VALUES (?, ?, ?, 'andet', 0, 'owner', ?)`,
    )
      .bind("item-1", "list-1", "Mælk", new Date().toISOString())
      .run();
    generateWeeklySummaryMock.mockResolvedValue(null);

    await sendWeeklySummaries(env, aSunday);

    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
    const saved = await env.DB.prepare("SELECT * FROM family_weekly_summaries").all();
    expect(saved.results).toHaveLength(0);
  });

  it("skips a family that already has a summary for the upcoming week", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, is_done, task_date, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'fritid', 0, ?, 'owner', ?)`,
    )
      .bind("task-1", "family-1", "Køb gave", expectedWeekStart, new Date().toISOString())
      .run();
    await env.DB.prepare(
      "INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind("summary-existing", "family-1", expectedWeekStart, "Gammelt resumé.", new Date().toISOString())
      .run();

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).not.toHaveBeenCalled();
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("treats a missing Google connection as an empty calendar instead of failing", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
      .bind("member-1", "family-1", "Nicolaj", "#2E7D32", new Date().toISOString())
      .run();
    await env.DB.prepare(
      "INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id) VALUES (?, ?, ?)",
    )
      .bind("family-1", "primary", "member-1")
      .run();
    fetchPublicFamilyCalendarEventsMock.mockRejectedValue(new GoogleNotConnectedError());

    await sendWeeklySummaries(env, aSunday);

    // Ingen kalenderdata og ingen opgaver/varer -> familien springes over,
    // uden at fejlen fra den manglende Google-forbindelse væltede jobbet.
    expect(generateWeeklySummaryMock).not.toHaveBeenCalled();
  });

  it("materializes routine tasks across all 7 days of the upcoming week", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    // expectedWeekStart (2026-08-17) er en mandag, +5 dage = lørdag
    // (2026-08-22, ISO-ugedag 6) — langt fra i dag (søndag), så opgaven kun
    // findes, hvis alle 7 dage rent faktisk blev materialiseret.
    await env.DB.prepare(
      `INSERT INTO task_routines (id, family_id, name, weekdays, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, 'owner', ?)`,
    )
      .bind("routine-1", "family-1", "Weekend-rutine", "6", new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO task_routine_items (id, routine_id, name, icon, sort_order)
       VALUES (?, ?, ?, 'fritid', 0)`,
    )
      .bind("item-1", "routine-1", "Storrengøring")
      .run();

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ openTasks: [{ name: "Storrengøring" }] }),
    );
  });

  it("attributes an open task to its assigned family member, for the per-person breakdown", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
      .bind("member-chris", "family-1", "Christine", "#C97653", new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, is_done, task_date, assigned_member_id, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'fritid', 0, ?, ?, 'owner', ?)`,
    )
      .bind("task-assigned", "family-1", "Bestil frisør", expectedWeekStart, "member-chris", new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, is_done, task_date, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'fritid', 0, ?, 'owner', ?)`,
    )
      .bind("task-unassigned", "family-1", "Ryd op i garagen", expectedWeekStart, new Date().toISOString())
      .run();

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        openTasks: expect.arrayContaining([
          { name: "Bestil frisør", memberName: "Christine" },
          { name: "Ryd op i garagen" },
        ]),
      }),
    );
  });

  it("never forwards a private event's description/location to the AI prompt, even if the calendar layer included them", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await env.DB.prepare(
      `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
      .bind("member-1", "family-1", "Nicolaj", "#2E7D32", new Date().toISOString())
      .run();
    await env.DB.prepare(
      "INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id) VALUES (?, ?, ?)",
    )
      .bind("family-1", "primary", "member-1")
      .run();

    // fetchPublicFamilyCalendarEvents (googleCalendarAggregation.ts) already
    // redigerer et privat event til {title: "Optaget", description:
    // undefined, location: undefined} — se dens egen test "redigerer private
    // detaljer før delelink og AI modtager eventet". Denne test antager
    // BEVIDST det modsatte (som om den redigering fejlede opstrøms) for at
    // bevise, at collectUpcomingEvents() har sit eget, uafhængige lag:
    // typen den returnerer ({title, start, allDay, memberName}) gør det
    // umuligt at lække description/location videre til AI-prompten, uanset
    // hvad opstrøms funktionen leverer.
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([
      {
        title: "Optaget",
        description: "Følsomme lægenoter — må aldrig nå AI'en",
        location: "Klinik 4 — må aldrig nå AI'en",
        start: "2026-08-18T10:00:00.000Z",
        end: "2026-08-18T11:00:00.000Z",
        allDay: false,
        memberName: "Nicolaj",
        memberColor: "#2E7D32",
      },
    ]);

    await sendWeeklySummaries(env, aSunday);

    expect(generateWeeklySummaryMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        events: [
          { title: "Optaget", start: "2026-08-18T10:00:00.000Z", allDay: false, memberName: "Nicolaj" },
        ],
      }),
    );

    const [, payload] = generateWeeklySummaryMock.mock.calls[0]!;
    expect(JSON.stringify(payload)).not.toContain("lægenoter");
    expect(JSON.stringify(payload)).not.toContain("Klinik 4");
  });
});

describe("computeCurrentWeekStart", () => {
  it("returns this week's Monday when today is midweek", () => {
    expect(computeCurrentWeekStart("2026-08-19")).toBe("2026-08-17");
  });

  it("returns the same date when today already is a Monday", () => {
    expect(computeCurrentWeekStart("2026-08-17")).toBe("2026-08-17");
  });

  // Regression (Nicolaj, 2026-08-30): søndag er sidste dag i sin egen uge,
  // så en naiv "gå baglæns til mandag" gav ugen der er ved at slutte — et
  // helt andet resumé end det, kortet allerede viser (som altid er den
  // kommende uge, sat af cron'en). Et tryk på "opdater" søndag aften
  // opdaterede derfor et usynligt resumé, mens det synlige stod uændret.
  it("treats Sunday as tomorrow's week, matching computeUpcomingWeekStart and what the card already shows", () => {
    expect(computeCurrentWeekStart("2026-08-16")).toBe("2026-08-17");
  });
});

describe("generateWeeklySummaryForFamily", () => {
  beforeEach(() => {
    generateWeeklySummaryMock.mockReset().mockResolvedValue("Et frisk resumé.");
    fetchPublicFamilyCalendarEventsMock.mockReset().mockResolvedValue([]);
  });

  it("reports no-data without calling the AI when nothing is open", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    const family = { id: "family-1", ownerUserId: "owner" };

    const outcome = await generateWeeklySummaryForFamily(env, family, "2026-08-17", "2026-08-23");

    expect(outcome).toEqual({ status: "no-data" });
    expect(generateWeeklySummaryMock).not.toHaveBeenCalled();
  });

  it("updates, rather than duplicates, an existing summary for the same week", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    const family = { id: "family-1", ownerUserId: "owner" };
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, is_done, task_date, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'fritid', 0, ?, 'owner', ?)`,
    )
      .bind("task-1", "family-1", "Køb gave", "2026-08-17", new Date().toISOString())
      .run();
    await env.DB.prepare(
      "INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind("summary-existing", "family-1", "2026-08-17", "Gammelt resumé.", "2026-08-17T09:00:00.000Z")
      .run();

    const outcome = await generateWeeklySummaryForFamily(env, family, "2026-08-17", "2026-08-23");

    expect(outcome).toEqual({ status: "generated", content: "Et frisk resumé." });
    const rows = await env.DB.prepare(
      "SELECT content FROM family_weekly_summaries WHERE family_id = ? AND week_start = ?",
    ).bind("family-1", "2026-08-17").all<{ content: string }>();
    expect(rows.results).toEqual([{ content: "Et frisk resumé." }]);
  });
});
