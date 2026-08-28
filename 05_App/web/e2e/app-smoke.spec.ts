import AxeBuilder from "@axe-core/playwright";
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
            // "Andet", ikke "Voksen": familyMemberRelations.ts's tilladte
            // værdier er kun Far/Mor/Barn/Andet — en ugyldig relation gør
            // hele medlemmet ugyldigt for isValidMember() i
            // familyMembersStorage.ts, hvilket stille lader getFamilyMembers()
            // falde tilbage til de generiske seed-medlemmer i stedet for
            // denne mock (fandt dette ved fejlsøgning af redaktionstesten
            // nedenfor, som afhænger af currentMember rent faktisk matcher
            // et virkeligt familiemedlem-id).
            relation: "Andet",
            isPlaceholderName: 0,
            linkedUserId: "user-e2e",
          },
          {
            id: "member-chris",
            name: "Chris",
            color: "#C97653",
            // "Andet", ikke "Voksen": familyMemberRelations.ts's tilladte
            // værdier er kun Far/Mor/Barn/Andet — en ugyldig relation gør
            // hele medlemmet ugyldigt for isValidMember() i
            // familyMembersStorage.ts, hvilket stille lader getFamilyMembers()
            // falde tilbage til de generiske seed-medlemmer i stedet for
            // denne mock (fandt dette ved fejlsøgning af redaktionstesten
            // nedenfor, som afhænger af currentMember rent faktisk matcher
            // et virkeligt familiemedlem-id).
            relation: "Andet",
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

test("mobile week rows keep time, title and member in separate columns", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await mockAuthenticatedApi(page);
  await page.goto("/calendar");

  await page.getByRole("button", { name: "Uge", exact: true }).click();

  const eventCard = page.locator(
    'button[title*="Tandlæge og efterfølgende kontrol"]',
  );
  await expect(eventCard).toBeVisible();

  const time = eventCard.getByTestId("week-event-time");
  const title = eventCard.getByTestId("week-event-title");
  const owner = eventCard
    .getByTestId("week-event-owners")
    .getByText("Alex", { exact: true });

  const [timeBox, titleBox, ownerBox] = await Promise.all([
    time.boundingBox(),
    title.boundingBox(),
    owner.boundingBox(),
  ]);

  expect(timeBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(ownerBox).not.toBeNull();
  expect(timeBox!.x).toBeLessThan(titleBox!.x);
  expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(ownerBox!.x + 1);

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

test("offline calendar shows cached events with a visible staleness banner", async ({
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

  // Kun selve hentningen af aftaler fejler i det kontrollerede vindue — ikke
  // en global offline-tilstand — samme afgrænsede tilgang som de øvrige
  // offline-tests i denne fil (undgår at ramme et helt andet, samtidigt
  // kald under den fejlagtige antagelse at "offline" betyder "intet
  // netværkskald lykkes").
  let shouldFailEvents = false;

  await page.route("**/api/calendar/calendars/*/events*", async (route) => {
    if (route.request().method() === "GET" && shouldFailEvents) {
      await route.abort("internetdisconnected");
      return;
    }

    await route.fallback();
  });

  await page.goto("/calendar");
  await page.getByRole("button", { name: "Familie", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Fælles fødselsdag hos familien/ }),
  ).toBeVisible();

  // Genindlæser siden helt forfra — GoogleCalendarProvider har intet i
  // hukommelsen, kun hvad der ligger i localStorage's sync-cache fra det
  // første, vellykkede besøg ovenfor.
  shouldFailEvents = true;
  await page.reload();
  await page.getByRole("button", { name: "Familie", exact: true }).click();

  // Fase 8: GoogleCalendarProvider.getEvents() falder tilbage til den
  // lokale cache ved en netværksfejl — aftalen skal stadig vises, med en
  // synlig besked om at den er fra cachen, ikke tavst som live data.
  await expect(
    page.getByRole("button", { name: /Fælles fødselsdag hos familien/ }),
  ).toBeVisible();
  await expect(page.getByText(/viser gemte aftaler fra/)).toBeVisible();

  shouldFailEvents = false;
  await page.reload();
  await page.getByRole("button", { name: "Familie", exact: true }).click();

  await expect(
    page.getByRole("button", { name: /Fælles fødselsdag hos familien/ }),
  ).toBeVisible();
  await expect(page.getByText(/viser gemte aftaler fra/)).not.toBeVisible();
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

test("primary pages have no WCAG 2.0/2.1 A/AA accessibility violations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(60_000);
  await mockAuthenticatedApi(page);

  for (const path of ["/", "/calendar", "/shopping-list", "/tasks", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  }
});

// Fase 2: axe-core (ovenfor) tjekker statisk ARIA-opmærkning, men fanger
// hverken en reel tastaturfælde i en dialog eller om et fokuseret element
// rent faktisk er synligt — begge kræver at man faktisk tabber sig igennem.
const sidebarNavLabels = ["Overblik", "Kalender", "Indkøb", "Opgaver", "Indstillinger"];

test("desktop sidebar navigation is reachable by keyboard, and no focused element becomes invisible", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  test.setTimeout(60_000);
  await mockAuthenticatedApi(page);

  for (const path of ["/", "/calendar", "/shopping-list", "/tasks", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();

    const seenNavLabels = new Set<string>();
    const maxTabs = 80;

    for (let tabIndex = 0; tabIndex < maxTabs; tabIndex += 1) {
      await page.keyboard.press("Tab");

      const focusInfo = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;

        // getClientRects() (unlike offsetParent) correctly reports an empty
        // list for display:none/detached elements while still recognising
        // position:fixed elements (e.g. the mobile bottom nav) as visible.
        return {
          isVisible: element.getClientRects().length > 0,
          text: element.textContent?.trim() ?? "",
        };
      });

      if (!focusInfo) {
        // Fokus forlod siden (fx tilbage til browserens eget UI ved den
        // sidste fokuserbare kontrol) — ikke en fejl i appen selv.
        continue;
      }

      expect(
        focusInfo.isVisible,
        `Tab-tryk ${tabIndex + 1} på ${path} flyttede fokus til et element uden nogen synlig boks`,
      ).toBe(true);

      const matchedLabel = sidebarNavLabels.find((label) => focusInfo.text === label);
      if (matchedLabel) {
        seenNavLabels.add(matchedLabel);
      }

      if (seenNavLabels.size === sidebarNavLabels.length) break;
    }

    for (const label of sidebarNavLabels) {
      expect(
        seenNavLabels.has(label),
        `"${label}" i venstremenuen blev aldrig nået med Tab på ${path}`,
      ).toBe(true);
    }
  }
});

test("a Settings dialog traps keyboard focus while open and restores it to the trigger on Escape", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);
  await page.goto("/settings");

  const trigger = page.getByRole("button", { name: /Kalenderforbindelser/ });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Kalenderforbindelser" });
  await expect(dialog).toBeVisible();

  // MUI's Dialog flytter automatisk fokus ind i dialogen ved åbning — enten
  // til selve dialog-elementet (tabindex="-1") eller et element i den, så
  // tjekket dækker begge ("contains" inkluderer elementet selv).
  async function isFocusInsideDialog(): Promise<boolean> {
    return page.evaluate(() => {
      const dialogElement = document.querySelector('[role="dialog"]');
      return Boolean(
        dialogElement && document.activeElement && dialogElement.contains(document.activeElement),
      );
    });
  }

  expect(await isFocusInsideDialog(), "Fokus blev ikke flyttet ind i dialogen ved åbning").toBe(
    true,
  );

  // Tab langt ud over antallet af fokuserbare elementer i dialogen — fokus
  // må aldrig sive ud til siden bagved, uanset hvor mange gange der tabbes.
  for (let tabIndex = 0; tabIndex < 40; tabIndex += 1) {
    await page.keyboard.press("Tab");

    expect(
      await isFocusInsideDialog(),
      `Tab-tryk ${tabIndex + 1} flyttede fokus uden for dialogen`,
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
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

test("a private calendar event is fully visible to its owner and redacted to 'Optaget' for another family member", async ({
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

  const realTitle = "Fortrolig lægesamtale";
  const realDescription = "Følsomme noter om behandlingsforløbet";
  const realLocation = "Sundhedshuset, lokale 4";

  // alex-calendar er kortlagt til member-e2e (Alex) i mockAuthenticatedApi's
  // calendar-mappings-mock — kun overskriver selve alex-calendar-events-
  // kaldet, alt andet falder tilbage til den generelle mock.
  await page.route("**/api/calendar/calendars/*/events*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const calendarId = decodeURIComponent(path.split("/")[4] ?? "");

    if (route.request().method() !== "GET" || calendarId !== "alex-calendar") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "alex-calendar-event",
            summary: realTitle,
            description: realDescription,
            location: realLocation,
            visibility: "private",
            status: "confirmed",
            start: { dateTime: "2026-08-27T08:15:00+02:00" },
            end: { dateTime: "2026-08-27T09:15:00+02:00" },
          },
        ],
        nextSyncToken: "alex-calendar-sync-token",
      }),
    });
  });

  // Fase 3/5: hvem "er mig" på denne enhed afgør redigeringen
  // (redactCalendarEventForViewer, nøglet på currentMember.id) — sat direkte
  // i localStorage, samme mønster som appens øvrige enheds-indstillinger,
  // efterfulgt af en fuld genindlæsning (useCurrentMember læser kun værdien
  // ved mount).
  // Bruger bevidst standard-månedsvisningen, ikke "Familie"-planner-
  // visningen: den sidste viser kun familie-/flerpersonsaftaler i sin egen
  // kolonne (getPlannerEventsForColumn) og ville derfor slet ikke vise en
  // enkeltpersons-aftale som denne. Månedsvisningen viser alle synlige
  // kalendres aftaler uafhængigt af den fordeling.
  await page.goto("/calendar");
  // useFamilyMembers() læser kun localStorage ÉN gang, ved sin egen mount —
  // den opdaterer sig aldrig af sig selv, hvis AppLayout's baggrunds-synk
  // (familyMembersSync.ts) skriver en frisk medlemsliste EFTER dette
  // komponent allerede er monteret. Uden dette wait ville et reload lige
  // efter risikere at ramme det vindue, og currentMember ville forblive
  // null resten af testen (fundet ved fejlsøgning: se AppLayout.tsx's
  // returnerende-bruger-synk, linje ~124-141).
  await page.waitForFunction(() => localStorage.getItem("boholts-family-members") !== null);
  await page.evaluate(() => localStorage.setItem("boholts-current-member-id", "member-e2e"));
  await page.reload();

  const ownerEventButton = page.getByRole("button", {
    name: new RegExp(`Rediger aftale: ${realTitle}`),
  });
  await expect(ownerEventButton).toBeVisible();
  await expect(page.getByText("Optaget")).not.toBeVisible();

  await ownerEventButton.click();
  await expect(page.getByLabel("Titel")).toHaveValue(realTitle);
  await expect(page.getByLabel("Beskrivelse (valgfrit)")).toHaveValue(realDescription);
  await expect(page.getByLabel("Sted (valgfrit)")).toHaveValue(realLocation);
  await expect(
    page.getByText("Dette er en privat aftale. Kun det tilknyttede familiemedlem"),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Annuller" }).click();

  await page.evaluate(() => localStorage.setItem("boholts-current-member-id", "member-chris"));
  await page.reload();

  const redactedEventButton = page.getByRole("button", {
    name: /Rediger aftale: Optaget,/,
  });
  await expect(redactedEventButton).toBeVisible();
  await expect(page.getByText(realTitle)).not.toBeVisible();
  await expect(page.getByText(realDescription)).not.toBeVisible();
  await expect(page.getByText(realLocation)).not.toBeVisible();

  await redactedEventButton.click();
  await expect(
    page.getByText("Dette er en privat aftale. Kun det tilknyttede familiemedlem"),
  ).toBeVisible();
  await expect(page.getByLabel("Titel")).toHaveValue("Optaget");
  await expect(page.getByLabel("Beskrivelse (valgfrit)")).toHaveValue("");
  await expect(page.getByLabel("Sted (valgfrit)")).toHaveValue("");
});

// Fase 3: adgangskontrol og læsning/visning af en privat aftale er dækket
// ovenfor — selve REDIGERINGS-flowet (gem-kaldets faktiske payload) var
// stadig udækket. Dækker to ting i ét flow: (1) et almindeligt feltskift på
// en privat aftale skal bevare visibility: "private" i skrivekaldet, og
// (2) at slå "Privat aftale"-kontakten fra og gemme skal rent faktisk sende
// visibility: "default" — ikke kun opdatere UI'et lokalt.
test("editing an existing private event sends the updated fields, and turning privacy off actually clears it server-side", async ({
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

  const originalTitle = "Fortrolig lægesamtale";
  const originalDescription = "Følsomme noter om behandlingsforløbet";
  const renamedTitle = "Fortrolig lægesamtale, flyttet til fredag";

  // Efter et gem genhenter appen (refreshEvents() i useCalendarEvents.ts) —
  // en statisk GET-mock ville derfor stadig vise de oprindelige data efter
  // en vellykket redigering. GET'et skal i stedet afspejle den seneste
  // PATCH, ligesom ICS-abonnements-testens mutable `subscriptions`-mønster.
  let currentSummary = originalTitle;
  let currentVisibility: string | undefined = "private";

  await page.route("**/api/calendar/calendars/*/events*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const calendarId = decodeURIComponent(path.split("/")[4] ?? "");

    if (route.request().method() !== "GET" || calendarId !== "alex-calendar") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "alex-calendar-event",
            summary: currentSummary,
            description: originalDescription,
            visibility: currentVisibility,
            status: "confirmed",
            start: { dateTime: "2026-08-27T08:15:00+02:00" },
            end: { dateTime: "2026-08-27T09:15:00+02:00" },
          },
        ],
        nextSyncToken: "alex-calendar-sync-token",
      }),
    });
  });

  let patchedBody: Record<string, unknown> | undefined;
  // Opdatering går til /events/:eventId (PATCH), til forskel fra opret-
  // testens rene /events (POST) — kræver et separat mønster med det
  // ekstra sti-segment, ellers matcher det aldrig.
  await page.route("**/api/calendar/calendars/*/events/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    patchedBody = route.request().postDataJSON() as Record<string, unknown>;
    currentSummary = patchedBody.summary as string;
    currentVisibility = patchedBody.visibility as string | undefined;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "alex-calendar-event",
        summary: patchedBody.summary,
        description: patchedBody.description,
        visibility: patchedBody.visibility,
        start: patchedBody.start,
        end: patchedBody.end,
      }),
    });
  });

  await page.goto("/calendar");
  await page.waitForFunction(() => localStorage.getItem("boholts-family-members") !== null);
  await page.evaluate(() => localStorage.setItem("boholts-current-member-id", "member-e2e"));
  await page.reload();

  const ownerEventButton = page.getByRole("button", {
    name: new RegExp(`Rediger aftale: ${originalTitle}`),
  });
  await expect(ownerEventButton).toBeVisible();
  await ownerEventButton.click();

  // 1) Et almindeligt feltskift må ikke stille og utilsigtet rydde
  // privatlivsvalget — visibility skal forblive "private" i skrivekaldet.
  await page.getByLabel("Titel").fill(renamedTitle);
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  await expect.poll(() => patchedBody?.summary).toBe(renamedTitle);
  expect(patchedBody?.visibility).toBe("private");

  // 2) Slå privatliv fra på den samme aftale og gem igen — skrivekaldet skal
  // rent faktisk rydde visibility, ikke kun opdatere den lokale visning.
  patchedBody = undefined;
  const renamedEventButton = page.getByRole("button", {
    name: new RegExp(`Rediger aftale: ${renamedTitle}`),
  });
  await expect(renamedEventButton).toBeVisible();
  await renamedEventButton.click();

  await page
    .getByRole("switch", { name: "Privat aftale – familien ser kun Optaget" })
    .uncheck();
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  await expect.poll(() => patchedBody?.visibility).toBe("default");
});

test("a public share link redacts a private event's title, description, and location", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");

  // Denne side går bevidst ikke gennem AppLayout's login-gate (se
  // PublicSharedCalendarPage.tsx) — henter direkte fra
  // /api/public/family-calendar/:token uden nogen sessions-cookie, præcis
  // som en reel modtager af et delt link ville opleve det. Ingen
  // mockAuthenticatedApi nødvendig.
  const publicToken = "e2e-share-token";

  // Begge aftaler lægges på "i dag", så PublicSharedCalendarPage's
  // standardvalgte dato (new Date()) allerede viser dem uden at skulle
  // navigere måned/dag først.
  const today = new Date();
  const isoAt = (hour: number): string =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, 0, 0).toISOString();

  await page.route(`**/api/public/family-calendar/${publicToken}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        familyName: "Testfamilien",
        events: [
          {
            title: "Fælles bowling",
            start: isoAt(17),
            end: isoAt(18),
            allDay: false,
            description: "Alle er velkomne",
            location: "Bowlinghallen",
            memberName: "Familien",
            memberColor: "#6D597A",
          },
          // Serveren har allerede redigeret dette (publicCalendar.ts +
          // getSafeGoogleEventDetails) — title er "Optaget", uden
          // description/location overhovedet i svaret. Testen bekræfter, at
          // klienten ikke selv finder på at vise noget ekstra, ikke at den
          // selv udfører redigeringen (det er server-sidens ansvar, allerede
          // dækket af googleCalendarAggregation.test.ts og
          // publicCalendar.test.ts).
          {
            title: "Optaget",
            start: isoAt(20),
            end: isoAt(21),
            allDay: false,
            memberName: "Alex",
            memberColor: "#2F6B4F",
          },
        ],
      }),
    }),
  );

  await page.goto(`/share/${publicToken}`);
  await expect(page.getByRole("heading", { name: "Testfamilien" })).toBeVisible();

  await page.getByRole("button", { name: "Åbn aftalen Fælles bowling" }).click();
  const detailsDialog = page.getByRole("dialog");
  await expect(detailsDialog.getByRole("heading", { name: "Fælles bowling" })).toBeVisible();
  await expect(detailsDialog.getByText("Bowlinghallen")).toBeVisible();
  await expect(detailsDialog.getByText("Alle er velkomne")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detailsDialog).not.toBeVisible();

  await page.getByRole("button", { name: "Åbn aftalen Optaget" }).click();
  await expect(detailsDialog.getByRole("heading", { name: "Optaget" })).toBeVisible();
  await expect(detailsDialog.getByText("Bowlinghallen")).not.toBeVisible();
  await expect(detailsDialog.getByText("Alle er velkomne")).not.toBeVisible();
});

test("a family member can add and remove an ICS calendar subscription in Settings", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  let subscriptions: Array<Record<string, unknown>> = [];
  let lastPatchedColor: string | null | undefined;

  await page.route("**/api/families/*/ics-subscriptions", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subscriptions }),
      });
      return;
    }

    if (method === "POST") {
      const posted = route.request().postDataJSON() as {
        url: string;
        label: string;
        familyMemberId?: string | null;
        color?: string | null;
      };
      subscriptions = [
        ...subscriptions,
        {
          id: "sub-1",
          familyId: family.id,
          url: posted.url,
          label: posted.label,
          familyMemberId: posted.familyMemberId ?? null,
          color: posted.color ?? null,
          lastFetchedAt: null,
          lastFetchStatus: null,
          createdAt: new Date().toISOString(),
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subscriptions }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/families/*/ics-subscriptions/*", async (route) => {
    const method = route.request().method();

    if (method === "PATCH") {
      const patched = route.request().postDataJSON() as {
        label?: string;
        familyMemberId?: string | null;
        color?: string | null;
      };
      if (patched.color !== undefined) {
        lastPatchedColor = patched.color;
      }
      subscriptions = subscriptions.map((subscription) => ({
        ...subscription,
        ...(patched.label !== undefined ? { label: patched.label } : {}),
        ...(patched.familyMemberId !== undefined
          ? { familyMemberId: patched.familyMemberId }
          : {}),
        ...(patched.color !== undefined ? { color: patched.color } : {}),
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subscriptions }),
      });
      return;
    }

    if (method !== "DELETE") {
      await route.fallback();
      return;
    }

    subscriptions = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscriptions }),
    });
  });

  await page.goto("/settings");
  await page.getByRole("button", { name: /Kalenderforbindelser/ }).click();
  const connectionsDialog = page.getByRole("dialog", { name: "Kalenderforbindelser" });
  await expect(connectionsDialog).toBeVisible();
  await expect(connectionsDialog.getByText("Delt kalender (ICS)")).toBeVisible();

  // Delte kalendere (ICS) har sin egen dialog, åbnet fra en række i
  // "Kalenderforbindelser" — samme niveau som Google/Outlook — i stedet for
  // at være indlejret direkte i den dialog, efter ønske fra Nicolaj.
  await connectionsDialog
    .getByRole("button", { name: "Administrér delte kalendere (ICS)" })
    .click();
  const icsDialog = page.getByRole("dialog", { name: "Delte kalendere" });
  await expect(icsDialog).toBeVisible();

  await icsDialog.getByLabel("Navn").fill("Skolekalender 3A");
  await icsDialog.getByLabel("ICS-link").fill("https://calendar.skole.dk/klasse-3a.ics");
  await icsDialog.getByLabel("Tildel familiemedlem (valgfrit)").click();
  await page.getByRole("option", { name: "Chris" }).click();
  await icsDialog.getByRole("button", { name: "Tilføj kalender" }).click();

  await expect(icsDialog.getByText("Skolekalender 3A")).toBeVisible();

  // Redigér navn, medlemstildeling og farve på det netop tilføjede
  // abonnement — ikke selve ICS-linket, jf. Nicolajs afgrænsning af ønsket.
  await icsDialog.getByRole("button", { name: "Redigér Skolekalender 3A" }).click();
  await icsDialog.getByLabel("Navn").fill("Skolekalender 3B");
  await icsDialog.getByLabel("Tildel familiemedlem (valgfrit)").click();
  await page.getByRole("option", { name: "Ikke tildelt" }).click();

  // Farvevælgeren vises kun, når intet familiemedlem er tildelt — netop
  // muliggjort ved skiftet til "Ikke tildelt" ovenfor.
  await icsDialog.getByRole("button", { name: "Vælg farven #D99832" }).click();
  await icsDialog.getByRole("button", { name: "Gem" }).click();

  await expect(icsDialog.getByText("Skolekalender 3B")).toBeVisible();
  await expect(icsDialog.getByText("Skolekalender 3A")).not.toBeVisible();
  await expect(icsDialog.getByText("Ikke tildelt")).toBeVisible();
  expect(lastPatchedColor).toBe("#D99832");

  await icsDialog.getByRole("button", { name: "Fjern Skolekalender 3B" }).click();
  await expect(icsDialog.getByText("Skolekalender 3B")).not.toBeVisible();
  await expect(icsDialog.getByText("Tilføj ny")).toBeVisible();
});

// Fase 5: "Opret, redigér og slet kalenderaftale med mock/testkonto" — hele
// flowet gennem den rigtige UI, ikke kun det isolerede opret-kald (allerede
// dækket af "creating a private event..." ovenfor) eller det isolerede
// redigér-kald (allerede dækket af "editing an existing private event...").
// Bemærk: gentagne aftaler kan IKKE testes gennem UI'et her — hverken
// "Ny aftale"-dialogens gentagelsesvalg eller redigér-dialogens "Kun denne
// forekomst/Hele rækken"-valg vises for en Google-kalenderkilde (kun for en
// "internal" kilde, som ikke længere findes i produktionskoden, jf.
// ADR-017/CompositeCalendarProvider.ts) — se Fase 5's "Mangler".
test("a family member can create, edit, and delete a calendar event through the real UI", async ({
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

  const originalTitle = "Tandlægebesøg";
  const renamedTitle = "Synskontrol";
  let currentEvent: Record<string, unknown> | null = null;

  await page.route("**/api/calendar/calendars/*/events*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const calendarId = decodeURIComponent(path.split("/")[4] ?? "");

    if (calendarId !== "alex-calendar") {
      await route.fallback();
      return;
    }

    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: currentEvent ? [currentEvent] : [],
          nextSyncToken: "alex-calendar-sync-token",
        }),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const posted = route.request().postDataJSON() as Record<string, unknown>;
      currentEvent = {
        id: "crud-test-event",
        summary: posted.summary,
        start: posted.start,
        end: posted.end,
        status: "confirmed",
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(currentEvent),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/calendar/calendars/*/events/*", async (route) => {
    const method = route.request().method();

    if (method === "PATCH") {
      const patched = route.request().postDataJSON() as Record<string, unknown>;
      currentEvent = { ...currentEvent, ...patched };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentEvent),
      });
      return;
    }

    if (method === "DELETE") {
      currentEvent = null;
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      return;
    }

    await route.fallback();
  });

  await page.goto("/calendar");

  // Opret.
  await page.getByRole("button", { name: "Ny aftale" }).click();
  await page.getByLabel("Hvem gælder aftalen for?").click();
  await page.locator('[role="option"][data-value="google:alex-calendar"]').click();
  await page.getByLabel("Titel").fill(originalTitle);
  await page.getByRole("button", { name: "Opret aftale" }).click();

  // Ankret til komma efter titlen — "Tandlægebesøg" er ellers en delstreng
  // af den omdøbte titel "Tandlægebesøg, flyttet" og ville matche begge.
  const createdEventButton = page.getByRole("button", {
    name: new RegExp(`^Rediger aftale: ${originalTitle},`),
  });
  await expect(createdEventButton).toBeVisible();

  // Redigér.
  await createdEventButton.click();
  await expect(page.getByLabel("Titel")).toHaveValue(originalTitle);
  await page.getByLabel("Titel").fill(renamedTitle);
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  const renamedEventButton = page.getByRole("button", {
    name: new RegExp(`^Rediger aftale: ${renamedTitle},`),
  });
  await expect(renamedEventButton).toBeVisible();
  await expect(createdEventButton).not.toBeVisible();

  // Slet.
  await renamedEventButton.click();
  await page.getByRole("button", { name: "Slet" }).click();
  await page.getByRole("button", { name: "Bekræft sletning" }).click();

  await expect(renamedEventButton).not.toBeVisible();
});

// Fase 5: "Fuldt invitations-/rolleflow gennem UI'et" — del 1: en helt ny
// bruger (ingen familie, ingen localStorage) taster en invitationskode ind
// og kommer ind i appen. Egen mock (ikke mockAuthenticatedApi ovenfor), da
// denne bruger starter UDEN familie — /api/families/mine skal returnere
// family: null, indtil accept-kaldet er sket, for at FamilySetupOnboarding
// overhovedet vises (se AppLayout.tsx's isFirstLaunch-logik).
test("a brand new user can join a family with an invite code through the real UI", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");

  const joinedFamily = {
    id: "family-invite-e2e",
    name: "Nabofamilien",
    ownerUserId: "user-owner-2",
    createdAt: "2026-08-20T00:00:00.000Z",
    aiWeeklySummaryEnabled: 1,
  };
  let hasJoined = false;

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body: object = {};

    if (path === "/api/me") {
      body = {
        user: { id: "user-newcomer", email: "ny@example.com", name: "Ny Bruger", pictureUrl: null },
      };
    } else if (path === "/api/families/mine") {
      body = hasJoined
        ? { family: joinedFamily, role: "member", members: [], inviteCode: null }
        : { family: null };
    } else if (path.endsWith("/accept") && method === "POST") {
      hasJoined = true;
      body = { family: joinedFamily, role: "member", members: [] };
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
    } else if (path === "/api/calendar/calendars") {
      body = { items: [] };
    } else if (path === "/api/health") {
      body = { status: "ok", version: { id: "e2e-version-123456" } };
    } else if (path === "/api/feedback") {
      body = { feedback: [] };
    } else if (path === "/api/push/public-key") {
      body = { publicKey: "" };
    } else if (path.endsWith("/weekly-summary")) {
      body = { summary: null };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Velkommen!" })).toBeVisible();
  await page.getByRole("button", { name: "Jeg har en invitationskode" }).click();
  await page.getByLabel("Invitationskode").fill("ABCD1234");
  await page.getByRole("button", { name: "Tilslut familie" }).click();

  // Onboarding er afsluttet — appens normale skal (med hjemmesidens
  // dynamiske hilsen) vises i stedet.
  await expect(page.getByRole("heading", { name: /Godmorgen|God eftermiddag|God aften/ })).toBeVisible();
});

// Fase 5: "Fuldt invitations-/rolleflow gennem UI'et" — del 2: ejeren
// administrerer familiens konti (ikke at forveksle med family_members-
// profilerne, som allerede er dækket af andre tests) — skifter en anden
// kontos rolle og fjerner den igen, begge gennem den rigtige
// "Medlemmer og roller"-dialog i Indstillinger.
test("an owner can change a member's role and remove a member's access in Settings", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  let memberships: Array<{ userId: string; email: string; name: string; role: string; joinedAt: string }> = [
    { userId: "user-e2e", email: "familie@example.com", name: "Testbruger", role: "owner", joinedAt: "2026-08-01T00:00:00.000Z" },
    { userId: "user-chris", email: "chris@example.com", name: "Chris", role: "member", joinedAt: "2026-08-02T00:00:00.000Z" },
  ];
  let lastRoleChange: { userId: string; role: string } | null = null;

  await page.route("**/api/families/*/memberships", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ memberships }),
    });
  });

  await page.route("**/api/families/*/memberships/*/role", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const targetUserId = new URL(route.request().url()).pathname.split("/")[5];
    const posted = route.request().postDataJSON() as { role: string };
    lastRoleChange = { userId: targetUserId, role: posted.role };
    memberships = memberships.map((membership) =>
      membership.userId === targetUserId ? { ...membership, role: posted.role } : membership,
    );
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/families/*/memberships/*", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    const targetUserId = new URL(route.request().url()).pathname.split("/")[5];
    memberships = memberships.filter((membership) => membership.userId !== targetUserId);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/settings");
  await page.getByRole("button", { name: "Medlemmer og roller" }).click();
  const dialog = page.getByRole("dialog", { name: "Medlemmer og roller" });
  await expect(dialog).toBeVisible();

  // Ejerens egen række har ingen kontroller — kun tekst.
  await expect(dialog.getByText("Testbruger (dig)")).toBeVisible();
  await expect(dialog.getByText("Ejer", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Chris", { exact: true })).toBeVisible();

  await dialog.getByLabel("Rolle for Chris").click();
  await page.getByRole("option", { name: "Admin" }).click();
  await expect.poll(() => lastRoleChange).toEqual({ userId: "user-chris", role: "admin" });

  await dialog.getByRole("button", { name: "Fjern Chris" }).click();
  await expect(dialog.getByText("Chris", { exact: true })).not.toBeVisible();
});

// Konverterer en hex-farve til den rgb(...)-form, browseren rapporterer i
// getComputedStyle — bruges til at bevise den FAKTISKE gengivne farve, ikke
// kun ownerIds-værdien.
function hexToRgb(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// Fase 1-følgeret (PR #148-opfølgning): getEventOwnerColor() gav hidtil
// Familien-lilla for enhver aftale med mere end én ejer, selvom
// deltagermatchningen korrekt havde fundet flere navngivne medlemmer.
// Reel Playwright-verifikation af den FAKTISKE gengivne kantfarve — ikke
// kun at ownerIds indeholder de rigtige id'er (allerede dækket af
// googleCalendarMapper.test.ts) — for at bevise buggen er rettet visuelt,
// ikke kun i data.
test("an event with multiple matched family members shows their own colors, split, not the family color", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  // Overskriver den delte mock: Alex og Chris får en koblet konto-e-mail,
  // så deltagermatchningen kan matche dem (samme mekanisme som
  // googleCalendarMapper.ts's matchAttendeesToOwnerIds).
  await page.route("**/api/families/mine", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        family,
        role: "owner",
        members: [
          {
            id: "member-e2e",
            name: "Alex",
            color: "#2F6B4F",
            relation: "Andet",
            isPlaceholderName: 0,
            linkedUserId: "user-e2e",
            linkedUserEmail: "alex@example.com",
          },
          {
            id: "member-chris",
            name: "Chris",
            color: "#C97653",
            relation: "Andet",
            isPlaceholderName: 0,
            linkedUserId: "user-chris",
            linkedUserEmail: "chris@example.com",
          },
        ],
        inviteCode: "TEST1234",
      }),
    });
  });

  // Overskriver alex-calendars aftaler: ÉN aftale med BEGGE som Google-
  // deltagere — deltagermatchningen skal vinde over kalender-tildelingen
  // (alex-calendar er ellers kortlagt til Alex alene, jf. den delte mock).
  await page.route("**/api/calendar/calendars/alex-calendar/events*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "evt-ikea",
            summary: "Tur til IKEA",
            status: "confirmed",
            start: { dateTime: "2026-08-24T10:00:00+02:00" },
            end: { dateTime: "2026-08-24T11:30:00+02:00" },
            attendees: [{ email: "alex@example.com" }, { email: "chris@example.com" }],
          },
        ],
        nextSyncToken: "alex-calendar-sync-token",
      }),
    });
  });

  await page.goto("/calendar");
  await page.getByRole("button", { name: "Uge", exact: true }).click();

  const eventButton = page.getByRole("button", {
    name: new RegExp(`^Rediger aftale: Tur til IKEA,`),
  });
  await expect(eventButton).toBeVisible();

  // Begge navnemærkater vises — data-niveau, allerede dækket andetsteds,
  // men bekræftet igen her for at sikre den samme aftale, testens
  // farveassertion nedenfor gælder for.
  await expect(eventButton.getByText("Alex", { exact: true })).toBeVisible();
  await expect(eventButton.getByText("Chris", { exact: true })).toBeVisible();

  // Kernen i testen: den FAKTISKE gengivne kant er en opdelt gradient med
  // begge medlemmers egne farver — ikke en solid Familien-lilla kant.
  const accentImage = await eventButton.evaluate(
    (element) => getComputedStyle(element, "::before").backgroundImage,
  );
  expect(accentImage).toContain(hexToRgb("#2F6B4F"));
  expect(accentImage).toContain(hexToRgb("#C97653"));
  expect(accentImage).not.toContain(hexToRgb("#6D597A")); // Familien-farven
});

// Fase 1-følgeret (PR #148-opfølgning): et ICS-abonnement UDEN
// medlemstilknytning fik ingen ejer på selve aftalen, så
// getEventOwnerColor() faldt tilbage til Familien-lilla i stedet for
// abonnementets egen valgte farve (mapIcsCalendarSource() brugte allerede
// den rigtige farve på selve KILDEN, men aftalekortet gjorde ikke).
test("an unassigned ICS subscription's event uses the subscription's own color, not the family color", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  const subscription = {
    id: "sub-skole",
    familyId: family.id,
    url: "https://calendar.skole.dk/klasse-3a.ics",
    label: "Skolekalender 3A",
    familyMemberId: null,
    color: "#D99832",
    lastFetchedAt: null,
    lastFetchStatus: null,
    createdAt: "2026-08-26T00:00:00.000Z",
  };

  await page.route("**/api/families/*/ics-subscriptions", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscriptions: [subscription] }),
    });
  });

  await page.route("**/api/families/*/ics-subscriptions/*/events*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [
          {
            id: "evt-fodbold",
            title: "Fodboldkamp",
            start: "2026-08-24T14:00:00+02:00",
            end: "2026-08-24T15:30:00+02:00",
            allDay: false,
            isPrivate: false,
          },
        ],
      }),
    });
  });

  await page.goto("/calendar");
  await page.getByRole("button", { name: "Uge", exact: true }).click();

  const eventButton = page.getByRole("button", {
    name: new RegExp(`^Rediger aftale: Fodboldkamp,`),
  });
  await expect(eventButton).toBeVisible();

  const accentColor = await eventButton.evaluate(
    (element) => getComputedStyle(element, "::before").backgroundColor,
  );
  expect(accentColor).toBe(hexToRgb("#D99832"));
  expect(accentColor).not.toBe(hexToRgb("#6D597A")); // Familien-farven
});
