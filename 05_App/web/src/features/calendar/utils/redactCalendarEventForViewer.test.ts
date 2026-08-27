import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import { redactCalendarEventForViewer } from "./redactCalendarEventForViewer";

const privateEvent: CalendarEvent = {
  id: "google-event:calendar:event",
  title: "Fortrolig behandling",
  description: "Følsomme noter",
  location: "Klinik 4",
  start: "2026-08-27T08:00:00.000Z",
  end: "2026-08-27T09:00:00.000Z",
  allDay: false,
  ownerIds: ["nicolaj"],
  source: "google",
  sourceId: "google:calendar",
  privacy: "busy",
};

describe("redactCalendarEventForViewer", () => {
  it("bevarer private detaljer for det kortlagte familiemedlem", () => {
    expect(redactCalendarEventForViewer(privateEvent, "nicolaj")).toBe(privateEvent);
  });

  it("viser kun Optaget for et andet familiemedlem", () => {
    expect(redactCalendarEventForViewer(privateEvent, "christine")).toEqual({
      ...privateEvent,
      title: "Optaget",
      description: undefined,
      location: undefined,
      privacyRedacted: true,
    });
  });

  it("redigerer konservativt, når brugeren ikke er koblet til en profil", () => {
    expect(redactCalendarEventForViewer(privateEvent, undefined).title).toBe("Optaget");
  });

  it("ændrer aldrig almindelige aftaler", () => {
    const publicEvent = { ...privateEvent, privacy: undefined };
    expect(redactCalendarEventForViewer(publicEvent, "christine")).toBe(publicEvent);
  });
});
