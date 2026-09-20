// @vitest-environment jsdom
import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "../features/calendar/models/calendarEvent";
import type { TaskDto } from "../features/tasks/tasksApi";
import type { FamilyMemberDto } from "../features/family/familyApi";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const member: FamilyMemberDto = {
  id: "member-1",
  name: "Alfred",
  color: "#2E7D32",
  relation: "Barn",
  isPlaceholderName: 0,
  linkedUserId: null,
  linkedUserEmail: null,
  birthday: null,
};

// Matcher det faktiske "i dag" i testmiljøet, i LOKAL tid (samme
// (getFullYear/getMonth/getDate)-baserede grænser som MitIDagPage.tsx selv
// bruger til "todaysEvents", ikke UTC) — ellers filtrerer
// getEventsForDate aftalen væk, og testen ville ikke reelt afprøve den
// progressive indlæsning. now sat sent på eftermiddagen lokal tid, så
// aftalen (kl. 22:00 lokal) er en kommende, ikke allerede overstået, aftale.
const now = new Date();
const todayDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
  now.getDate(),
).padStart(2, "0")}`;

const task: TaskDto = {
  id: "task-1",
  familyId: "family-1",
  name: "Ryd op på værelset",
  icon: "star",
  assignedMemberId: "member-1",
  timeOfDay: null,
  isDone: 0,
  routineItemId: null,
  taskDate: todayDateKey,
  createdByUserId: "user-1",
  createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0).toISOString(),
  doneAt: null,
  rewardAmount: 0,
};

const event: CalendarEvent = {
  id: "event-1",
  title: "Fødselsdag",
  start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0).toISOString(),
  end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0).toISOString(),
  allDay: false,
  ownerIds: ["member-1"],
  source: "internal",
  sourceId: "google:family",
};

let calendarEventsMock: { events: CalendarEvent[]; isLoading: boolean; error: string | null };
let tasksMock: { members: FamilyMemberDto[]; tasks: TaskDto[]; isLoading: boolean; error: string | null };

vi.mock("../features/calendar/hooks/useCalendarEvents", () => ({
  useCalendarEvents: () => calendarEventsMock,
}));
vi.mock("../features/calendar/hooks/useCalendarSources", () => ({
  useCalendarSources: () => ({ visibleCalendarSourceIds: ["google:family"] }),
}));
vi.mock("../features/calendar/hooks/useCurrentMember", () => ({
  useCurrentMember: () => ({ currentMember: null }),
}));
vi.mock("../features/calendar/hooks/useRecurrenceExceptions", () => ({
  useRecurrenceExceptions: () => ({ exceptions: [] }),
}));
vi.mock("../features/tasks/hooks/useTasks", () => ({
  useTasks: () => ({ ...tasksMock, toggleDone: vi.fn(), pendingOfflineChangeCount: 0 }),
}));
vi.mock("../features/family/hooks/useEnabledFeatures", () => ({
  useEnabledFeatures: () => ({ isEnabled: () => true, isLoading: false }),
}));
vi.mock("../features/family/familySessionCache", () => ({
  getCachedFamily: () => new Promise(() => undefined),
}));
vi.mock("../features/family/familyApi", async () => {
  const actual = await vi.importActual<typeof import("../features/family/familyApi")>(
    "../features/family/familyApi",
  );
  return { ...actual, getChildMessagesForMember: () => new Promise(() => undefined) };
});

afterEach(() => {
  vi.clearAllMocks();
});

// Sprint 57: Mit i dag må ikke blokere hele siden bag én fælles
// indlæsningsspærre, når opgaver og kalenderaftaler indlæses uafhængigt af
// hinanden — se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md, afsnit F.
describe("MitIDagPage progressive loading", () => {
  it("shows already-loaded tasks while the calendar is still loading, with a local loading note instead of blocking the page", async () => {
    calendarEventsMock = { events: [], isLoading: true, error: null };
    tasksMock = { members: [member], tasks: [task], isLoading: false, error: null };

    const { default: MitIDagPage } = await import("./MitIDagPage");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<StrictMode><MitIDagPage /></StrictMode>);
    });

    // Opgaven er allerede synlig, selvom kalenderen stadig indlæses.
    expect(container.textContent).toContain("Ryd op på værelset");
    // En lokal indlæsningsnote for kalenderdelen — ikke en sideblokerende spinner.
    expect(container.textContent).toContain("Henter kalenderen");
    expect(container.textContent).not.toContain("Henter dagens aktiviteter");

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows calendar events when the task fetch failed (empty tasks, error set)", async () => {
    calendarEventsMock = { events: [event], isLoading: false, error: null };
    tasksMock = { members: [member], tasks: [], isLoading: false, error: "Kunne ikke hente opgaverne." };

    const { default: MitIDagPage } = await import("./MitIDagPage");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<StrictMode><MitIDagPage /></StrictMode>);
    });

    expect(container.textContent).toContain("Fødselsdag");
    expect(container.textContent).toContain("Kunne ikke hente opgaverne.");

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows tasks when the calendar failed (calendarError set, no events)", async () => {
    calendarEventsMock = { events: [], isLoading: false, error: "network" };
    tasksMock = { members: [member], tasks: [task], isLoading: false, error: null };

    const { default: MitIDagPage } = await import("./MitIDagPage");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<StrictMode><MitIDagPage /></StrictMode>);
    });

    expect(container.textContent).toContain("Ryd op på værelset");
    expect(container.textContent).toContain("Kalenderaftalerne kunne ikke hentes");

    await act(async () => root.unmount());
    container.remove();
  });
});
