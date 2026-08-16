// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";
import {
  sendPushNotificationToFamily,
  sendPushNotificationToUser,
} from "./pushNotifications";

// Et rigtigt, gyldigt P-256-nøglepunkt og en 16-byte auth-hemmelighed —
// encryptPayload() (inde i web-push-browsers sendPushNotification) fejler
// på ugyldige nøgler, før noget nogensinde når frem til vores fetch-mock.
const testP256dh =
  "BII4OaHD2pmkj0yz1jZyUPEjUdTmBR6-1RSFcddlvVFNumjSuGGh_WyNtKCZudb13FIMqqr47UldqpNyJSVliWY";
const testAuth = "LnQDvi2rsjVXY_aVXXjZRQ";

async function seedSubscription(
  db: ReturnType<typeof createFakeEnv>["DB"],
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(`sub-${endpoint}`, userId, endpoint, testP256dh, testAuth, new Date().toISOString())
    .run();
}

describe("pushNotifications", () => {
  let env: ReturnType<typeof createFakeEnv>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    env = createFakeEnv();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends to every registered device for a user", async () => {
    await seedUser(env.DB as never, { id: "nicolaj" });
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/a");
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/b");

    await sendPushNotificationToUser(env, "nicolaj", {
      title: "Ny aftale",
      body: "Fodboldtræning kl. 16:30",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("signs the VAPID JWT's sub claim as a single mailto: URI, not a double-prefixed one", async () => {
    // web-push-browser's sendPushNotification() takes a BARE email and
    // prepends "mailto:" itself — passing our already-prefixed
    // VAPID_SUBJECT straight through produced "mailto:mailto:..." in the
    // JWT, a malformed claim that Apple's web.push.apple.com rejected with
    // "BadJwtToken" (Windows/WNS accepted it regardless, which is why this
    // only broke on iPhones during manual testing).
    await seedUser(env.DB as never, { id: "nicolaj" });
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/a");

    await sendPushNotificationToUser(env, "nicolaj", { title: "x", body: "y" });

    const [request] = fetchMock.mock.calls[0] as [Request];
    const authHeader = request.headers.get("Authorization");
    const jwt = authHeader?.match(/t=([^,]+)/)?.[1];
    expect(jwt).toBeDefined();

    const payloadSegment = jwt!.split(".")[1];
    const payload: { sub: string } = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf-8"),
    );

    expect(payload.sub).toBe("mailto:test@example.com");
  });

  it("does nothing when the user has no registered devices", async () => {
    await seedUser(env.DB as never, { id: "nicolaj" });

    await sendPushNotificationToUser(env, "nicolaj", { title: "x", body: "y" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes a subscription that the push service reports as gone (410)", async () => {
    await seedUser(env.DB as never, { id: "nicolaj" });
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/gone");
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }));

    await sendPushNotificationToUser(env, "nicolaj", { title: "x", body: "y" });

    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?",
    )
      .bind("nicolaj")
      .first<{ count: number }>();
    expect(remaining?.count).toBe(0);
  });

  it("logs the response status and body when the push service rejects the request with a non-404/410 error", async () => {
    await seedUser(env.DB as never, { id: "nicolaj" });
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/rejected");
    fetchMock.mockResolvedValue(new Response("ugyldig VAPID-signatur", { status: 401 }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await sendPushNotificationToUser(env, "nicolaj", { title: "x", body: "y" });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("401"),
      "ugyldig VAPID-signatur",
    );

    // En afvist (ikke udløbet) subscription skal IKKE ryddes op — kun 404/410
    // betyder reelt "denne subscription findes ikke længere".
    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?",
    )
      .bind("nicolaj")
      .first<{ count: number }>();
    expect(remaining?.count).toBe(1);

    consoleErrorSpy.mockRestore();
  });

  it("keeps other devices' subscriptions when one push call fails outright", async () => {
    await seedUser(env.DB as never, { id: "nicolaj" });
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/a");
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/b");
    fetchMock.mockRejectedValueOnce(new Error("netværksfejl"));

    await sendPushNotificationToUser(env, "nicolaj", { title: "x", body: "y" });

    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?",
    )
      .bind("nicolaj")
      .first<{ count: number }>();
    expect(remaining?.count).toBe(2);
  });

  it("notifies every family member except the one who triggered the change", async () => {
    const now = new Date().toISOString();
    await seedUser(env.DB as never, { id: "nicolaj" });
    await seedUser(env.DB as never, { id: "christine" });
    await env.DB.prepare(
      "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind("family-1", "Boholt", "nicolaj", now)
      .run();
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    )
      .bind("family-1", "nicolaj", "owner", now)
      .run();
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    )
      .bind("family-1", "christine", "member", now)
      .run();
    await seedSubscription(env.DB as never, "nicolaj", "https://push.example.com/nicolaj");
    await seedSubscription(env.DB as never, "christine", "https://push.example.com/christine");

    await sendPushNotificationToFamily(env, "family-1", "nicolaj", {
      title: "Ny aftale",
      body: "Nicolaj oprettede en aftale",
    });

    // Kun Christines device skulle modtage push — Nicolaj udløste selv
    // hændelsen.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
