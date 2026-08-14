// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "boholts-family-calendar-member-mapping";
const mockFamilyId = "family-1";

// Fase 4: skrivning går nu server-først (familyApi) — mockes her, så
// læse-testene forbliver rene enhedstests af den lokale cache, og
// skrive-testene kan bekræfte at cachen opdateres fra et (mock) server-svar,
// uden et rigtigt netværkskald.
vi.mock("../../family/familyApi", () => ({
  getMyFamily: vi.fn(async () => ({
    ok: true,
    status: 200,
    data: {
      family: { id: mockFamilyId, name: "Test", ownerUserId: "u1", createdAt: "" },
    },
  })),
  getCalendarMappings: vi.fn(async () => ({
    ok: true,
    status: 200,
    data: { mappings: [] },
  })),
  setCalendarMapping: vi.fn(
    async (_familyId: string, calendarId: string, familyMemberId: string) => ({
      ok: true,
      status: 200,
      data: { mappings: [{ googleCalendarId: calendarId, familyMemberId }] },
    }),
  ),
  deleteCalendarMapping: vi.fn(async () => ({
    ok: true,
    status: 200,
    data: { mappings: [] },
  })),
  clearAllCalendarMappings: vi.fn(async () => ({
    ok: true,
    status: 200,
    data: { mappings: [] },
  })),
}));

import { familyPseudoMemberId } from "../models/calendarEvent";
import {
  getCalendarMemberMappings,
  getOwnerIdForGoogleCalendar,
  setCalendarMemberMapping,
} from "./calendarMemberMappingStorage";
import { setFamilyPseudoMemberServerId } from "./familyMembersStorage";
import { setCalendarMapping as setCalendarMappingMock } from "../../family/familyApi";

function seedMappings(entries: { googleCalendarId: string; ownerId: string }[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

describe("calendarMemberMappingStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("reads (synkron lokal cache)", () => {
    it("returns nothing for an unmapped calendar", () => {
      expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBeUndefined();
      expect(getCalendarMemberMappings()).toEqual({});
    });

    it("reads a seeded mapping", () => {
      seedMappings([
        { googleCalendarId: "nicolajbach12@gmail.com", ownerId: "nicolaj" },
      ]);

      expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBe("nicolaj");
      expect(getCalendarMemberMappings()).toEqual({
        "nicolajbach12@gmail.com": "nicolaj",
      });
    });

    it("falls back to empty when storage holds invalid JSON", () => {
      window.localStorage.setItem(STORAGE_KEY, "not valid json {{{");

      expect(getCalendarMemberMappings()).toEqual({});
    });
  });

  describe("setCalendarMemberMapping (server-først, cache fra svaret)", () => {
    it("writes the server's confirmed mapping into the local cache", async () => {
      await setCalendarMemberMapping("nicolajbach12@gmail.com", "nicolaj");

      expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBe("nicolaj");
    });

    it("clears the cached entry once the server confirms a delete", async () => {
      seedMappings([
        { googleCalendarId: "nicolajbach12@gmail.com", ownerId: "nicolaj" },
      ]);

      await setCalendarMemberMapping("nicolajbach12@gmail.com", null);

      expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBeUndefined();
    });

    // Regression: familyMembersSync.ts erstatter pseudomedlemmets rigtige
    // server-id ("family-server-uuid" her) med det faste, lokale
    // familyPseudoMemberId ("family") overalt i klienten. Uden oversættelse
    // ville dette kald sende det bogstavelige "family" som familyMemberId —
    // serverens familie-scoping-tjek (families.ts) ville afvise det, da intet
    // rigtigt medlem har det id, og fejlen ville forsvinde stille, fordi
    // FamilyMemberDialog's gem-kald hverken afventer eller viser fejl.
    it("translates the pseudo-member id to its real server id before writing", async () => {
      setFamilyPseudoMemberServerId("family-server-uuid");

      await setCalendarMemberMapping("family@example.com", familyPseudoMemberId);

      expect(setCalendarMappingMock).toHaveBeenCalledWith(
        mockFamilyId,
        "family@example.com",
        "family-server-uuid",
      );
      // Og læses tilbage som det lokale "family"-id, ikke den rå server-UUID.
      expect(getOwnerIdForGoogleCalendar("family@example.com")).toBe(
        familyPseudoMemberId,
      );
    });
  });
});
