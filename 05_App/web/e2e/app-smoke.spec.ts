import { expect, test, type Page } from "@playwright/test";

const family = {
  id: "family-e2e",
  name: "Testfamilien",
  ownerUserId: "user-e2e",
  createdAt: "2026-08-26T00:00:00.000Z",
  aiWeeklySummaryEnabled: 1,
};

async function mockAuthenticatedApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: object = {};

    if (path === "/api/me") {
      body = {
        user: {
          id: "user-e2e",
          email: "familie@example.com",
          name: "Testbruger",
          pictureUrl: null,
        },
      };
    } else if (path === "/api/families/mine") {
      body = {
        family,
        role: "owner",
        members: [
          {
            id: "member-e2e",
            name: "Alex",
            color: "#2F6B4F",
            relation: "Voksen",
            isPlaceholderName: 0,
            linkedUserId: "user-e2e",
          },
          {
            id: "member-chris",
            name: "Chris",
            color: "#C97653",
            relation: "Voksen",
            isPlaceholderName: 0,
            linkedUserId: null,
          },
          {
            id: "member-billie",
            name: "Billie",
            color: "#D19A2A",
            relation: "Barn",
            isPlaceholderName: 0,
            linkedUserId: null,
          },
        ],
        inviteCode: "TEST1234",
      };
    } else if (path.endsWith("/weekly-summary")) {
      body = { summary: null };
    } else if (path.endsWith("/calendar-mappings")) {
      body = {
        mappings: [
          { googleCalendarId: "alex-calendar", familyMemberId: "member-e2e" },
          { googleCalendarId: "chris-calendar", familyMemberId: "member-chris" },
        ],
      };
    } else if (path.endsWith("/routines")) {
      body = { routines: [] };
    } else if (path.endsWith("/tasks")) {
      body = { tasks: [] };
    } else if (path.endsWith("/shopping-lists")) {
      body = { lists: [] };
    } else if (path === "/api/calendar/status") {
      body = { connected: false };
    } else if (path === "/api/calendar/calendars") {
      body = {
        items: [
          { id: "alex-calendar", summary: "Alex", accessRole: "owner" },
          { id: "chris-calendar", summary: "Chris", accessRole: "owner" },
          { id: "family-calendar", summary: "Familien", accessRole: "owner" },
        ],
      };
    } else if (path.includes("/api/calendar/calendars/") && path.endsWith("/events")) {
      const calendarId = decodeURIComponent(path.split("/")[4]);
      const summaries: Record<string, string> = {
        "alex-calendar": "Tandlæge og efterfølgende kontrol",
        "chris-calendar": "Forældremøde på skolen",
        "family-calendar": "Fælles fødselsdag hos familien",
      };
      body = {
        items: [{
          id: `${calendarId}-event`,
          summary: summaries[calendarId],
          status: "confirmed",
          start: { dateTime: "2026-08-27T08:15:00+02:00" },
          end: { dateTime: "2026-08-27T09:15:00+02:00" },
        }],
        nextSyncToken: `${calendarId}-sync-token`,
      };
    } else if (path === "/api/health") {
      body = { status: "ok", version: { id: "e2e-version-123456" } };
    } else if (path === "/api/feedback") {
      body = { feedback: [] };
    } else if (path === "/api/push/public-key") {
      body = { publicKey: "" };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("login links to public privacy and terms pages", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Boholts Familieapp" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log ind med Google" })).toHaveAttribute(
    "href",
    "/auth/google/begin",
  );

  await page.getByRole("link", { name: "privatlivspolitik" }).click();
  await expect(page.getByRole("heading", { name: "Privatlivspolitik" })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Vilkår for brug" })).toBeVisible();
});

test("authenticated family can open every primary area", async ({ page }) => {
  await mockAuthenticatedApi(page);

  const routes = [
    ["/", /Godmorgen|God eftermiddag|God aften/],
    ["/calendar", "Kalender"],
    ["/shopping-list", "Indkøbsliste"],
    ["/tasks", "Opgaver"],
    ["/settings", "Indstillinger"],
  ] as const;

  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await expect(page.getByText("Version e2e-version-")).toBeVisible();
});

test("mobile family planner is a readable agenda without horizontal overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await mockAuthenticatedApi(page);
  await page.goto("/calendar");

  await page.getByRole("button", { name: "Familie", exact: true }).click();

  const eventCard = page.getByRole("button", {
    name: /Fælles fødselsdag hos familien/,
  });
  await expect(eventCard).toBeVisible();

  const eventFitsItsCard = await eventCard.evaluate(
    (element) => element.scrollWidth <= element.clientWidth + 1,
  );
  expect(eventFitsItsCard).toBe(true);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
