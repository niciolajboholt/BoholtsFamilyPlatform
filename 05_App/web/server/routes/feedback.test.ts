import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";
import feedback from "./feedback";

// Se calendar.test.ts's tilsvarende kommentar: c.executionCtx.waitUntil()
// kaster uden en (rigtig eller fake) ExecutionContext, og POST /-routen
// bruger den nu til at sende feedback-mailen uden at blokere svaret.
let lastWaitUntilTask: Promise<unknown> | undefined;
const fakeExecutionCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    lastWaitUntilTask = promise;
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

async function postFeedback(
  env: ReturnType<typeof createFakeEnv>,
  cookieHeader: string,
  body: unknown,
) {
  return feedback.request(
    "/",
    {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
    fakeExecutionCtx,
  );
}

describe("feedback routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    lastWaitUntilTask = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects any request without a session cookie", async () => {
    const env = createFakeEnv();
    const response = await feedback.request("/", {}, env);
    expect(response.status).toBe(401);
  });

  it("rejects a submission with an empty message", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await postFeedback(env, cookieHeader, {
      category: "idea",
      message: "   ",
    });

    expect(response.status).toBe(400);
  });

  it("rejects a submission with an unknown category", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await postFeedback(env, cookieHeader, {
      category: "not-a-real-category",
      message: "Godt arbejde!",
    });

    expect(response.status).toBe(400);
  });

  it("accepts a valid submission", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await postFeedback(env, cookieHeader, {
      category: "bug",
      message: "Kalenderen viser forkert tid.",
      page: "/calendar",
    });

    expect(response.status).toBe(200);
  });

  it("does not call Resend when RESEND_API_KEY is unset", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    await postFeedback(env, cookieHeader, {
      category: "idea",
      message: "Uden mail-nøgle sat.",
    });
    await lastWaitUntilTask;

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emails the admin via Resend when a submission comes in", async () => {
    const env = createFakeEnv({
      RESEND_API_KEY: { get: async () => "test-resend-key" } as never,
    });
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "line",
      email: "line@example.com",
      name: "Line",
    });

    await postFeedback(env, cookieHeader, {
      category: "bug",
      message: "Kalenderen viser forkert tid.",
      page: "/calendar",
    });
    await lastWaitUntilTask;

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-resend-key",
        }),
      }),
    );

    const requestBody: { to: string; reply_to: string; subject: string } =
      JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.to).toBe(env.ADMIN_EMAIL);
    expect(requestBody.reply_to).toBe("line@example.com");
    expect(requestBody.subject).toContain("Line");
  });

  it("does not fail the submission when Resend errors", async () => {
    const env = createFakeEnv({
      RESEND_API_KEY: { get: async () => "test-resend-key" } as never,
    });
    fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await postFeedback(env, cookieHeader, {
      category: "other",
      message: "Skal stadig gemmes, selvom mailen fejler.",
    });
    await lastWaitUntilTask;

    expect(response.status).toBe(200);
  });

  it("blocks a non-admin from reading the feedback list", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "nicolaj",
      email: "not-admin@example.com",
    });

    const response = await feedback.request(
      "/",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(403);
  });

  it("lets the admin read submitted feedback, newest first", async () => {
    const env = createFakeEnv();
    const { cookieHeader: senderCookie } = await seedLoggedInUser(
      env.DB as never,
      { id: "line", email: "line@example.com", name: "Line" },
    );

    await postFeedback(env, senderCookie, {
      category: "idea",
      message: "Første besked",
    });
    await postFeedback(env, senderCookie, {
      category: "bug",
      message: "Anden besked",
    });

    const { cookieHeader: adminCookie } = await seedLoggedInUser(env.DB as never, {
      id: "nicolaj",
      email: env.ADMIN_EMAIL,
    });

    const response = await feedback.request(
      "/",
      { headers: { Cookie: adminCookie } },
      env,
    );
    const body: {
      feedback: { message: string; senderName: string; isRead: number }[];
    } = await response.json();

    expect(response.status).toBe(200);
    expect(body.feedback).toHaveLength(2);
    expect(body.feedback[0].message).toBe("Anden besked");
    expect(body.feedback[0].senderName).toBe("Line");
    expect(body.feedback[0].isRead).toBe(0);
  });

  it("blocks a non-admin from marking feedback as read", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "nicolaj",
      email: "not-admin@example.com",
    });

    const response = await feedback.request(
      "/some-id/read",
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      },
      env,
    );

    expect(response.status).toBe(403);
  });

  it("lets the admin mark feedback as read", async () => {
    const env = createFakeEnv();
    const { cookieHeader: senderCookie } = await seedLoggedInUser(
      env.DB as never,
      { id: "line", email: "line@example.com" },
    );

    await postFeedback(env, senderCookie, {
      category: "other",
      message: "Tak for appen!",
    });

    const { cookieHeader: adminCookie } = await seedLoggedInUser(env.DB as never, {
      id: "nicolaj",
      email: env.ADMIN_EMAIL,
    });

    const listResponse = await feedback.request(
      "/",
      { headers: { Cookie: adminCookie } },
      env,
    );
    const { feedback: entries }: { feedback: { id: string }[] } =
      await listResponse.json();

    const readResponse = await feedback.request(
      `/${entries[0].id}/read`,
      {
        method: "PATCH",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      },
      env,
    );

    expect(readResponse.status).toBe(200);

    const listAfter = await feedback.request(
      "/",
      { headers: { Cookie: adminCookie } },
      env,
    );
    const { feedback: entriesAfter }: { feedback: { isRead: number }[] } =
      await listAfter.json();

    expect(entriesAfter[0].isRead).toBe(1);
  });
});
