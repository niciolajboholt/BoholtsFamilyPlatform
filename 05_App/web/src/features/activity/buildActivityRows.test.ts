import { describe, expect, it } from "vitest";

import { buildActivityRows } from "./buildActivityRows";
import type { ActiveActivitySummary } from "../family/familyApi";

function emptySummary(overrides: Partial<ActiveActivitySummary> = {}): ActiveActivitySummary {
  return {
    hasActivity: true,
    since: "2026-08-27T10:00:00.000Z",
    asOf: "2026-08-31T18:00:00.000Z",
    calendar: { moved: [], cancelled: [], created: [] },
    tasksCompletedCount: 0,
    tasksCreatedCount: 0,
    shoppingAddedCount: 0,
    shoppingCheckedCount: 0,
    newFamilyMembers: [],
    totalCount: 0,
    ...overrides,
  };
}

describe("buildActivityRows", () => {
  it("returns an empty list when nothing happened", () => {
    expect(buildActivityRows(emptySummary())).toEqual([]);
  });

  it("puts moved and cancelled calendar rows first, marked as needing attention", () => {
    const summary = emptySummary({
      calendar: {
        moved: [{ title: "Svømning", oldStart: "2026-08-28T14:00:00.000Z", newStart: "2026-08-29T16:00:00.000Z" }],
        cancelled: [{ title: "Lægebesøg", oldStart: "2026-08-31T10:00:00.000Z" }],
        created: [{ title: "Fødselsdag", start: "2026-09-05T10:00:00.000Z" }],
      },
      tasksCompletedCount: 1,
    });

    const rows = buildActivityRows(summary);

    expect(rows[0]).toMatchObject({ attention: true, title: "Svømning er flyttet" });
    expect(rows[1]).toMatchObject({ attention: true, title: "Lægebesøg er aflyst" });
    expect(rows.slice(2).every((row) => row.attention === false)).toBe(true);
  });

  it("aggregates new calendar events into one row naming the next one", () => {
    const summary = emptySummary({
      calendar: {
        moved: [],
        cancelled: [],
        created: [
          { title: "Fødselsdag hos Mormor", start: "2026-09-06T10:00:00.000Z" },
          { title: "Forældremøde", start: "2026-09-10T18:00:00.000Z" },
        ],
      },
    });

    const rows = buildActivityRows(summary);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("2 nye aftaler i kalenderen");
    expect(rows[0]?.detail).toContain("Fødselsdag hos Mormor");
  });

  it("combines completed and created task counts into one row, omitting a zero side", () => {
    expect(buildActivityRows(emptySummary({ tasksCompletedCount: 3 }))).toEqual([
      { id: "tasks", attention: false, icon: "check", title: "3 opgaver fuldført" },
    ]);

    expect(buildActivityRows(emptySummary({ tasksCreatedCount: 1 }))).toEqual([
      { id: "tasks", attention: false, icon: "check", title: "1 ny opgave oprettet" },
    ]);

    expect(buildActivityRows(emptySummary({ tasksCompletedCount: 2, tasksCreatedCount: 2 }))).toEqual([
      { id: "tasks", attention: false, icon: "check", title: "2 opgaver fuldført, 2 nye opgaver oprettet" },
    ]);
  });

  it("combines shopping list counts into one row", () => {
    expect(buildActivityRows(emptySummary({ shoppingAddedCount: 9, shoppingCheckedCount: 5 }))).toEqual([
      { id: "shopping", attention: false, icon: "cart", title: "9 varer tilføjet, 5 streget af" },
    ]);
  });

  it("names a single new family member directly, and lists several by name", () => {
    expect(buildActivityRows(emptySummary({ newFamilyMembers: [{ name: "Emma" }] }))).toEqual([
      { id: "family", attention: false, icon: "family", title: "Emma er tilføjet som familiemedlem" },
    ]);

    expect(
      buildActivityRows(emptySummary({ newFamilyMembers: [{ name: "Emma" }, { name: "Frederik" }] })),
    ).toEqual([
      {
        id: "family",
        attention: false,
        icon: "family",
        title: "Emma, Frederik er tilføjet som familiemedlemmer",
      },
    ]);
  });
});
