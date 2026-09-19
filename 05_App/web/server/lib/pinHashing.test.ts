import { describe, expect, it } from "vitest";

import { hashPin, isValidPinFormat, verifyPin } from "./pinHashing";

describe("isValidPinFormat", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidPinFormat("0000")).toBe(true);
    expect(isValidPinFormat("1234")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("12345")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
  });
});

describe("hashPin / verifyPin", () => {
  it("verifies the correct PIN against its own hash", async () => {
    const hash = await hashPin("4242");
    expect(await verifyPin("4242", hash)).toBe(true);
  });

  it("rejects a wrong PIN", async () => {
    const hash = await hashPin("4242");
    expect(await verifyPin("0000", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const hashA = await hashPin("4242");
    const hashB = await hashPin("4242");
    expect(hashA).not.toBe(hashB);
    expect(await verifyPin("4242", hashA)).toBe(true);
    expect(await verifyPin("4242", hashB)).toBe(true);
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPin("4242", "not-a-valid-hash")).toBe(false);
  });
});
