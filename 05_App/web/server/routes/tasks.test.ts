import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

vi.mock("../lib/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pushNotifications")>();
  return {
    ...actual,
    sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined),
    sendPushNotificationToUser: vi.fn().mockResolvedValue(undefined),
  };
});

const { sendPushNotificationToFamily, sendPushNotificationToUser } = await import(
  "../lib/pushNotifications"
);
const { default: tasks } = await import("./tasks");

const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);
const sendPushNotificationToUserMock = vi.mocked(sendPushNotificationToUser);

let lastWaitUntilTask: Promise<unknown> | undefined;
const fakeExecutionCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    lastWaitUntilTask = promise;
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

interface TaskDto {
  id: string;
  familyId: string;
  name: string;
  icon: string;
  assignedMemberId: string | null;
  timeOfDay: string | null;
  isDone: number;
  routineItemId: string | null;
  taskDate: string | null;
  createdByUserId: string;
  createdAt: string;
  doneAt: string | null;
}

interface TaskRoutineDto {
  id: string;
  familyId: string;
  name: string;
  assignedMemberId: string | null;
  weekdays: number[];
}

async function seedFamily(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  memberUserIds: string[],
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Testfamilien", memberUserIds[0], now)
    .run();

  for (const userId of memberUserIds) {
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    )
      .bind(familyId, userId, userId === memberUserIds[0] ? "owner" : "member", now)
      .run();
  }
}

async function seedFamilyMember(
  env: ReturnType<typeof createFakeEnv>,
  options: { id: string; familyId: string; name: string; linkedUserId?: string | null },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, name, color, relation, is_placeholder_name, linked_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(
      options.id,
      options.familyId,
      options.name,
      "#000000",
      null,
      options.linkedUserId ?? null,
      new Date().toISOString(),
    )
    .run();
}

// Torsdag — bruges konsekvent i tests, så ugedags-baserede rutine-tests er
// deterministiske uafhængigt af hvornår testene reelt køres.
const aThursday = "2026-08-20";
const aFriday = "2026-08-21";

describe("task routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
    sendPushNotificationToFamilyMock.mockReset().mockResolvedValue(undefined);
    sendPushNotificationToUserMock.mockReset().mockResolvedValue(undefined);
    lastWaitUntilTask = undefined;
  });

  it("rejects any request without a session cookie", async () => {
    const response = await tasks.request(`/family-1/tasks?date=${aThursday}`, {}, env);
    expect(response.status).toBe(401);
  });

  it("returns 404 for a family the user does not belong to", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "outsider" });

    const response = await tasks.request(
      `/some-other-family/tasks?date=${aThursday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("rejects a missing or invalid date", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const missing = await tasks.request(
      "/family-1/tasks",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    expect(missing.status).toBe(400);

    const invalid = await tasks.request(
      "/family-1/tasks?date=2026-02-30",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    expect(invalid.status).toBe(400);
  });

  it("returns an empty list for a date with no tasks", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await tasks.request(
      `/family-1/tasks?date=${aThursday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const body: { tasks: TaskDto[] } = await response.json();

    expect(response.status).toBe(200);
    expect(body.tasks).toHaveLength(0);
  });

  it("creates a one-off task and notifies the family when unassigned", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    const { userId: otherUserId } = await seedLoggedInUser(env.DB as never, { id: "christine" });
    await seedFamily(env, "family-1", [userId, otherUserId]);

    const response = await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ryd op på værelset", icon: "husholdning", date: aThursday }),
      },
      env,
      fakeExecutionCtx,
    );
    const body: { tasks: TaskDto[] } = await response.json();
    await lastWaitUntilTask;

    expect(response.status).toBe(200);
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0]?.name).toBe("Ryd op på værelset");
    expect(body.tasks[0]?.assignedMemberId).toBeNull();
    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      userId,
      expect.objectContaining({ body: expect.stringContaining("Ryd op på værelset") }),
    );
    expect(sendPushNotificationToUserMock).not.toHaveBeenCalled();
  });

  it("notifies only the assigned member's own account when a task is personal", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    const { userId: childUserId } = await seedLoggedInUser(env.DB as never, { id: "alfred" });
    await seedFamily(env, "family-1", [userId, childUserId]);
    await seedFamilyMember(env, {
      id: "member-alfred",
      familyId: "family-1",
      name: "Alfred",
      linkedUserId: childUserId,
    });

    await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Børst tænder",
          icon: "hygiejne",
          date: aThursday,
          assignedMemberId: "member-alfred",
        }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    expect(sendPushNotificationToUserMock).toHaveBeenCalledWith(
      env,
      childUserId,
      expect.objectContaining({ body: expect.stringContaining("Børst tænder") }),
    );
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("sends no notification when assigned to a member without a linked account", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);
    await seedFamilyMember(env, {
      id: "member-baby",
      familyId: "family-1",
      name: "Baby",
      linkedUserId: null,
    });

    await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Lur",
          icon: "morgen",
          date: aThursday,
          assignedMemberId: "member-baby",
        }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    expect(sendPushNotificationToUserMock).not.toHaveBeenCalled();
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown icon", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", icon: "ukendt-ikon", date: aThursday }),
      },
      env,
      fakeExecutionCtx,
    );

    expect(response.status).toBe(400);
  });

  it("toggles isDone and sets/clears doneAt", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const addResponse = await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Læs bog", icon: "laesning", date: aThursday }),
      },
      env,
      fakeExecutionCtx,
    );
    const { tasks: created } = (await addResponse.json()) as { tasks: TaskDto[] };
    const taskId = created[0]!.id;
    await lastWaitUntilTask;

    const doneResponse = await tasks.request(
      `/family-1/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: true }),
      },
      env,
    );
    const doneBody = (await doneResponse.json()) as { tasks: TaskDto[] };
    expect(doneBody.tasks[0]?.isDone).toBe(1);
    expect(doneBody.tasks[0]?.doneAt).not.toBeNull();

    const undoneResponse = await tasks.request(
      `/family-1/tasks/${taskId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: false }),
      },
      env,
    );
    const undoneBody = (await undoneResponse.json()) as { tasks: TaskDto[] };
    expect(undoneBody.tasks[0]?.isDone).toBe(0);
    expect(undoneBody.tasks[0]?.doneAt).toBeNull();
  });

  it("deletes a task", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const addResponse = await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Slet mig", icon: "fritid", date: aThursday }),
      },
      env,
      fakeExecutionCtx,
    );
    const { tasks: created } = (await addResponse.json()) as { tasks: TaskDto[] };
    const taskId = created[0]!.id;
    await lastWaitUntilTask;

    const deleteResponse = await tasks.request(
      `/family-1/tasks/${taskId}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
    );
    const body = (await deleteResponse.json()) as { tasks: TaskDto[] };
    expect(body.tasks).toHaveLength(0);
  });

  it("clear-done removes only done tasks for the given date", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    async function addTask(name: string): Promise<string> {
      const response = await tasks.request(
        "/family-1/tasks",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name, icon: "fritid", date: aThursday }),
        },
        env,
        fakeExecutionCtx,
      );
      const { tasks: created } = (await response.json()) as { tasks: TaskDto[] };
      await lastWaitUntilTask;
      return created.find((task) => task.name === name)!.id;
    }

    await addTask("Ikke udført");
    const doneTaskId = await addTask("Udført");

    await tasks.request(
      `/family-1/tasks/${doneTaskId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: true }),
      },
      env,
    );

    const clearResponse = await tasks.request(
      `/family-1/tasks/clear-done?date=${aThursday}`,
      { method: "POST", headers: { Cookie: cookieHeader } },
      env,
    );
    const body = (await clearResponse.json()) as { tasks: TaskDto[] };

    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0]?.name).toBe("Ikke udført");
  });

  it("creates a routine and materializes its items only on matching weekdays", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    // aThursday er ugedag 4 (torsdag) — rutinen gælder kun mandag-onsdag (1-3).
    const createResponse = await tasks.request(
      "/family-1/task-routines",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Morgenrutine",
          weekdays: [1, 2, 3],
          items: [
            { name: "Tøj på", icon: "morgen" },
            { name: "Morgenmad", icon: "mad", timeOfDay: "07:30" },
          ],
        }),
      },
      env,
      fakeExecutionCtx,
    );
    expect(createResponse.status).toBe(200);
    await lastWaitUntilTask;

    const thursdayResponse = await tasks.request(
      `/family-1/tasks?date=${aThursday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const thursdayBody = (await thursdayResponse.json()) as { tasks: TaskDto[] };
    expect(thursdayBody.tasks).toHaveLength(0);
  });

  it("materializes routine items on a matching weekday and is idempotent across repeated GETs", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    // aFriday er ugedag 5 — rutinen gælder torsdag-fredag (4-5).
    await tasks.request(
      "/family-1/task-routines",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aftenrutine",
          weekdays: [4, 5],
          items: [
            { name: "Bad", icon: "hygiejne" },
            { name: "Læs godnathistorie", icon: "laesning", timeOfDay: "19:30" },
          ],
        }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    const firstResponse = await tasks.request(
      `/family-1/tasks?date=${aFriday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const firstBody = (await firstResponse.json()) as { tasks: TaskDto[] };
    expect(firstBody.tasks).toHaveLength(2);
    expect(firstBody.tasks.map((task) => task.name).sort()).toEqual(
      ["Bad", "Læs godnathistorie"].sort(),
    );

    // Endnu et GET samme dag må ikke duplikere rutinens opgaver.
    const secondResponse = await tasks.request(
      `/family-1/tasks?date=${aFriday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const secondBody = (await secondResponse.json()) as { tasks: TaskDto[] };
    expect(secondBody.tasks).toHaveLength(2);
  });

  it("keeps historical materialized tasks when their routine is deleted, but detaches them", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const createResponse = await tasks.request(
      "/family-1/task-routines",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Aftenrutine",
          weekdays: [4, 5],
          items: [{ name: "Bad", icon: "hygiejne" }],
        }),
      },
      env,
      fakeExecutionCtx,
    );
    const { routine } = (await createResponse.json()) as { routine: TaskRoutineDto };
    await lastWaitUntilTask;

    await tasks.request(
      `/family-1/tasks?date=${aFriday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );

    const deleteResponse = await tasks.request(
      `/family-1/task-routines/${routine.id}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
    );
    expect(deleteResponse.status).toBe(200);

    const afterResponse = await tasks.request(
      `/family-1/tasks?date=${aFriday}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const afterBody = (await afterResponse.json()) as { tasks: TaskDto[] };
    expect(afterBody.tasks).toHaveLength(1);
    expect(afterBody.tasks[0]?.routineItemId).toBeNull();
  });

  it("renames a routine and changes its weekdays", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const createResponse = await tasks.request(
      "/family-1/task-routines",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Rutine",
          weekdays: [1],
          items: [{ name: "Opgave", icon: "fritid" }],
        }),
      },
      env,
      fakeExecutionCtx,
    );
    const { routine } = (await createResponse.json()) as { routine: TaskRoutineDto };
    await lastWaitUntilTask;

    const patchResponse = await tasks.request(
      `/family-1/task-routines/${routine.id}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ny rutine", weekdays: [6, 7] }),
      },
      env,
    );
    expect(patchResponse.status).toBe(200);

    const listResponse = await tasks.request(
      "/family-1/task-routines",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const listBody = (await listResponse.json()) as {
      routines: (TaskRoutineDto & { weekdays: number[] })[];
    };
    expect(listBody.routines[0]?.name).toBe("Ny rutine");
    expect(listBody.routines[0]?.weekdays).toEqual([6, 7]);
  });

  it("rejects a routine with no weekdays or no items", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const noWeekdays = await tasks.request(
      "/family-1/task-routines",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Rutine", weekdays: [], items: [{ name: "X", icon: "fritid" }] }),
      },
      env,
      fakeExecutionCtx,
    );
    expect(noWeekdays.status).toBe(400);

    const noItems = await tasks.request(
      "/family-1/task-routines",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Rutine", weekdays: [1], items: [] }),
      },
      env,
      fakeExecutionCtx,
    );
    expect(noItems.status).toBe(400);
  });

  it("generates a routine draft from free text without saving anything", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    env.AI.run = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              name: "Morgenrutine",
              items: [
                { name: "Tandbørstning", icon: "hygiejne", timeOfDay: "07:00" },
                { name: "Tag tøj på", icon: "ukendt-ikon-fra-ai", timeOfDay: null },
              ],
            }),
          },
        },
      ],
    }) as never;

    const response = await tasks.request(
      "/family-1/task-routines/generate-draft",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ description: "morgenrutine med tandbørstning og tøj" }),
      },
      env,
    );
    const body: { draft: { name: string; items: { name: string; icon: string }[] } } =
      await response.json();

    expect(response.status).toBe(200);
    expect(body.draft.name).toBe("Morgenrutine");
    expect(body.draft.items).toHaveLength(2);
    // Et ukendt ikon fra AI'en falder tilbage til "fritid" i stedet for at
    // blive afvist eller gemt som en ugyldig værdi.
    expect(body.draft.items[1]?.icon).toBe("fritid");

    const listResponse = await tasks.request(
      "/family-1/task-routines",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const listBody = (await listResponse.json()) as { routines: unknown[] };
    expect(listBody.routines).toHaveLength(0);
  });

  it("returns 502 when the AI response cannot be parsed as a routine draft", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    env.AI.run = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Beklager, det kan jeg ikke hjælpe med." } }],
    }) as never;

    const response = await tasks.request(
      "/family-1/task-routines/generate-draft",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ description: "noget uklart" }),
      },
      env,
    );

    expect(response.status).toBe(502);
  });

  it("rejects an empty description for the routine draft", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await tasks.request(
      "/family-1/task-routines/generate-draft",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ description: "  " }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when the task belongs to a different family (cross-family isolation)", async () => {
    const { cookieHeader: ownerCookie, userId: ownerId } = await seedLoggedInUser(
      env.DB as never,
      { id: "owner" },
    );
    const { cookieHeader: outsiderCookie, userId: outsiderId } = await seedLoggedInUser(
      env.DB as never,
      { id: "outsider" },
    );
    await seedFamily(env, "family-1", [ownerId]);
    await seedFamily(env, "family-2", [outsiderId]);

    const addResponse = await tasks.request(
      "/family-1/tasks",
      {
        method: "POST",
        headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Privat", icon: "fritid", date: aThursday }),
      },
      env,
      fakeExecutionCtx,
    );
    const { tasks: created } = (await addResponse.json()) as { tasks: TaskDto[] };
    const taskId = created[0]!.id;
    await lastWaitUntilTask;

    const response = await tasks.request(
      `/family-2/tasks/${taskId}`,
      { method: "DELETE", headers: { Cookie: outsiderCookie } },
      env,
    );

    expect(response.status).toBe(404);
  });
});
