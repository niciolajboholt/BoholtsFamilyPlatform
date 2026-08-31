import { describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { generateWeeklySummary } from "./aiAssistant";

function mockJsonResponse(sections: { name: string; text: string }[]) {
  return { choices: [{ message: { content: JSON.stringify({ sections }) } }] };
}

describe("generateWeeklySummary", () => {
  it("returns the model's structured sections, trimmed", async () => {
    const env = createFakeEnv();
    env.AI.run = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse([{ name: "Fælles", text: "  Det bliver en travl uge med fødselsdag og indkøb.  " }]),
      ) as never;

    const summary = await generateWeeklySummary(env, {
      events: [{ title: "Fødselsdag", start: "2026-08-24T10:00:00.000Z", allDay: false }],
      openTasks: [{ name: "Køb gave" }],
      shoppingItems: ["Mælk"],
    });

    expect(summary).toEqual([{ name: "Fælles", text: "Det bliver en travl uge med fødselsdag og indkøb." }]);
  });

  it("returns null when the model call fails", async () => {
    const env = createFakeEnv();
    env.AI.run = vi.fn().mockRejectedValue(new Error("Workers AI utilgængelig")) as never;

    const summary = await generateWeeklySummary(env, {
      events: [],
      openTasks: [],
      shoppingItems: [],
    });

    expect(summary).toBeNull();
  });

  it("returns null when the model responds with empty content", async () => {
    const env = createFakeEnv();
    env.AI.run = vi.fn().mockResolvedValue({ choices: [{ message: { content: "   " } }] }) as never;

    const summary = await generateWeeklySummary(env, {
      events: [],
      openTasks: [],
      shoppingItems: [],
    });

    expect(summary).toBeNull();
  });

  it("returns null when the model doesn't respond with valid sections JSON", async () => {
    const env = createFakeEnv();
    env.AI.run = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Det bliver en hyggelig uge!" } }],
    }) as never;

    const summary = await generateWeeklySummary(env, {
      events: [],
      openTasks: [],
      shoppingItems: [],
    });

    expect(summary).toBeNull();
  });

  it("includes all three data sources in the prompt sent to the model", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: "Fælles", text: "Resumé." }]));
    env.AI.run = runMock as never;

    await generateWeeklySummary(env, {
      events: [{ title: "Lægebesøg", start: "2026-08-25T09:00:00.000Z", allDay: false }],
      openTasks: [{ name: "Vask tøj" }],
      shoppingItems: ["Æg"],
    });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;

    expect(userPrompt).toContain("Lægebesøg");
    expect(userPrompt).toContain("Vask tøj");
    expect(userPrompt).toContain("Æg");
  });

  it("formats each event with its Danish weekday, time, and member name — not a raw ISO timestamp", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: "Nicolaj", text: "Resumé." }]));
    env.AI.run = runMock as never;

    await generateWeeklySummary(env, {
      events: [
        { title: "Padelkamp", start: "2026-09-01T17:00:00.000Z", allDay: false, memberName: "Nicolaj" },
        { title: "Skolestart", start: "2026-08-31T00:00:00.000Z", allDay: true },
      ],
      openTasks: [],
      shoppingItems: [],
    });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;

    // 17:00 UTC = 19:00 dansk sommertid; "kl. 19.00" beviser konverteringen
    // sker deterministisk i koden, ikke overladt til modellen selv at regne.
    expect(userPrompt).toContain("tirsdag kl. 19.00: Padelkamp (Nicolaj)");
    expect(userPrompt).toContain("mandag: Skolestart");
    expect(userPrompt).not.toContain("2026-09-01T17:00:00.000Z");
  });

  it("marks a fully empty week as (ingen) instead of inventing content", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: "Fælles", text: "Resumé." }]));
    env.AI.run = runMock as never;

    await generateWeeklySummary(env, { events: [], openTasks: [], shoppingItems: [] });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;

    expect(userPrompt).toContain("(ingen)");
  });

  it("presents events, tasks, and shopping items to the model grouped per family member, with a shared 'Fælles' bucket for the rest", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue(mockJsonResponse([{ name: "Fælles", text: "Resumé." }]));
    env.AI.run = runMock as never;

    await generateWeeklySummary(env, {
      events: [
        { title: "Padelkamp", start: "2026-09-01T17:00:00.000Z", allDay: false, memberName: "Nicolaj" },
        { title: "Skolestart", start: "2026-08-31T00:00:00.000Z", allDay: true },
      ],
      openTasks: [
        { name: "Bestil frisør", memberName: "Christine" },
        { name: "Ryd op i garagen" },
      ],
      shoppingItems: ["Mælk"],
    });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;
    const nicolajIndex = userPrompt.indexOf("Nicolaj:");
    const christineIndex = userPrompt.indexOf("Christine:");
    const faellesIndex = userPrompt.indexOf("Fælles:");

    // Rækkefølgen skal matche den, personerne først optræder i (Nicolaj før
    // Christine, begge før den fælles bunke) — ikke en tilfældig orden.
    expect(nicolajIndex).toBeGreaterThan(-1);
    expect(christineIndex).toBeGreaterThan(nicolajIndex);
    expect(faellesIndex).toBeGreaterThan(christineIndex);

    expect(userPrompt).toContain("tirsdag kl. 19.00: Padelkamp (Nicolaj)");
    expect(userPrompt).toContain("Opgave: Bestil frisør");
    expect(userPrompt).toContain("mandag: Skolestart");
    expect(userPrompt).toContain("Opgave: Ryd op i garagen");
    expect(userPrompt).toContain("Indkøb: Mælk");
  });

  // Regression (Nicolaj, 2026-08-30): en tidligere fri-tekst-version bad
  // modellen selv lave linjeskift og fed skrift-agtige "Navn: "-præfikser,
  // hvilket den ofte ignorerede og skrev som ét sammenhængende afsnit.
  // Struktureret JSON gør navn og linjeskift til noget UI'et selv styrer
  // (WeeklySummaryCard.tsx), uafhængigt af om modellen følger formatet.
  describe("structured per-person sections", () => {
    it("orders sections to match the given group order, regardless of the order the model returned them in", async () => {
      const env = createFakeEnv();
      env.AI.run = vi.fn().mockResolvedValue(
        mockJsonResponse([
          { name: "Christine", text: "Skal have styr på frisøren." },
          { name: "Nicolaj", text: "Padel tirsdag." },
        ]),
      ) as never;

      const summary = await generateWeeklySummary(env, {
        events: [{ title: "Padelkamp", start: "2026-09-01T17:00:00.000Z", allDay: false, memberName: "Nicolaj" }],
        openTasks: [{ name: "Bestil frisør", memberName: "Christine" }],
        shoppingItems: [],
      });

      // Nicolaj optræder først i input (via aftalen), så han skal stå
      // først i resultatet — uanset at modellen returnerede Christine
      // først i sit JSON-array.
      expect(summary).toEqual([
        { name: "Nicolaj", text: "Padel tirsdag." },
        { name: "Christine", text: "Skal have styr på frisøren." },
      ]);
    });

    it("merges an unrecognized section name into 'Fælles' instead of showing it as a stray extra heading", async () => {
      const env = createFakeEnv();
      env.AI.run = vi.fn().mockResolvedValue(
        mockJsonResponse([
          { name: "Nicolaj", text: "Padel tirsdag." },
          // "Familien" er ikke et kendt medlemsnavn og ikke selve
          // "Fælles"-nøglen — modellen har selv fundet på en ekstra
          // gruppe, som tidligere gav en uventet, ubold overskrift.
          { name: "Familien", text: "VMGS i weekenden." },
        ]),
      ) as never;

      const summary = await generateWeeklySummary(env, {
        events: [
          { title: "Padelkamp", start: "2026-09-01T17:00:00.000Z", allDay: false, memberName: "Nicolaj" },
          { title: "VMGS", start: "2026-09-05T00:00:00.000Z", allDay: true },
        ],
        openTasks: [],
        shoppingItems: [],
      });

      expect(summary).toEqual([
        { name: "Nicolaj", text: "Padel tirsdag." },
        { name: "Fælles", text: "VMGS i weekenden." },
      ]);
    });

    it("omits a person entirely when the model didn't mention them", async () => {
      const env = createFakeEnv();
      env.AI.run = vi.fn().mockResolvedValue(mockJsonResponse([{ name: "Nicolaj", text: "Padel tirsdag." }])) as never;

      const summary = await generateWeeklySummary(env, {
        events: [{ title: "Padelkamp", start: "2026-09-01T17:00:00.000Z", allDay: false, memberName: "Nicolaj" }],
        openTasks: [{ name: "Bestil frisør", memberName: "Christine" }],
        shoppingItems: [],
      });

      expect(summary).toEqual([{ name: "Nicolaj", text: "Padel tirsdag." }]);
    });
  });
});
