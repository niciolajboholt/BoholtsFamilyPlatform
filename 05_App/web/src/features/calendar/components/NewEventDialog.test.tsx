// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../../../test/renderWithProviders";
import { calendarOwners } from "../data/calendarOwners";
import type { CalendarSource } from "../models/calendarProvider";
import NewEventDialog from "./NewEventDialog";

// Sprint 31: fandt to konkrete bugs i sæsonen, denne testfil dækker begge —
// (1) skift mellem heldags/tidsbestemt aftale, (2) at påmindelse-dropdown'et
// kun tilbydes for Google-kalendere, ikke for Outlook, selvom begge er
// "eksterne" kilder.

const googleSource: CalendarSource = {
  id: "google:cal-1",
  name: "Google-kalenderen",
  providerType: "google",
  color: "#4285F4",
  isVisible: true,
  isReadOnly: false,
};

const outlookSource: CalendarSource = {
  id: "outlook:cal-1",
  name: "Outlook-kalenderen",
  providerType: "outlook",
  color: "#0072C6",
  isVisible: true,
  isReadOnly: false,
};

const members = Object.values(calendarOwners);

function renderDialog(onCreate = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();

  renderWithProviders(
    <NewEventDialog
      open
      initialDate={new Date(2026, 7, 26, 12, 0)}
      events={[]}
      calendarSources={[googleSource, outlookSource]}
      members={members}
      isSaving={false}
      onClose={onClose}
      onCreate={onCreate}
    />,
  );

  return { onClose, onCreate };
}

describe("NewEventDialog", () => {
  it("skjuler start-/sluttidspunkt, når 'Hele dagen' slås til", async () => {
    const user = userEvent.setup();
    renderDialog();

    // MUI X's TimeField eksponerer sig som en "group" (de faktiske,
    // redigerbare sektioner er spinbuttons inde i den) — det bagvedliggende
    // <input> er kun en skjult værdi-bærer og matcher label-teksten en gang
    // til, så getByRole er det entydige valg her, ikke getByLabelText.
    expect(screen.getByRole("group", { name: /Starttid/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Sluttid/ })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Hele dagen" }));

    expect(screen.queryByRole("group", { name: /Starttid/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Sluttid/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Hele dagen" }));

    expect(screen.getByRole("group", { name: /Starttid/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Sluttid/ })).toBeInTheDocument();
  });

  it("tilbyder kun en påmindelse for en Google-kalender, ikke for Outlook", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Flere muligheder/ }));

    // Standardvalgt kilde er den første skrivbare kalender (Google) — se
    // NewEventDialog's fallback for requestedSourceId.
    expect(await screen.findByLabelText("Påmindelse")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Hvem gælder aftalen for?" }));
    await user.click(await screen.findByRole("option", { name: /Outlook/ }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Påmindelse")).not.toBeInTheDocument();
    });
  });

  it("opretter aftalen med den valgte påmindelse", async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = renderDialog();

    await user.type(screen.getByLabelText("Titel", { exact: false }), "Fødselsdagsfest");

    await user.click(screen.getByRole("button", { name: /Flere muligheder/ }));
    await user.click(await screen.findByRole("combobox", { name: "Påmindelse" }));
    await user.click(await screen.findByRole("option", { name: "30 minutter før" }));

    await user.click(screen.getByRole("button", { name: "Opret aftale" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    const [input, reminderOffsetMinutes] = onCreate.mock.calls[0]!;
    expect(input).toMatchObject({
      title: "Fødselsdagsfest",
      allDay: false,
      ownerIds: [],
      sourceId: "google:cal-1",
    });
    expect(reminderOffsetMinutes).toBe(30);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
