import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";
import { hashPin } from "../lib/pinHashing";
import childAccess from "./childAccess";

function extractCookie(response: Response, name: string): string | null {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : null;
}

async function seedChildMember(
  env: ReturnType<typeof createFakeEnv>,
  options: {
    familyId?: string;
    memberId?: string;
    token?: string;
    pin?: string | null;
    name?: string;
    color?: string;
  } = {},
): Promise<{ familyId: string; memberId: string; token: string }> {
  const familyId = options.familyId ?? "family-1";
  const memberId = options.memberId ?? "barn-1";
  const token = options.token ?? "unguessable-child-token";
  const now = new Date().toISOString();

  await seedUser(env.DB as never, { id: "owner" });
  await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Boholt", "owner", now)
    .run();

  const pinHash = options.pin === null ? null : await hashPin(options.pin ?? "1234");

  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, name, color, relation, is_placeholder_name, created_at, child_access_token, pin_hash, pin_set_at)
     VALUES (?, ?, ?, ?, 'Barn', 0, ?, ?, ?, ?)`,
  )
    .bind(
      memberId,
      familyId,
      options.name ?? "Frida",
      options.color ?? "#D99832",
      now,
      token,
      pinHash,
      pinHash ? now : null,
    )
    .run();

  return { familyId, memberId, token };
}

describe("GET /access/:token", () => {
  it("returns the member's name and color without requiring a PIN", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { name: "Frida", color: "#D99832" });

    const response = await childAccess.request(`/access/${token}`, {}, env);
    const body = await response.json<{ name: string; color: string }>();

    expect(response.status).toBe(200);
    expect(body).toEqual({ name: "Frida", color: "#D99832" });
  });

  it("returns 404 for an unknown token", async () => {
    const env = createFakeEnv();

    const response = await childAccess.request("/access/does-not-exist", {}, env);

    expect(response.status).toBe(404);
  });
});

describe("POST /access/:token/verify", () => {
  it("creates a child session and sets a cookie on a correct PIN", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { pin: "4242" });

    const response = await childAccess.request(
      `/access/${token}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "4242" }) },
      env,
    );

    expect(response.status).toBe(200);
    expect(extractCookie(response, "child_session")).not.toBeNull();
  });

  it("rejects a wrong PIN", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { pin: "4242" });

    const response = await childAccess.request(
      `/access/${token}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "0000" }) },
      env,
    );

    expect(response.status).toBe(401);
    expect(extractCookie(response, "child_session")).toBeNull();
  });

  it("rejects when no PIN has been set yet", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { pin: null });

    const response = await childAccess.request(
      `/access/${token}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "1234" }) },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown token", async () => {
    const env = createFakeEnv();

    const response = await childAccess.request(
      "/access/does-not-exist/verify",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "1234" }) },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("rate-limits repeated wrong attempts on the same token", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { pin: "4242" });

    let lastResponse: Response | undefined;
    for (let i = 0; i < 7; i++) {
      lastResponse = await childAccess.request(
        `/access/${token}/verify`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "0000" }) },
        env,
      );
    }

    expect(lastResponse?.status).toBe(429);
  });
});

describe("session-protected routes", () => {
  async function loginAsChild(
    env: ReturnType<typeof createFakeEnv>,
    token: string,
    pin: string,
  ): Promise<string> {
    const response = await childAccess.request(
      `/access/${token}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) },
      env,
    );
    const cookie = extractCookie(response, "child_session");
    if (!cookie) throw new Error("login failed in test setup");
    return cookie;
  }

  it("rejects /me, /today and /logout without a session cookie", async () => {
    const env = createFakeEnv();

    expect((await childAccess.request("/me", {}, env)).status).toBe(401);
    expect((await childAccess.request("/today?date=2026-09-19", {}, env)).status).toBe(401);
    expect((await childAccess.request("/logout", { method: "POST" }, env)).status).toBe(401);
  });

  it("GET /me returns only this child's own identity", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { pin: "4242", name: "Frida" });
    const cookie = await loginAsChild(env, token, "4242");

    const response = await childAccess.request("/me", { headers: { Cookie: cookie } }, env);
    const body = await response.json<{ member: { name: string } }>();

    expect(response.status).toBe(200);
    expect(body.member.name).toBe("Frida");
  });

  it("GET /today only returns tasks assigned to this child, never another member's or family-wide tasks", async () => {
    const env = createFakeEnv();
    const { familyId, memberId, token } = await seedChildMember(env, { pin: "4242" });
    const cookie = await loginAsChild(env, token, "4242");

    const otherMemberId = "sibling-1";
    await env.DB.prepare(
      "INSERT INTO family_members (id, family_id, name, color, relation, is_placeholder_name, created_at) VALUES (?, ?, ?, ?, 'Barn', 0, ?)",
    )
      .bind(otherMemberId, familyId, "Anton", "#4D7EA8", new Date().toISOString())
      .run();

    const date = "2026-09-19";
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, is_done, task_date, created_by_user_id, created_at)
         VALUES ('task-mine', ?, 'Rede seng', 'bed', ?, 0, ?, 'owner', ?)`,
      ).bind(familyId, memberId, date, now),
      env.DB.prepare(
        `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, is_done, task_date, created_by_user_id, created_at)
         VALUES ('task-sibling', ?, 'Feje gulv', 'broom', ?, 0, ?, 'owner', ?)`,
      ).bind(familyId, otherMemberId, date, now),
      env.DB.prepare(
        `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, is_done, task_date, created_by_user_id, created_at)
         VALUES ('task-family', ?, 'Vande blomster', 'flower', NULL, 0, ?, 'owner', ?)`,
      ).bind(familyId, date, now),
    ]);

    const response = await childAccess.request(`/today?date=${date}`, { headers: { Cookie: cookie } }, env);
    const body = await response.json<{ tasks: { id: string }[] }>();

    expect(response.status).toBe(200);
    expect(body.tasks.map((t) => t.id)).toEqual(["task-mine"]);
  });

  it("POST /tasks/:taskId/done returns 404 for a task not assigned to this child", async () => {
    const env = createFakeEnv();
    const { familyId, token } = await seedChildMember(env, { pin: "4242" });
    const cookie = await loginAsChild(env, token, "4242");

    const otherMemberId = "sibling-1";
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO family_members (id, family_id, name, color, relation, is_placeholder_name, created_at) VALUES (?, ?, ?, ?, 'Barn', 0, ?)",
    )
      .bind(otherMemberId, familyId, "Anton", "#4D7EA8", now)
      .run();
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, is_done, task_date, created_by_user_id, created_at)
       VALUES ('task-sibling', ?, 'Feje gulv', 'broom', ?, 0, '2026-09-19', 'owner', ?)`,
    )
      .bind(familyId, otherMemberId, now)
      .run();

    const response = await childAccess.request(
      "/tasks/task-sibling/done",
      {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: true }),
      },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("POST /tasks/:taskId/done marks this child's own task done and books the reward", async () => {
    const env = createFakeEnv();
    const { familyId, memberId, token } = await seedChildMember(env, { pin: "4242" });
    const cookie = await loginAsChild(env, token, "4242");

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, is_done, task_date, created_by_user_id, created_at, reward_amount)
       VALUES ('task-mine', ?, 'Rede seng', 'bed', ?, 0, '2026-09-19', 'owner', ?, 5)`,
    )
      .bind(familyId, memberId, now)
      .run();

    const response = await childAccess.request(
      "/tasks/task-mine/done",
      {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: true }),
      },
      env,
    );
    const body = await response.json<{ tasks: { id: string; isDone: number }[] }>();

    expect(response.status).toBe(200);
    expect(body.tasks[0].isDone).toBe(1);

    const ledgerRow = await env.DB.prepare(
      "SELECT amount FROM allowance_ledger WHERE task_id = 'task-mine'",
    ).first<{ amount: number }>();
    expect(ledgerRow?.amount).toBe(5);
  });

  it("POST /logout destroys the session so the cookie no longer authenticates", async () => {
    const env = createFakeEnv();
    const { token } = await seedChildMember(env, { pin: "4242" });
    const cookie = await loginAsChild(env, token, "4242");

    const logoutResponse = await childAccess.request("/logout", { method: "POST", headers: { Cookie: cookie } }, env);
    expect(logoutResponse.status).toBe(200);

    const meResponse = await childAccess.request("/me", { headers: { Cookie: cookie } }, env);
    expect(meResponse.status).toBe(401);
  });
});
