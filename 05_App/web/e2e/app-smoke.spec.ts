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

async function getUnnamedInteractiveElements(page: Page): Promise<string[]> {
  return page
    .locator("button, a[href], input:not([type='hidden']), select, textarea")
    .evaluateAll((elements) =>
      elements.flatMap((element, index) => {
        const htmlElement = element as HTMLElement;
        const isVisible = htmlElement.offsetParent !== null;

        if (!isVisible || element.getAttribute("aria-hidden") === "true") {
          return [];
        }

        const labelledBy = (element.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .join(" ")
          .trim();
        const labels = "labels" in element
          ? Array.from((element as HTMLInputElement).labels ?? [])
              .map((label) => label.textContent?.trim() ?? "")
              .join(" ")
              .trim()
          : "";
        const imageAlt = Array.from(element.querySelectorAll("img"))
          .map((image) => image.alt.trim())
          .join(" ")
          .trim();
        const accessibleName = [
          element.getAttribute("aria-label")?.trim(),
          labelledBy,
          labels,
          htmlElement.innerText?.trim(),
          element.getAttribute("title")?.trim(),
          element.getAttribute("placeholder")?.trim(),
          imageAlt,
        ].find(Boolean);

        if (accessibleName) {
          return [];
        }

        const id = element.id ? `#${element.id}` : "";
        return [`${element.tagName.toLowerCase()}${id} (nr. ${index + 1})`];
      }),
    );
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

test("desktop week view uses readable agenda columns instead of seven narrow cards", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);
  await page.goto("/calendar");

  await page.getByRole("button", { name: "Uge", exact: true }).click();

  const dayButtons = page.getByRole("button", {
    name: /Vælg dag og opret aftale den/,
  });
  await expect(dayButtons).toHaveCount(7);

  const rowPositions = await dayButtons.evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
  );

  // Desktoplayoutet har højst tre kolonner, så syv dage skal fordele sig på
  // mindst tre rækker. Den tidligere syvkolonne-visning gav kun én række og
  // afkortede næsten alle aftaletitler.
  expect(new Set(rowPositions).size).toBeGreaterThanOrEqual(3);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("creating a private event writes provider privacy without exposing extra fields", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);
  await page.route("**/api/calendar/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    }),
  );

  let postedBody: Record<string, unknown> | undefined;
  // Google's write endpoint is called with a trailing "?sendUpdates=none"
  // query string — the pattern needs a trailing wildcard, or it never
  // matches and the request silently falls through to the generic mock.
  await page.route("**/api/calendar/calendars/*/events*", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    postedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "created-private-event",
        summary: postedBody.summary,
        visibility: postedBody.visibility,
        start: postedBody.start,
        end: postedBody.end,
      }),
    });
  });

  await page.goto("/calendar");
  await page.getByRole("button", { name: "Ny aftale" }).click();
  await page.getByLabel("Hvem gælder aftalen for?").click();
  await page.locator('[role="option"][data-value="google:alex-calendar"]').click();
  await page.getByLabel("Titel").fill("Fortrolig behandling");
  await page.getByRole("button", { name: "Flere muligheder" }).click();
  await page
    .getByRole("switch", { name: "Privat aftale – familien ser kun Optaget" })
    .check();
  await page.getByRole("button", { name: "Opret aftale" }).click();

  await expect.poll(() => postedBody?.visibility).toBe("private");
});

test("primary pages have no visible unnamed controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(60_000);
  await mockAuthenticatedApi(page);

  for (const path of ["/", "/calendar", "/shopping-list", "/tasks", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(await getUnnamedInteractiveElements(page), `Kontroller på ${path}`).toEqual([]);
  }
});

test("offline shopping list add is queued locally and syncs on reconnect", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  const list = {
    id: "list-e2e",
    familyId: family.id,
    name: "Indkøbsliste",
    type: "dagligvarer",
    createdAt: "2026-08-20T00:00:00.000Z",
  };
  let items: Array<Record<string, unknown>> = [];
  // page.context().setOffline() only blocks REAL network traffic — a
  // page.route() handler still answers locally even while "offline", since
  // it fulfills before the request ever reaches the network stack. To
  // actually exercise the app's fetch-failure path, the route handler
  // itself aborts while this flag is set, which makes fetch() reject client
  // side exactly like a real dropped connection would. Scoped to only the
  // add-item POST (not the GETs several unrelated hooks fire on page load)
  // so the test doesn't race against other components' own in-flight
  // requests to the same family/list.
  let shouldFailAddItem = false;

  await page.route("**/api/families/*/shopping-lists", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lists: [list] }),
    });
  });

  await page.route("**/api/families/*/shopping-lists/*/items", async (route) => {
    const method = route.request().method();

    if (method === "POST" && shouldFailAddItem) {
      await route.abort("internetdisconnected");
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items }),
      });
      return;
    }

    if (method === "POST") {
      const posted = route.request().postDataJSON() as { name: string };
      items = [
        ...items,
        {
          id: `item-${items.length + 1}`,
          listId: list.id,
          name: posted.name,
          category: "Andet",
          isChecked: 0,
          addedByUserId: "user-e2e",
          createdAt: new Date().toISOString(),
          checkedAt: null,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/shopping-list");
  const addItemInput = page.getByPlaceholder("Tilføj en vare…");
  await expect(addItemInput).toBeVisible();

  shouldFailAddItem = true;

  await addItemInput.fill("Mælk");
  await page.getByRole("button", { name: "Tilføj" }).click();

  await expect(
    page.getByText("1 ændring er gemt lokalt og synkroniseres, når du er online igen."),
  ).toBeVisible();
  await expect(page.getByText("Mælk", { exact: true })).not.toBeVisible();

  shouldFailAddItem = false;
  // Udløser "online"-lytteren i useShoppingList.ts, som forsøger at
  // afspille køen igen — svarer til at enheden reelt genopretter
  // forbindelsen (browseren udsender selv denne hændelse i så fald).
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(page.getByText("Mælk", { exact: true })).toBeVisible();
  await expect(
    page.getByText("1 ændring er gemt lokalt og synkroniseres, når du er online igen."),
  ).not.toBeVisible();
});

test("offline shopping list clear-checked is queued locally and syncs on reconnect", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  const list = {
    id: "list-e2e",
    familyId: family.id,
    name: "Indkøbsliste",
    type: "dagligvarer",
    createdAt: "2026-08-20T00:00:00.000Z",
  };
  let items: Array<Record<string, unknown>> = [
    {
      id: "item-1",
      listId: list.id,
      name: "Mælk",
      category: "Mejeri",
      isChecked: 1,
      addedByUserId: "user-e2e",
      createdAt: "2026-08-27T00:00:00.000Z",
      checkedAt: "2026-08-27T00:01:00.000Z",
    },
  ];
  // Kun selve ryd-afkrydsede-POST'et fejler i det kontrollerede vindue —
  // samme afgrænsede tilgang som de to andre offline-tests ovenfor/nedenfor,
  // for at undgå at ramme et helt andet, samtidigt familiedata-kald.
  let shouldFailClear = false;

  await page.route("**/api/families/*/shopping-lists", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lists: [list] }),
    });
  });

  await page.route("**/api/families/*/shopping-lists/*/clear-checked", async (route) => {
    if (shouldFailClear) {
      await route.abort("internetdisconnected");
      return;
    }

    items = items.filter((item) => !item.isChecked);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });

  await page.route("**/api/families/*/shopping-lists/*/items", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    });
  });

  await page.goto("/shopping-list");
  const clearButton = page.getByRole("button", { name: "Ryd afkrydsede" });
  await expect(clearButton).toBeVisible();
  await expect(page.getByText("Mælk", { exact: true })).toBeVisible();

  shouldFailClear = true;
  await clearButton.click();

  // Optimistisk: den afkrydsede vare forsvinder med det samme, selvom
  // POST'et fejler.
  await expect(page.getByText("Mælk", { exact: true })).not.toBeVisible();
  await expect(
    page.getByText("1 ændring er gemt lokalt og synkroniseres, når du er online igen."),
  ).toBeVisible();

  shouldFailClear = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(
    page.getByText("1 ændring er gemt lokalt og synkroniseres, når du er online igen."),
  ).not.toBeVisible();
});

test("offline task toggle is queued locally and syncs on reconnect", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  const task = {
    id: "task-e2e",
    familyId: family.id,
    name: "Vande blomster",
    icon: "hjem",
    assignedMemberId: null,
    timeOfDay: null,
    isDone: 0,
    routineItemId: null,
    taskDate: "2026-08-27",
    createdByUserId: "user-e2e",
    createdAt: "2026-08-27T00:00:00.000Z",
    doneAt: null,
  };
  let isDone = 0;
  // Kun selve afkrydsnings-PATCH'et fejler i det kontrollerede vindue —
  // ikke en global "offline"-tilstand for alle ruter. mockAuthenticatedApi
  // dækker allerede GET .../tasks; flere uafhængige hooks henter samtidig
  // familiedata ved sideindlæsning, og at gøre HELE forbindelsen ustabil
  // (fx via page.context().setOffline()) rammer tilfældigt et af de andre
  // kald i stedet for selve togglet, hvilket gjorde en tidligere version af
  // denne slags test flaky (se den tilsvarende indkøbsliste-test ovenfor).
  let shouldFailToggle = false;

  await page.route("**/api/families/*/tasks?*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tasks: [{ ...task, isDone }] }),
    });
  });

  await page.route("**/api/families/*/tasks/task-e2e", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    if (shouldFailToggle) {
      await route.abort("internetdisconnected");
      return;
    }

    const patch = route.request().postDataJSON() as { isDone?: boolean };
    if (patch.isDone !== undefined) {
      isDone = patch.isDone ? 1 : 0;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tasks: [{ ...task, isDone }] }),
    });
  });

  await page.goto("/tasks");
  const checkbox = page.getByRole("checkbox").first();
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  shouldFailToggle = true;
  await checkbox.check();

  // Optimistisk: afkrydsningen vises med det samme, selvom PATCH'et fejler.
  await expect(checkbox).toBeChecked();
  await expect(
    page.getByText("1 ændring er gemt lokalt og synkroniseres, når du er online igen."),
  ).toBeVisible();

  shouldFailToggle = false;
  // Udløser "online"-lytteren i useTasks.ts, som forsøger at afspille køen
  // igen — svarer til at enheden reelt genopretter forbindelsen.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect(
    page.getByText("1 ændring er gemt lokalt og synkroniseres, når du er online igen."),
  ).not.toBeVisible();
  await expect(checkbox).toBeChecked();
});

test("primary pages fit the complete supported mobile width matrix", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(120_000);
  await mockAuthenticatedApi(page);

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    for (const path of ["/", "/calendar", "/shopping-list", "/tasks", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} ved ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
