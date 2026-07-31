// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCurrentMemberId,
  getCurrentMemberId,
  setCurrentMemberId,
} from "./currentMemberStorage";

describe("currentMemberStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing has been set", () => {
    expect(getCurrentMemberId()).toBeNull();
  });

  it("returns exactly what was saved", () => {
    setCurrentMemberId("nicolaj");

    expect(getCurrentMemberId()).toBe("nicolaj");
  });

  it("clears the stored id when set to null", () => {
    setCurrentMemberId("nicolaj");
    setCurrentMemberId(null);

    expect(getCurrentMemberId()).toBeNull();
  });

  it("clearCurrentMemberId removes the stored id", () => {
    setCurrentMemberId("nicolaj");
    clearCurrentMemberId();

    expect(getCurrentMemberId()).toBeNull();
  });
});
