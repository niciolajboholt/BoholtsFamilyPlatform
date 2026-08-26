// Fase 3: tyndt, autentificeret proxy-lag foran Googles Calendar API.
// Spejler GoogleCalendarApi.ts's metoder (ikke nødvendigvis Googles egne
// stier 1:1 — fx "/users/me/calendarList" bliver her bare "/calendars"),
// men videresender ellers forespørgselsparametre, request-body og Googles
// statuskode uændret. Det betyder klientens egen fejl-oversættelse
// (toProviderError i GoogleCalendarApi.ts) fortsat virker uden ændringer,
// og selve mapper-/provider-laget (googleCalendarMapper.ts,
// GoogleCalendarProvider.ts) er helt uberørt af denne fase.

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { logError } from "../lib/structuredLog";
import { GoogleNotConnectedError, getGoogleAccessToken } from "../lib/googleConnection";
import { sendPushNotificationToFamily } from "../lib/pushNotifications";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };
type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const calendar = new Hono<{ Bindings: Env; Variables: Variables }>();

const googleCalendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";

calendar.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Kalender-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

// Enhver /api/calendar/*-rute kræver en gyldig session, ligesom families.ts.
calendar.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

// Bruges af useGoogleCalendarConnection til at afgøre forbindelsesstatus —
// erstatter den tidligere klient-kun "har vi et token i hukommelsen".
calendar.get("/status", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT 1 AS ok FROM google_connections WHERE user_id = ?",
  )
    .bind(c.get("user").id)
    .first<{ ok: number }>();

  return c.json({ connected: row?.ok === 1 });
});

async function proxyToGoogle(
  c: AppContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  googlePath: string,
): Promise<Response> {
  let accessToken: string;

  try {
    accessToken = await getGoogleAccessToken(c.env, c.get("user").id);
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      return c.json({ error: error.message }, 401);
    }

    throw error;
  }

  const url = new URL(`${googleCalendarApiBaseUrl}${googlePath}`);

  for (const [key, value] of Object.entries(c.req.query())) {
    url.searchParams.set(key, value);
  }

  const hasBody = method === "POST" || method === "PATCH";

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? await c.req.text() : undefined,
  });

  const responseBody = await response.text();

  // Google svarer 204 (fx en vellykket event-sletning) uden krop — Fetch-specen
  // forbyder en non-null body på et null-body-statuskode (204/205/304), så en
  // tom streng her ville kaste "Invalid response status code 204" og fejle
  // enhver sletning gennem serveren.
  return new Response(responseBody === "" ? null : responseBody, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

// c.req.param() er typet som string | undefined, fordi AppContext her ikke
// er bundet til en bestemt rutes stimønster — men enhver kalder af denne
// funktion kommer fra en rute med ":calendarId" i stien, så værdien er i
// praksis altid sat.
function calendarPath(c: AppContext): string {
  return `/calendars/${encodeURIComponent(c.req.param("calendarId")!)}`;
}

// Sprint 21, Del A (fortsat): giver familiens andre medlemmer besked, når
// nogen opretter/redigerer/sletter en aftale. Kører via waitUntil() — svaret
// sendes til klienten med det samme, uden at vente på push-leveringen, og en
// fejlet/langsom push må aldrig få selve kalenderhandlingen (allerede
// gennemført hos Google) til at fejle eller blive forsinket.
function notifyFamilyOfCalendarChange(
  c: AppContext,
  title: string,
  body: string,
): void {
  const userId = c.get("user").id;

  const task = c.env.DB.prepare(
    "SELECT family_id AS familyId FROM family_memberships WHERE user_id = ? LIMIT 1",
  )
    .bind(userId)
    .first<{ familyId: string }>()
    .then((membership) => {
      if (!membership) {
        return;
      }

      return sendPushNotificationToFamily(c.env, membership.familyId, userId, {
        title,
        body,
        url: "/calendar",
      });
    })
    .catch((error: unknown) => {
      logError("Kunne ikke sende kalender-push-notifikation", error);
    });

  c.executionCtx.waitUntil(task);
}

async function readEventSummary(response: Response): Promise<string | undefined> {
  const event = await response
    .clone()
    .json<{ summary?: string }>()
    .catch(() => undefined);

  return event?.summary;
}

calendar.get("/calendars", (c) => proxyToGoogle(c, "GET", "/users/me/calendarList"));

calendar.get("/calendars/:calendarId/events", (c) =>
  proxyToGoogle(c, "GET", `${calendarPath(c)}/events`),
);

calendar.post("/calendars/:calendarId/events", async (c) => {
  const response = await proxyToGoogle(c, "POST", `${calendarPath(c)}/events`);

  if (response.ok) {
    const summary = await readEventSummary(response);
    notifyFamilyOfCalendarChange(
      c,
      "Ny aftale",
      summary ? `"${summary}" er tilføjet til kalenderen.` : "En ny aftale er tilføjet til kalenderen.",
    );
  }

  return response;
});

calendar.patch("/calendars/:calendarId/events/:eventId", async (c) => {
  const response = await proxyToGoogle(
    c,
    "PATCH",
    `${calendarPath(c)}/events/${encodeURIComponent(c.req.param("eventId")!)}`,
  );

  if (response.ok) {
    const summary = await readEventSummary(response);
    notifyFamilyOfCalendarChange(
      c,
      "Aftale ændret",
      summary ? `"${summary}" er blevet opdateret.` : "En aftale er blevet opdateret.",
    );
  }

  return response;
});

// Flytter aftalen til en anden af familiens kalendere — Googles egen
// "move"-handling, adskilt fra den almindelige PATCH ovenfor, fordi Google
// ikke tillader at kombinere en kalender-flytning med andre feltændringer i
// samme kald (kun destinationen). Klienten (GoogleCalendarProvider.updateEvent)
// kalder derfor denne FØRST, og patcher øvrige felter bagefter.
calendar.post("/calendars/:calendarId/events/:eventId/move", async (c) => {
  const response = await proxyToGoogle(
    c,
    "POST",
    `${calendarPath(c)}/events/${encodeURIComponent(c.req.param("eventId")!)}/move`,
  );

  if (response.ok) {
    const summary = await readEventSummary(response);
    notifyFamilyOfCalendarChange(
      c,
      "Aftale flyttet",
      summary ? `"${summary}" er flyttet til en anden kalender.` : "En aftale er flyttet til en anden kalender.",
    );
  }

  return response;
});

calendar.delete("/calendars/:calendarId/events/:eventId", async (c) => {
  const response = await proxyToGoogle(
    c,
    "DELETE",
    `${calendarPath(c)}/events/${encodeURIComponent(c.req.param("eventId")!)}`,
  );

  if (response.ok) {
    notifyFamilyOfCalendarChange(c, "Aftale slettet", "En aftale er fjernet fra kalenderen.");
  }

  return response;
});

export default calendar;
