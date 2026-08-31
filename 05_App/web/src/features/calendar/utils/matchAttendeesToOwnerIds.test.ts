import { describe, expect, it } from "vitest";

import { matchAttendeesToOwnerIds } from "./matchAttendeesToOwnerIds";
import type { CalendarOwner } from "../data/calendarOwners";

const members: CalendarOwner[] = [
  { id: "christine", name: "Christine", color: "#C62828", email: "christine@example.com" },
  { id: "jens", name: "Jens", color: "#00838F", email: "jens@example.com" },
  { id: "alfred", name: "Alfred", color: "#2E7D32" },
];

describe("matchAttendeesToOwnerIds", () => {
  it("matches a single attendee's email to their member id", () => {
    expect(matchAttendeesToOwnerIds([{ email: "jens@example.com" }], members)).toEqual(["jens"]);
  });

  it("matches multiple attendees to multiple member ids", () => {
    const ownerIds = matchAttendeesToOwnerIds(
      [{ email: "christine@example.com" }, { email: "jens@example.com" }],
      members,
    );
    expect(ownerIds).toEqual(["christine", "jens"]);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(matchAttendeesToOwnerIds([{ email: " Christine@Example.com " }], members)).toEqual(["christine"]);
  });

  it("ignores an attendee whose email belongs to nobody in the family", () => {
    expect(matchAttendeesToOwnerIds([{ email: "en-ven@example.com" }], members)).toEqual([]);
  });

  it("cannot match a member without a linked account email", () => {
    expect(matchAttendeesToOwnerIds([{ email: "alfred@example.com" }], members)).toEqual([]);
  });

  it("returns an empty array when there are no attendees", () => {
    expect(matchAttendeesToOwnerIds(undefined, members)).toEqual([]);
    expect(matchAttendeesToOwnerIds([], members)).toEqual([]);
  });

  it("returns an empty array when no attendee has an email at all", () => {
    expect(matchAttendeesToOwnerIds([{}], members)).toEqual([]);
  });
});
