import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyFamilyMock = vi.fn();

vi.mock("./familyApi", () => ({
  getMyFamily: () => getMyFamilyMock(),
}));

// Sprint 57 (se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md, afsnit E):
// deduplikerer identiske getMyFamily()-kald på tværs af hook-instanser, med
// en kort TTL som sikkerhedsnet og eksplicit invalidering efter mutationer.
describe("familySessionCache", () => {
  beforeEach(() => {
    vi.resetModules();
    getMyFamilyMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dedupes concurrent callers within the TTL window into a single request", async () => {
    const { getCachedFamily } = await import("./familySessionCache");
    getMyFamilyMock.mockResolvedValue({ ok: true, status: 200, data: { family: { id: "family-1" } } });

    const [first, second, third] = await Promise.all([getCachedFamily(), getCachedFamily(), getCachedFamily()]);

    expect(getMyFamilyMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("fetches again after the TTL expires", async () => {
    const { getCachedFamily } = await import("./familySessionCache");
    getMyFamilyMock.mockResolvedValue({ ok: true, status: 200, data: { family: { id: "family-1" } } });

    await getCachedFamily();
    expect(getMyFamilyMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31_000);

    await getCachedFamily();
    expect(getMyFamilyMock).toHaveBeenCalledTimes(2);
  });

  it("fetches again immediately after invalidateFamilyCache(), even within the TTL window", async () => {
    const { getCachedFamily, invalidateFamilyCache } = await import("./familySessionCache");
    getMyFamilyMock.mockResolvedValue({ ok: true, status: 200, data: { family: { id: "family-1" } } });

    await getCachedFamily();
    expect(getMyFamilyMock).toHaveBeenCalledTimes(1);

    invalidateFamilyCache();

    await getCachedFamily();
    expect(getMyFamilyMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejected request, so the next caller retries instead of getting stuck", async () => {
    const { getCachedFamily } = await import("./familySessionCache");
    getMyFamilyMock.mockRejectedValueOnce(new Error("network down"));
    getMyFamilyMock.mockResolvedValueOnce({ ok: true, status: 200, data: { family: { id: "family-1" } } });

    await expect(getCachedFamily()).rejects.toThrow("network down");
    await expect(getCachedFamily()).resolves.toMatchObject({ ok: true });

    expect(getMyFamilyMock).toHaveBeenCalledTimes(2);
  });

  // Reviewfund: getMyFamily() kaster kun ved en reel netværksfejl — et
  // HTTP-fejlsvar (401/404/500/osv.) RESOLVER i stedet med { ok: false }
  // (se request() i familyApi.ts). Kun at rydde cachen ved et afvist
  // promise (som den oprindelige implementering gjorde) efterlod et
  // { ok: false }-svar cachet i op til 30 sekunder — enhver efterfølgende
  // hook ville få den samme fejl igen uden selv at kunne prøve friskt.
  it("does not cache an { ok: false } response, so the next caller retries", async () => {
    const { getCachedFamily } = await import("./familySessionCache");
    getMyFamilyMock.mockResolvedValueOnce({ ok: false, status: 404, data: {} });
    getMyFamilyMock.mockResolvedValueOnce({ ok: true, status: 200, data: { family: { id: "family-1" } } });

    await expect(getCachedFamily()).resolves.toMatchObject({ ok: false });
    await expect(getCachedFamily()).resolves.toMatchObject({ ok: true });

    expect(getMyFamilyMock).toHaveBeenCalledTimes(2);
  });

  it("does dedupe concurrent callers even when the shared request will resolve with { ok: false }", async () => {
    const { getCachedFamily } = await import("./familySessionCache");
    getMyFamilyMock.mockResolvedValue({ ok: false, status: 401, data: {} });

    const [first, second] = await Promise.all([getCachedFamily(), getCachedFamily()]);

    expect(getMyFamilyMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });
});
