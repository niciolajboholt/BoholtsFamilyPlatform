// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FamilyMemberDto } from "../../family/familyApi";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const addFamilyMemberMock = vi.fn();
const updateFamilyMemberMock = vi.fn();
const deleteFamilyMemberMock = vi.fn();
const invalidateFamilyCacheMock = vi.fn();

vi.mock("../../family/familyApi", () => ({
  addFamilyMember: (...args: unknown[]) => addFamilyMemberMock(...args),
  updateFamilyMember: (...args: unknown[]) => updateFamilyMemberMock(...args),
  deleteFamilyMember: (...args: unknown[]) => deleteFamilyMemberMock(...args),
}));

vi.mock("../../family/familySessionCache", () => ({
  getCachedFamily: () =>
    Promise.resolve({ ok: true, status: 200, data: { family: { id: "family-1" } } }),
  invalidateFamilyCache: () => invalidateFamilyCacheMock(),
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

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

// Reviewfund: en reel mutation (tilføj/redigér/slet medlem) SKAL invalidere
// den delte familySessionCache — modsat en almindelig læsning/synk (se
// familyMembersSync.test.ts), som bevidst IKKE gør det. Denne test
// bekræfter, at useFamilyMembers()' tre mutationsfunktioner rent faktisk
// kalder invalidateFamilyCache() efter et vellykket serverkald.
describe("useFamilyMembers invalidates the shared family cache after a real mutation", () => {
  async function renderHookAndWaitForFamilyId(): Promise<{
    result: () => ReturnType<
      typeof import("./useFamilyMembers")["useFamilyMembers"]
    >;
    unmount: () => Promise<void>;
  }> {
    const { useFamilyMembers } = await import("./useFamilyMembers");
    let latest: ReturnType<typeof useFamilyMembers> | undefined;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Harness() {
      latest = useFamilyMembers();
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });

    return {
      result: () => latest!,
      unmount: async () => {
        await act(async () => root.unmount());
        container.remove();
      },
    };
  }

  it("calls invalidateFamilyCache() after addMember succeeds", async () => {
    addFamilyMemberMock.mockResolvedValue({ ok: true, status: 200, data: { members: [aMember] } });
    const { result, unmount } = await renderHookAndWaitForFamilyId();

    await act(async () => {
      await result().addMember({ name: "Alfred", color: "#2E7D32", relation: "Barn" });
    });

    expect(invalidateFamilyCacheMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("calls invalidateFamilyCache() after updateMember succeeds", async () => {
    updateFamilyMemberMock.mockResolvedValue({ ok: true, status: 200, data: { members: [aMember] } });
    const { result, unmount } = await renderHookAndWaitForFamilyId();

    await act(async () => {
      await result().updateMember("member-1", { name: "Alfred", color: "#2E7D32", relation: "Barn" });
    });

    expect(invalidateFamilyCacheMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("calls invalidateFamilyCache() after deleteMember succeeds", async () => {
    deleteFamilyMemberMock.mockResolvedValue({ ok: true, status: 200, data: { members: [] } });
    const { result, unmount } = await renderHookAndWaitForFamilyId();

    await act(async () => {
      await result().deleteMember("member-1");
    });

    expect(invalidateFamilyCacheMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("does not invalidate the cache when a mutation fails server-side", async () => {
    addFamilyMemberMock.mockResolvedValue({ ok: false, status: 400, data: { error: "Ugyldigt navn." } });
    const { result, unmount } = await renderHookAndWaitForFamilyId();

    await act(async () => {
      await result().addMember({ name: "", color: "#2E7D32", relation: "Barn" });
    });

    expect(invalidateFamilyCacheMock).not.toHaveBeenCalled();
    await unmount();
  });
});
