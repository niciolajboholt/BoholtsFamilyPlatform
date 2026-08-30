import { describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { generateWeeklySummary } from "./aiAssistant";

describe("generateWeeklySummary", () => {
  it("returns the model's free-text response, trimmed", async () => {
    const env = createFakeEnv();
    env.AI.run = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: "  Det bliver en travl uge med fødselsdag og indkøb.  ",
          },
        },
      ],
    }) as never;

    const summary = await generateWeeklySummary(env, {
      events: [{ title: "Fødselsdag", start: "2026-08-24T10:00:00.000Z", allDay: false }],
      openTasks: [{ name: "Køb gave" }],
      shoppingItems: ["Mælk"],
    });

    expect(summary).toBe("Det bliver en travl uge med fødselsdag og indkøb.");
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

  it("includes all three data sources in the prompt sent to the model", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Resumé." } }],
    });
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
    const runMock = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Resumé." } }],
    });
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

    // 17:00 UTC = 19:00 dansk sommertid; "kl. 19:00" beviser konverteringen
    // sker deterministisk i koden, ikke overladt til modellen selv at regne.
    expect(userPrompt).toContain("tirsdag kl. 19.00: Padelkamp (Nicolaj)");
    expect(userPrompt).toContain("mandag: Skolestart");
    expect(userPrompt).not.toContain("2026-09-01T17:00:00.000Z");
  });

  it("marks a fully empty week as (ingen) instead of inventing content", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Resumé." } }],
    });
    env.AI.run = runMock as never;

    await generateWeeklySummary(env, { events: [], openTasks: [], shoppingItems: [] });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;

    expect(userPrompt).toContain("(ingen)");
  });

  it("groups events, tasks, and shopping items per family member, with a shared 'Fælles' bucket for the rest", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Resumé." } }],
    });
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
    const faellesIndex = userPrompt.indexOf("Fælles (ingen bestemt person):");

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
});
