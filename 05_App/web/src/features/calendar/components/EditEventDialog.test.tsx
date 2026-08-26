// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../../../test/renderWithProviders";
import { calendarOwners } from "../data/calendarOwners";
import {
  deleteEventReminder,
  getEventReminder,
  setEventReminder,
} from "../eventReminders/eventReminderApi";
import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import EditEventDialog from "./EditEventDialog";

// canSetReminder (EditEventDialog.tsx) kræver event.source === "google", som
// igen trækker familie-id'et gennem useFamilyId() (-> getMyFamily) og selve
// påmindelsen gennem eventReminderApi — begge rammer normalt netværket, og
// skal derfor mockes for at kunne teste dialogen isoleret.
vi.mock("../../family/familyApi", () => ({
  getMyFamily: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      family: { id: "family-1", name: "Boholt", ownerUserId: "u1", createdAt: "" },
      role: "owner",
      members: [],
    },
  }),
}));

vi.mock("../eventReminders/eventReminderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../eventReminders/eventReminderApi")>();
  return {
    ...actual,
    getEventReminder: vi.fn(),
    setEventReminder: vi.fn(),
    deleteEventReminder: vi.fn(),
  };
});

const googleSource: CalendarSource = {
  id: "google:cal-1",
  name: "Google-kalenderen",
  providerType: "google",
  color: "#4285F4",
  isVisible: true,
  isReadOnly: false,
};

const googleEvent: CalendarEvent = {
  id: "google-event:google:cal-1:evt-1",
  title: "Tandlæge",
  start: "2026-08-26T09:00:00.000+02:00",
  end: "2026-08-26T10:00:00.000+02:00",
  allDay: false,
  ownerIds: [],
  source: "google",
  sourceId: "google:cal-1",
};

const members = Object.values(calendarOwners);

function renderDialog(event: CalendarEvent = googleEvent) {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  renderWithProviders(
    <EditEventDialog
      open
      event={event}
      events={[event]}
      calendarSources={[googleSource]}
      members={members}
      isSaving={false}
      onClose={onClose}
      onUpdate={onUpdate}
      onDelete={vi.fn()}
      onUpdateOccurrence={vi.fn()}
      onDeleteOccurrence={vi.fn()}
    />,
  );

  return { onUpdate, onClose };
}

describe("EditEventDialog", () => {
  it("indlæser den eksisterende påmindelse og kan slå den fra igen", async () => {
    vi.mocked(getEventReminder).mockResolvedValue({
      ok: true,
      status: 200,
      data: { reminder: { offsetMinutes: 60 } },
    });

    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Flere muligheder/ }));

    const reminderSelect = await screen.findByRole("combobox", { name: "Påmindelse" });
    await waitFor(() => expect(reminderSelect).toHaveTextContent("1 time før"));

    await user.click(reminderSelect);
    await user.click(await screen.findByRole("option", { name: "Ingen" }));

    expect(deleteEventReminder).toHaveBeenCalledWith("family-1", googleEvent.id);
    expect(setEventReminder).not.toHaveBeenCalled();
  });

  it("skjuler start-/sluttidspunkt, når 'Hele dagen' slås til", async () => {
    vi.mocked(getEventReminder).mockResolvedValue({
      ok: true,
      status: 200,
      data: { reminder: null },
    });

    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole("group", { name: /Starttid/ })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Heldagsaftale" }));

    expect(screen.queryByRole("group", { name: /Starttid/ })).not.toBeInTheDocument();
  });
});
