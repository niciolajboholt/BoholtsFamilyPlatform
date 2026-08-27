import { describe, expect, it } from "vitest";

import {
  getSafeGoogleEventDetails,
  isPrivateGoogleEvent,
} from "./googleCalendarPrivacy";

describe("googleCalendarPrivacy", () => {
  it.each(["private", "confidential"])(
    "redigerer %s-aftaler før de forlader serverlaget",
    (visibility) => {
      expect(
        getSafeGoogleEventDetails({
          visibility,
          summary: "Fortrolig behandling",
          description: "Følsomme noter",
          location: "Klinik 4",
        }),
      ).toEqual({ title: "Optaget", isPrivate: true });
    },
  );

  it("bevarer detaljer på en almindelig aftale", () => {
    expect(
      getSafeGoogleEventDetails({
        visibility: "default",
        summary: "Fodbold",
        description: "Husk støvler",
        location: "Klubben",
      }),
    ).toEqual({
      title: "Fodbold",
      description: "Husk støvler",
      location: "Klubben",
      isPrivate: false,
    });
  });

  it("behandler manglende visibility som en almindelig aftale", () => {
    expect(isPrivateGoogleEvent({})).toBe(false);
  });
});
