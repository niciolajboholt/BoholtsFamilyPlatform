import { describe, expect, it } from "vitest";

import { getProviderConnectionStatusText } from "./getProviderConnectionStatusText";

describe("getProviderConnectionStatusText", () => {
  it("prefers the configuration error when not configured", () => {
    expect(
      getProviderConnectionStatusText(false, false, false, false, "Mangler client-id"),
    ).toBe("Mangler client-id");
  });

  it("falls back to a generic message when not configured and no error is given", () => {
    expect(getProviderConnectionStatusText(false, false, false, false)).toBe(
      "Ikke konfigureret",
    );
  });

  it("reports connected regardless of the other flags", () => {
    expect(getProviderConnectionStatusText(true, true, true, true)).toBe("Forbundet");
  });

  it("reports a silent reconnect attempt in progress", () => {
    expect(getProviderConnectionStatusText(true, false, true, true)).toBe(
      "Genopretter forbindelsen...",
    );
  });

  it("distinguishes never-connected from disconnected-this-session", () => {
    expect(getProviderConnectionStatusText(true, false, false, true)).toBe(
      "Ikke forbundet i denne session",
    );
    expect(getProviderConnectionStatusText(true, false, false, false)).toBe(
      "Ikke forbundet endnu",
    );
  });
});
