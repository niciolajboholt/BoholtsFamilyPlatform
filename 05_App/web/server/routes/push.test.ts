import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";
import push from "./push";

describe("push routes", () => {
  it("rejects any request without a session cookie", async () => {
    const env = createFakeEnv();
    const response = await push.request("/public-key", {}, env);
    expect(response.status).toBe(401);
  });

  it("returns the configured VAPID public key", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await push.request(
      "/public-key",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const body: { publicKey: string } = await response.json();

    expect(response.status).toBe(200);
    expect(body.publicKey).toBe(env.VAPID_PUBLIC_KEY);
  });

  it("rejects a subscribe request missing required fields", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await push.request(
      "/subscribe",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example.com/a" }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it.each([
    ["http://push.example.com/a", "non-https endpoint"],
    ["https://localhost/a", "localhost"],
    ["https://127.0.0.1/a", "IPv4 loopback"],
    ["https://192.168.1.5/a", "private IPv4 range"],
    ["https://10.0.0.5/a", "private IPv4 range"],
    ["not-a-url", "not a URL at all"],
  ])("rejects a subscribe request with %s (%s)", async (endpoint) => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await push.request(
      "/subscribe",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh: "test-p256dh", auth: "test-auth" },
        }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("stores a new subscription for the logged-in user", async () => {
    const env = createFakeEnv();
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await push.request(
      "/subscribe",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://push.example.com/a",
          keys: { p256dh: "test-p256dh", auth: "test-auth" },
        }),
      },
      env,
    );

    expect(response.status).toBe(200);

    const row = await env.DB.prepare(
      "SELECT user_id AS userId FROM push_subscriptions WHERE endpoint = ?",
    )
      .bind("https://push.example.com/a")
      .first<{ userId: string }>();
    expect(row?.userId).toBe(userId);
  });

  it("re-subscribing the same device updates its keys instead of duplicating it", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    const subscribe = (p256dh: string) =>
      push.request(
        "/subscribe",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "https://push.example.com/a",
            keys: { p256dh, auth: "test-auth" },
          }),
        },
        env,
      );

    await subscribe("first-key");
    await subscribe("second-key");

    const rows = await env.DB.prepare(
      "SELECT p256dh_key AS p256dhKey FROM push_subscriptions WHERE endpoint = ?",
    )
      .bind("https://push.example.com/a")
      .all<{ p256dhKey: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.p256dhKey).toBe("second-key");
  });

  it("removes a subscription on unsubscribe, scoped to the requesting user", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await push.request(
      "/subscribe",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: "https://push.example.com/a",
          keys: { p256dh: "k", auth: "a" },
        }),
      },
      env,
    );

    const response = await push.request(
      "/subscribe",
      {
        method: "DELETE",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "https://push.example.com/a" }),
      },
      env,
    );

    expect(response.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT 1 AS found FROM push_subscriptions WHERE endpoint = ?",
    )
      .bind("https://push.example.com/a")
      .first();
    expect(row).toBeNull();
  });
});
