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
        ],
        inviteCode: "TEST1234",
      };
    } else if (path.endsWith("/weekly-summary")) {
      body = { summary: null };
    } else if (path.endsWith("/calendar-mappings")) {
      body = { mappings: [] };
    } else if (path.endsWith("/routines")) {
      body = { routines: [] };
    } else if (path.endsWith("/tasks")) {
      body = { tasks: [] };
    } else if (path.endsWith("/shopping-lists")) {
      body = { lists: [] };
    } else if (path === "/api/calendar/status") {
      body = { connected: false };
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
