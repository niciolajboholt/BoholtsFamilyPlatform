// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FamilyMemberDto } from "./familyApi";

const getMyFamilyMock = vi.fn();

vi.mock("./familyApi", () => ({
  getMyFamily: () => getMyFamilyMock(),
}));

const aMember: FamilyMemberDto = {
  id: "member-1",
  name: "Alfred",
  color: "#2E7D32",
  relation: "Barn",
  isPlaceholderName: 0,
  linkedUserId: null,
  linkedUserEmail: null,
  birthday: null,
};

// Reviewfund: syncFamilyMembersFromServer() invaliderede tidligere altid
// familySessionCache — men den kaldes ikke kun efter reelle mutationer
// (tilføj/redigér/slet medlem), også efter helt almindelige
// læse-/synk-kald (fx AppLayouts effekt, der holder familie-
// pseudomedlemmets server-id varmt ved HVER sideindlæsning). Det betød i
// praksis, at cachen ofte blev slettet umiddelbart efter, den var
// oprettet, og reelt aldrig levede i det tilsigtede 30-sekunders
// TTL-vindue. syncFamilyMembersFromServer() skal derfor IKKE selv
// invalidere — kun kaldesteder, der udfører en reel mutation, gør det
// eksplicit (se useFamilyMembers.ts/FamilySetupOnboarding.tsx).
describe("syncFamilyMembersFromServer does not itself invalidate the shared family cache", () => {
  beforeEach(() => {
    vi.resetModules();
    getMyFamilyMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("leaves an already-cached getCachedFamily() result intact after a plain sync call", async () => {
    const { getCachedFamily } = await import("./familySessionCache");
    const { syncFamilyMembersFromServer } = await import("./familyMembersSync");

    getMyFamilyMock.mockResolvedValue({ ok: true, status: 200, data: { family: { id: "family-1" } } });

    await getCachedFamily();
    expect(getMyFamilyMock).toHaveBeenCalledTimes(1);

    // Samme mønster som AppLayout.tsx's egne to effekter: hent familien
    // (via den delte cache), og synk derefter blot de returnerede
    // medlemmer ind i den lokale localStorage-cache — en ren læsning, ikke
    // en mutation.
    syncFamilyMembersFromServer([aMember]);

    await getCachedFamily();
    expect(getMyFamilyMock).toHaveBeenCalledTimes(1);
  });
});
