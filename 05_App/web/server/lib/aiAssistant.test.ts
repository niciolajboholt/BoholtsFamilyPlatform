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
      events: [{ title: "Fødselsdag", start: "2026-08-24 10:00" }],
      openTasks: ["Køb gave"],
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
      events: [{ title: "Lægebesøg", start: "2026-08-25 09:00" }],
      openTasks: ["Vask tøj"],
      shoppingItems: ["Æg"],
    });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;

    expect(userPrompt).toContain("Lægebesøg");
    expect(userPrompt).toContain("Vask tøj");
    expect(userPrompt).toContain("Æg");
  });

  it("marks empty data sources instead of inventing content", async () => {
    const env = createFakeEnv();
    const runMock = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Resumé." } }],
    });
    env.AI.run = runMock as never;

    await generateWeeklySummary(env, { events: [], openTasks: [], shoppingItems: [] });

    const userPrompt = runMock.mock.calls[0][1].messages[1].content as string;

    expect(userPrompt.match(/\(ingen\)/g)).toHaveLength(3);
  });
});
