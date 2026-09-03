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
    } else if (path.endsWith("/activity/since-last-visit")) {
      body = {
        hasActivity: false,
        since: "2026-08-31T08:00:00.000Z",
        asOf: "2026-09-01T08:00:00.000Z",
      };
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

test("home keeps the since-last-visit feature visible when the family is up to date", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Siden sidst du var her" })).toBeVisible();
  await expect(
    page.getByText("Du er helt ajour – der er ingen nye ændringer."),
  ).toBeVisible();
});

// Forsidens "Næste aftale"/"Resten af dagen" hentede tidligere ALLE
// aftaler uden at tage hensyn til "Vis kalendere"-fravalget fra Kalender-
// siden — en kalender man havde skjult der (fx et arbejds- eller
// skoleskema) dukkede alligevel op på forsiden. Sætter chris-calendar
// skjult direkte i localStorage (samme lagringsnøgle som
// calendarSourceVisibilityStorage.ts bruger) FØR appen monterer, så
// useCalendarSources læser den skjulte tilstand ved første indlæsning.
test("home page's next-appointment widgets respect a calendar hidden via 'Vis kalendere'", async ({
  page,
}) => {
  await mockAuthenticatedApi(page);
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "boholts-family-calendar-source-visibility",
      JSON.stringify(["google:chris-calendar"]),
    );
  });

  await page.goto("/");

  await expect(page.getByText("Tandlæge og efterfølgende kontrol")).toBeVisible();
  await expect(page.getByText("Forældremøde på skolen")).not.toBeVisible();
});

// Refresh-knappen på "Ugens resumé" (svar på Nicolajs spørgsmål om, hvorfor
// resuméet ikke var kommet endnu — cron'en kører kun søndag aften, så en
// ejer/admin kan nu selv udløse et frisk resumé i stedet for at vente).
// Dækker begge tilstande: tomt-kort med "Generér nu", og opdatering af et
// allerede eksisterende resumé.
test("a family owner can generate and refresh the weekly summary from the home page", async ({ page }) => {
  await mockAuthenticatedApi(page);

  let summary: { weekStart: string; sections: { name: string; text: string }[]; createdAt: string } | null = null;
  let refreshCallCount = 0;

  await page.route("**/api/families/*/weekly-summary", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summary }) });
  });

  await page.route("**/api/families/*/weekly-summary/refresh", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    refreshCallCount += 1;
    summary = {
      weekStart: "2026-08-31",
      sections: [{ name: "Alex", text: `Resumé nummer ${refreshCallCount}.` }],
      createdAt: new Date().toISOString(),
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summary }) });
  });

  await page.goto("/");

  await expect(page.getByText("Intet resumé endnu")).toBeVisible();
  await page.getByRole("button", { name: "Generér ugens resumé nu" }).click();
  await expect(page.getByText("Resumé nummer 1.")).toBeVisible();
  await expect(page.getByText("Alex:", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Opdater ugens resumé" }).click();
  await expect(page.getByText("Resumé nummer 2.")).toBeVisible();
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
  // Ugevisningen viser den uge, browserens "nu" falder i — mockens aftale
  // har en fast dato (2026-08-24 til -30), så uret fryses til samme uge i
  // stedet for at lade testen langsomt drive ud af "denne uge", efterhånden
  // som den rigtige kalenderdato passerer den (fandt dette som årsagen til
  // en periodisk fejlende test, se PR #166).
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
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
  // Låser "nu" til samme uge som den hardkodede aftale (2026-08-27) — ellers
  // driver månedsvisningen med tiden og viser en anden måned end den,
  // aftalen faktisk ligger i (samme rodårsag som de øvrige page.clock-fix i
  // denne fil).
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
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

  // Låser "nu" til samme uge som den hardkodede aftale (2026-08-27) — se
  // samme fix ovenfor i den anden private-event-test.
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
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
// Gentagelsesoprettelse og redigeringsomfang dækkes særskilt nedenfor, så
// dette scenarie kan holde fokus på det almindelige CRUD-flow.
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

// Sprint 34: gentagne aftaler kan kun OPRETTES mod Google (se
// providerSupportsRecurrenceCreation) — testen bekræfter, at gentagelses-
// feltet rent faktisk når frem til POST-kaldet mod Google, gennem den
// samme UI-flow som den almindelige opret-test ovenfor.
test("a family member can create a recurring Google event through the real UI", async ({
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

  let postedEvent: Record<string, unknown> | null = null;

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
          items: postedEvent ? [postedEvent] : [],
          nextSyncToken: "alex-calendar-sync-token",
        }),
      });
      return;
    }

    if (route.request().method() === "POST") {
      const posted = route.request().postDataJSON() as Record<string, unknown>;
      postedEvent = {
        id: "recurring-test-event",
        summary: posted.summary,
        start: posted.start,
        end: posted.end,
        status: "confirmed",
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(postedEvent),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/calendar");

  await page.getByRole("button", { name: "Ny aftale" }).click();
  await page.getByLabel("Hvem gælder aftalen for?").click();
  await page.locator('[role="option"][data-value="google:alex-calendar"]').click();
  await page.getByLabel("Titel").fill("Svømning");

  await expect(page.getByLabel("Gentages")).toBeVisible();
  await page.getByLabel("Gentages").click();
  await page.getByRole("option", { name: "Hver uge" }).click();
  await expect(page.getByText(/^Gentages hver/)).toBeVisible();

  const [request] = await Promise.all([
    page.waitForRequest(
      (req) =>
        /\/api\/calendar\/calendars\/.+\/events/.test(req.url()) &&
        req.method() === "POST",
    ),
    page.getByRole("button", { name: "Opret aftale" }).click(),
  ]);

  const body = request.postDataJSON() as { recurrence?: string[] };
  expect(body.recurrence).toHaveLength(1);
  expect(body.recurrence?.[0]).toMatch(/^RRULE:FREQ=WEEKLY/);

  await expect(
    page.getByRole("button", { name: new RegExp(`^Rediger aftale: Svømning,`) }),
  ).toBeVisible();
});

test("a family member can turn an existing Google event into a recurring series", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));

  let patchedRecurrence: string[] | undefined;
  await page.route("**/api/calendar/calendars/alex-calendar/events/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const patched = route.request().postDataJSON() as {
      summary?: string;
      start?: object;
      end?: object;
      recurrence?: string[];
    };
    patchedRecurrence = patched.recurrence;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "alex-calendar-event",
        summary: patched.summary,
        start: patched.start,
        end: patched.end,
        recurrence: patched.recurrence,
      }),
    });
  });

  await page.goto("/calendar");
  await page
    .getByRole("button", {
      name: /^Rediger aftale: Tandlæge og efterfølgende kontrol,/,
    })
    .click();

  await expect(page.getByLabel("Gentages")).toBeVisible();
  await page.getByLabel("Gentages").click();
  await page.getByRole("option", { name: "Hver uge" }).click();
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  await expect.poll(() => patchedRecurrence).toEqual([
    expect.stringMatching(/^RRULE:FREQ=WEEKLY/),
  ]);
});

test("a family member can choose one occurrence or the whole Google series", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
  await page.route("**/api/calendar/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: true }),
    }),
  );

  await page.route("**/api/calendar/calendars/alex-calendar/events*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET" || !path.endsWith("/events")) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "series-1_20260827T070000Z",
            recurringEventId: "series-1",
            originalStartTime: { dateTime: "2026-08-27T07:00:00.000Z" },
            summary: "Ugentlig svømning",
            status: "confirmed",
            start: { dateTime: "2026-08-27T07:00:00.000Z" },
            end: { dateTime: "2026-08-27T08:00:00.000Z" },
          },
        ],
        nextSyncToken: "recurring-series-token",
      }),
    });
  });

  let patchedEventId: string | null = null;
  await page.route("**/api/calendar/calendars/alex-calendar/events/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const eventId = decodeURIComponent(path.split("/").at(-1) ?? "");

    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "series-1",
          summary: "Ugentlig svømning",
          start: { dateTime: "2026-08-20T07:00:00.000Z" },
          end: { dateTime: "2026-08-20T08:00:00.000Z" },
          recurrence: ["RRULE:FREQ=WEEKLY"],
        }),
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      patchedEventId = eventId;
      const patched = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: eventId, ...patched }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/calendar");
  await page
    .getByRole("button", { name: /^Rediger aftale: Ugentlig svømning,/ })
    .click();

  const scopeSelect = page.getByRole("combobox", { name: "Gælder for" });
  await expect(scopeSelect).toContainText("Kun denne forekomst");
  await scopeSelect.click();
  await page.getByRole("option", { name: "Hele rækken" }).click();
  await expect(
    page.getByText("Ændringer og sletning gælder alle aftaler i den gentagne række."),
  ).toBeVisible();

  await page.getByLabel("Titel").fill("Ugentlig svømning – hele rækken");
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  await expect.poll(() => patchedEventId).toBe("series-1");
});

// Sprint 36: et familiemedlem uden egen konto/kalender (fx et barn) kan
// hverken matches via deltagere eller kalender-tildeling (se
// matchAttendeesToOwnerIds.ts) — så "Hvem gælder aftalen for?" er nu
// tilgængelig for Google-aftaler i redigér-dialogen, til at sætte den
// tilknytning manuelt. Bekræfter det udgående PATCH-kald bærer valget som
// Googles egen extendedProperties.
test("a family member can manually assign an owner to a Google event through the real UI", async ({
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

  let patchedBody: Record<string, unknown> | undefined;

  await page.route("**/api/calendar/calendars/alex-calendar/events/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    patchedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "alex-calendar-event", ...patchedBody }),
    });
  });

  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: /^Rediger aftale: Tandlæge og efterfølgende kontrol,/ })
    .click();
  await page.getByRole("button", { name: "Flere muligheder" }).click();

  // Alex er allerede automatisk tilknyttet via kalender-tildelingen —
  // markerer også Billie, så begge indgår i den manuelle overstyring.
  await page.getByRole("checkbox", { name: "Billie" }).check();
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  await expect.poll(() => patchedBody?.extendedProperties).toEqual({
    private: { boholtsOwnerIds: "member-e2e,member-billie" },
  });
});

// Regressionstest: en almindelig redigering, der IKKE rører ejerkredsen,
// må ikke utilsigtet fastfryse det automatisk matchede ejerskab som en
// permanent Google-overstyring (se ownerIdsChanged-kommentaren i
// useEditEventDialogController.ts).
test("editing a Google event without touching ownership does not write an owner override", async ({
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

  let patchedBody: Record<string, unknown> | undefined;

  await page.route("**/api/calendar/calendars/alex-calendar/events/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    patchedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "alex-calendar-event", ...patchedBody }),
    });
  });

  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: /^Rediger aftale: Tandlæge og efterfølgende kontrol,/ })
    .click();
  await page.getByLabel("Titel").fill("Tandlæge, flyttet");
  await page.getByRole("button", { name: "Gem ændringer" }).click();

  await expect.poll(() => patchedBody?.summary).toBe("Tandlæge, flyttet");
  expect(patchedBody?.extendedProperties).toBeUndefined();
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

  // Samme uge-drift-fiksering som app-smoke.spec.ts's mobile ugevisnings-test
  // (se PR #166): mockens aftale har en fast dato i ugen 2026-08-24 til -30.
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
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

// Månedsvisningens dagsceller viste tidligere op til 5 ejer-badges, der
// brød om til flere rækker (flexWrap) — en dag med flere ejere blev derved
// synligt højere end resten af ugens celler. DayCell.tsx genbruger nu
// samme ét-linjes, overlappende badge-stil som selve aftalekortene
// (EventOwnerBadges) — bekræfter her, at en dag med fire forskellige ejere
// får præcis samme cellehøjde som en nabodag uden nogen aftaler.
test("a month-view day cell with several owners is the same height as a day with none", async ({
  page,
}, testInfo) => {
  // Mobil, ikke desktop: badge-rækken bryder kun om ved smalle cellebredder
  // — en desktop-bred celle rummer allerede 3 badges på én linje uden fix.
  test.skip(testInfo.project.name !== "mobile-chromium");

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: object = {};

    if (path === "/api/me") {
      body = { user: { id: "user-e2e", email: "familie@example.com", name: "Testbruger", pictureUrl: null } };
    } else if (path === "/api/families/mine") {
      body = {
        family,
        role: "owner",
        members: [
          { id: "member-e2e", name: "Alex", color: "#2F6B4F", relation: "Andet", isPlaceholderName: 0, linkedUserId: "user-e2e" },
          { id: "member-chris", name: "Chris", color: "#C97653", relation: "Andet", isPlaceholderName: 0, linkedUserId: null },
          { id: "member-billie", name: "Billie", color: "#D19A2A", relation: "Barn", isPlaceholderName: 0, linkedUserId: null },
          { id: "member-dana", name: "Dana", color: "#6B4FC9", relation: "Andet", isPlaceholderName: 0, linkedUserId: null },
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
          { googleCalendarId: "billie-calendar", familyMemberId: "member-billie" },
          { googleCalendarId: "dana-calendar", familyMemberId: "member-dana" },
        ],
      };
    } else if (path.endsWith("/routines")) {
      body = { routines: [] };
    } else if (path.endsWith("/tasks")) {
      body = { tasks: [] };
    } else if (path.endsWith("/shopping-lists")) {
      body = { lists: [] };
    } else if (path === "/api/calendar/status") {
      body = { connected: true };
    } else if (path === "/api/calendar/calendars") {
      body = {
        items: [
          { id: "alex-calendar", summary: "Alex", accessRole: "owner" },
          { id: "chris-calendar", summary: "Chris", accessRole: "owner" },
          { id: "billie-calendar", summary: "Billie", accessRole: "owner" },
          { id: "dana-calendar", summary: "Dana", accessRole: "owner" },
        ],
      };
    } else if (path.includes("/api/calendar/calendars/") && path.endsWith("/events")) {
      const calendarId = decodeURIComponent(path.split("/")[4]);
      // Alle fire kalendre har en aftale på SAMME dag (26/8) — de øvrige
      // dage i ugen har ingen aftaler, så deres celler er referencen.
      body = {
        items: [{
          id: `${calendarId}-event`,
          summary: `${calendarId} aftale`,
          status: "confirmed",
          start: { dateTime: "2026-08-26T08:00:00+02:00" },
          end: { dateTime: "2026-08-26T09:00:00+02:00" },
        }],
        nextSyncToken: `${calendarId}-token`,
      };
    } else if (path === "/api/health") {
      body = { status: "ok", version: { id: "e2e-version-123456" } };
    } else if (path.includes("/activity/")) {
      body = { hasActivity: false, since: null, asOf: new Date().toISOString() };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Måned", exact: true }).click();

  // Sammenligner bevidst på tværs af UGE-rækker, ikke to dage i samme
  // uge: CSS Grid strækker allerede alle celler i samme række til rækkens
  // højeste celle, så et wrap ville gøre HELE ugens række højere end
  // ugerne omkring den — ikke kun den ene dags celle. Det er præcis den
  // synlige forskel fra skærmbilledet (én ugerække tydeligt højere end
  // resten), som fixet skal fjerne.
  const busyDay = page.locator('button[aria-label*="26. august"]');
  const emptyDay = page.locator('button[aria-label*="2. september"]');
  await expect(busyDay).toBeVisible();
  await expect(emptyDay).toBeVisible();

  const busyBox = await busyDay.boundingBox();
  const emptyBox = await emptyDay.boundingBox();
  expect(busyBox).not.toBeNull();
  expect(emptyBox).not.toBeNull();
  expect(busyBox!.height).toBeCloseTo(emptyBox!.height, 0);
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

  // Samme uge-drift-fiksering som app-smoke.spec.ts's mobile ugevisnings-test
  // (se PR #166): mockens aftale har en fast dato i ugen 2026-08-24 til -30.
  await page.clock.setFixedTime(new Date("2026-08-26T09:00:00+02:00"));
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

// Fase 5: sidste åbne "Mangler"-punkt — reel Playwright-E2E for opret/
// redigér/slet gennem UI'et på indkøbsliste, opgaver og rutiner (hidtil kun
// dækket for offline-scenarier, se de tre "offline ... is queued locally"
// tests ovenfor). Ren test/dokumentation, ingen adfærdsændring.
test("a family member can add, rename, and delete a shopping list item, and create, edit, and delete a list, through the real UI", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  let lists: Array<Record<string, unknown>> = [
    {
      id: "list-groceries",
      familyId: family.id,
      name: "Dagligvarer",
      type: "dagligvarer",
      createdAt: "2026-08-20T00:00:00.000Z",
    },
  ];
  const itemsByListId: Record<string, Array<Record<string, unknown>>> = {
    "list-groceries": [],
  };

  await page.route("**/api/families/*/shopping-lists", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lists }) });
      return;
    }

    if (method === "POST") {
      const posted = route.request().postDataJSON() as { name: string; type: string };
      const newList = {
        id: `list-${lists.length + 1}`,
        familyId: family.id,
        name: posted.name,
        type: posted.type,
        createdAt: new Date().toISOString(),
      };
      lists = [...lists, newList];
      itemsByListId[newList.id as string] = [];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ list: newList }) });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/families/*/shopping-lists/*", async (route) => {
    const url = new URL(route.request().url());
    const listId = url.pathname.split("/")[5];
    const method = route.request().method();

    if (method === "PATCH") {
      const patched = route.request().postDataJSON() as { name?: string; type?: string };
      lists = lists.map((existingList) =>
        existingList.id === listId ? { ...existingList, ...patched } : existingList,
      );
      const updatedList = lists.find((existingList) => existingList.id === listId);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ list: updatedList }) });
      return;
    }

    if (method === "DELETE") {
      lists = lists.filter((existingList) => existingList.id !== listId);
      delete itemsByListId[listId!];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lists }) });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/families/*/shopping-lists/*/items", async (route) => {
    const url = new URL(route.request().url());
    const listId = url.pathname.split("/")[5];
    const method = route.request().method();
    const items = itemsByListId[listId!] ?? [];

    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
      return;
    }

    if (method === "POST") {
      const posted = route.request().postDataJSON() as { name: string };
      itemsByListId[listId!] = [
        ...items,
        {
          id: `item-${items.length + 1}`,
          listId,
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
        body: JSON.stringify({ items: itemsByListId[listId!] }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/families/*/shopping-lists/*/items/*", async (route) => {
    const url = new URL(route.request().url());
    const listId = url.pathname.split("/")[5];
    const itemId = url.pathname.split("/")[7];
    const method = route.request().method();
    const items = itemsByListId[listId!] ?? [];

    if (method === "PATCH") {
      const patched = route.request().postDataJSON() as { name?: string };
      itemsByListId[listId!] = items.map((item) => (item.id === itemId ? { ...item, ...patched } : item));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: itemsByListId[listId!] }),
      });
      return;
    }

    if (method === "DELETE") {
      itemsByListId[listId!] = items.filter((item) => item.id !== itemId);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: itemsByListId[listId!] }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/shopping-list");

  // Tilføj en vare.
  const addItemInput = page.getByPlaceholder("Tilføj en vare…");
  await addItemInput.fill("Mælk");
  await page.getByRole("button", { name: "Tilføj" }).click();
  await expect(page.getByText("Mælk", { exact: true })).toBeVisible();

  // Redigér varen (klik på navnet åbner et redigeringsfelt, autofokuseret —
  // "input[value=...]" matcher ikke pålideligt et React-kontrolleret felt,
  // da value er en DOM-egenskab, ikke en HTML-attribut).
  await page.getByText("Mælk", { exact: true }).click();
  const itemNameField = page.locator("input:focus");
  await itemNameField.fill("Sødmælk");
  // Klik væk i stedet for Enter — udløser en rigtig blur pålideligt (feltets
  // egen Enter-håndtering kalder blur() programmatisk, hvilket viste sig
  // upålideligt i headless Chromium).
  await page.getByRole("heading", { name: "Indkøbsliste" }).click();
  await expect(page.getByText("Sødmælk", { exact: true })).toBeVisible();
  await expect(page.getByText("Mælk", { exact: true })).not.toBeVisible();

  // Slet varen.
  await page.getByRole("button", { name: "Fjern Sødmælk" }).click();
  await expect(page.getByText("Sødmælk", { exact: true })).not.toBeVisible();

  // Opret en ny liste.
  await page.getByRole("tab", { name: "Opret ny liste" }).click();
  const createListDialog = page.getByRole("dialog", { name: "Opret ny liste" });
  await createListDialog.getByLabel("Navn").fill("Byggemarked-tur");
  await createListDialog.getByLabel("Byggemarked").click();
  await createListDialog.getByRole("button", { name: "Opret" }).click();
  await expect(page.getByRole("tab", { name: "Byggemarked-tur" })).toBeVisible();

  // Redigér den nye liste (navn).
  await page.getByRole("button", { name: "Flere handlinger" }).click();
  await page.getByRole("menuitem", { name: "Rediger liste" }).click();
  const editListDialog = page.getByRole("dialog", { name: "Rediger liste" });
  await editListDialog.getByLabel("Navn").fill("Byggemarked (ombygget)");
  await editListDialog.getByRole("button", { name: "Gem" }).click();
  await expect(page.getByRole("tab", { name: "Byggemarked (ombygget)" })).toBeVisible();

  // Slet den nye liste igen — den oprindelige "Dagligvarer"-liste er tilbage.
  await page.getByRole("button", { name: "Flere handlinger" }).click();
  await page.getByRole("menuitem", { name: "Rediger liste" }).click();
  await page.getByRole("button", { name: "Slet liste" }).click();
  await page.getByRole("button", { name: "Bekræft sletning" }).click();
  await expect(page.getByRole("tab", { name: "Byggemarked (ombygget)" })).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "Dagligvarer" })).toBeVisible();
});

test("a family member can add, edit, and delete a task through the real UI", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  let tasks: Array<Record<string, unknown>> = [];

  await page.route("**/api/families/*/tasks", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks }) });
      return;
    }

    if (method === "POST") {
      const posted = route.request().postDataJSON() as {
        name: string;
        icon: string;
        assignedMemberId?: string | null;
        timeOfDay?: string | null;
      };
      tasks = [
        ...tasks,
        {
          id: `task-${tasks.length + 1}`,
          familyId: family.id,
          name: posted.name,
          icon: posted.icon,
          assignedMemberId: posted.assignedMemberId ?? null,
          timeOfDay: posted.timeOfDay ?? null,
          isDone: 0,
          routineItemId: null,
          taskDate: "2026-08-28",
          createdByUserId: "user-e2e",
          createdAt: new Date().toISOString(),
          doneAt: null,
        },
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks }) });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/families/*/tasks/*", async (route) => {
    const url = new URL(route.request().url());
    const taskId = url.pathname.split("/")[5];
    const method = route.request().method();

    if (method === "PATCH") {
      const patched = route.request().postDataJSON() as { name?: string };
      tasks = tasks.map((task) => (task.id === taskId ? { ...task, ...patched } : task));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks }) });
      return;
    }

    if (method === "DELETE") {
      tasks = tasks.filter((task) => task.id !== taskId);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks }) });
      return;
    }

    await route.fallback();
  });

  await page.goto("/tasks");

  // Opret en opgave.
  await page.getByLabel("Opgave", { exact: true }).fill("Vande blomster");
  await page.getByRole("button", { name: "Tilføj" }).click();
  await expect(page.getByText("Vande blomster", { exact: true })).toBeVisible();

  // Redigér opgavens navn (klik på teksten åbner et autofokuseret
  // redigeringsfelt).
  await page.getByText("Vande blomster", { exact: true }).click();
  const taskNameField = page.locator("input:focus");
  await taskNameField.fill("Vande alle blomster");
  // Klik væk i stedet for Enter — samme begrundelse som indkøbslistetesten
  // ovenfor.
  await page.getByRole("heading", { name: "Opgaver" }).click();
  await expect(page.getByText("Vande alle blomster", { exact: true })).toBeVisible();
  await expect(page.getByText("Vande blomster", { exact: true })).not.toBeVisible();

  // Slet opgaven.
  await page.getByRole("button", { name: "Fjern Vande alle blomster" }).click();
  await expect(page.getByText("Vande alle blomster", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Ingen opgaver endnu i dag.")).toBeVisible();
});

test("a family member can create and delete a routine through the real UI", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  let routines: Array<Record<string, unknown>> = [];
  const tasks: Array<Record<string, unknown>> = [];

  await page.route("**/api/families/*/tasks", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks }) });
  });

  await page.route("**/api/families/*/task-routines", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ routines }) });
      return;
    }

    if (method === "POST") {
      const posted = route.request().postDataJSON() as {
        name: string;
        weekdays: number[];
        assignedMemberId?: string | null;
        items: Array<{ name: string; icon: string; timeOfDay: string | null }>;
      };
      const newRoutine = {
        id: `routine-${routines.length + 1}`,
        familyId: family.id,
        name: posted.name,
        assignedMemberId: posted.assignedMemberId ?? null,
        weekdays: posted.weekdays,
        createdAt: new Date().toISOString(),
        items: posted.items.map((item, index) => ({
          id: `routine-item-${index + 1}`,
          routineId: `routine-${routines.length + 1}`,
          name: item.name,
          icon: item.icon,
          timeOfDay: item.timeOfDay,
          sortOrder: index,
        })),
      };
      routines = [...routines, newRoutine];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ routine: newRoutine }) });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/families/*/task-routines/*", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const routineId = url.pathname.split("/")[5];
    routines = routines.filter((routine) => routine.id !== routineId);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/tasks");

  await page.getByRole("button", { name: "Opret rutine" }).click();
  const routineDialog = page.getByRole("dialog", { name: "Opret rutine" });
  await routineDialog.getByLabel("Rutinens navn").fill("Morgenrutine");
  await routineDialog.getByRole("button", { name: "Man" }).click();
  await routineDialog.getByRole("button", { name: "Ons" }).click();
  await routineDialog.getByLabel("Opgave 1", { exact: true }).fill("Børst tænder");
  await routineDialog.getByRole("button", { name: "Opret", exact: true }).click();
  // Dialogens egen "Man"/"Ons"-vejrdagsvælger overlapper tekstmæssigt med den
  // netop oprettede rutines egne dag-mærkater — vent til dialogen er helt
  // væk (inkl. lukke-animationen), før de tjekkes, ellers kan begge matches
  // findes samtidig i en kort overgangsperiode.
  await expect(routineDialog).not.toBeVisible();

  const routineRow = page.getByText("Morgenrutine", { exact: true }).locator("..");
  await expect(page.getByText("Morgenrutine", { exact: true })).toBeVisible();
  await expect(routineRow.getByText("Man", { exact: true })).toBeVisible();
  await expect(routineRow.getByText("Ons", { exact: true })).toBeVisible();

  // Slet rutinen.
  await page.getByRole("button", { name: "Slet Morgenrutine" }).click();
  await expect(page.getByText("Morgenrutine", { exact: true })).not.toBeVisible();
  await expect(page.getByText("Ingen rutiner endnu.")).toBeVisible();
});

// Fase 5: logout og fuldstændig lokal oprydning. useSession().logout() (se
// features/auth/hooks/useSession.ts) kalder POST /auth/logout, rydder al
// localStorage prefixet "boholts-family-" (clearAllFamilyStorage(), bruges
// også af backup-eksport/-import), rydder det gemte medlems-id, og forsøger
// til sidst at afmelde en eventuel push-abonnement via
// navigator.serviceWorker.ready — som ALDRIG bliver "ready" i denne e2e-
// opsætnings dev-server (ingen service worker registreres uden for et rigtigt
// build, se vite.config.ts's manglende devOptions), og derfor ville blokere
// logout() for evigt uden dette init-script.
test("logging out through the real UI clears the session and every locally cached family key", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve(null) },
        }),
      },
    });
  });

  await mockAuthenticatedApi(page);

  let logoutCallCount = 0;
  let isLoggedOut = false;

  await page.route("**/auth/logout", async (route) => {
    logoutCallCount += 1;
    isLoggedOut = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // Overstyrer mockAuthenticatedApi's blanket "/api/**"-handler (sidst
  // registreret vinder) — den svarer altid med den loggede-ind bruger,
  // uanset logout, hvilket ellers ville skjule en genindlæsning, der ikke
  // reelt genopfrisker sessionsstatus.
  await page.route("**/api/me", async (route) => {
    if (isLoggedOut) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/settings");

  await page.evaluate(() => {
    window.localStorage.setItem("boholts-family-members", "[]");
    window.localStorage.setItem("boholts-family-current-member-id", "member-e2e");
  });

  await expect(page.getByText("familie@example.com")).toBeVisible();

  await page.getByRole("button", { name: "Log ud" }).click();

  // logout() slutter med window.location.reload() — nødvendigt, fordi
  // useSession() gemmer sin tilstand lokalt pr. komponent uden delt context,
  // se kommentaren i useSession.ts. Uden genindlæsningen ville AppLayout's
  // egen, uafhængige useSession()-instans aldrig opdage logout'et.
  await page.waitForURL("/settings");
  // LoginPage's "Log ind med Google" er et <Button href="…">, som MUI/browseren
  // gengiver med role "link", ikke "button".
  await expect(page.getByRole("link", { name: "Log ind med Google" })).toBeVisible();
  await expect.poll(() => logoutCallCount).toBe(1);

  const remainingKeys = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith("boholts-family-")),
  );
  expect(remainingKeys).toEqual([]);
});

// Fase 5: generiske API-fejl uden for de allerede dækkede offline-scenarier
// (se de tre "offline ... is queued locally"-tests ovenfor, som dækker
// manglende netværk). Her simuleres i stedet en rigtig 500-fejl fra serveren,
// mens appen ER online — useShoppingList.ts's addItem() fanger fejlen og
// sætter en synlig fejlmeddelelse, i stedet for at fejle stille eller crashe
// siden.
test("a genuine server error while online shows a visible error message instead of failing silently", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockAuthenticatedApi(page);

  const lists = [
    {
      id: "list-groceries",
      familyId: family.id,
      name: "Dagligvarer",
      type: "dagligvarer",
      createdAt: "2026-08-20T00:00:00.000Z",
    },
  ];

  await page.route("**/api/families/*/shopping-lists", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ lists }) });
  });

  await page.route("**/api/families/*/shopping-lists/*/items", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      return;
    }

    if (method === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/shopping-list");

  const addItemInput = page.getByPlaceholder("Tilføj en vare…");
  await addItemInput.fill("Mælk");
  await page.getByRole("button", { name: "Tilføj" }).click();

  await expect(page.getByText("Handlingen kunne ikke gennemføres. Prøv igen.")).toBeVisible();
  // Fejlen efterlader ikke varen tilføjet, og siden er stadig fuldt brugbar.
  await expect(page.getByText("Mælk", { exact: true })).not.toBeVisible();
  await expect(addItemInput).toBeEditable();
});
