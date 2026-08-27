interface GooglePrivacyFields {
  visibility?: string;
  summary?: string;
  description?: string;
  location?: string;
}

export interface SafeGoogleEventDetails {
  title: string;
  description?: string;
  location?: string;
  isPrivate: boolean;
}

export function isPrivateGoogleEvent(
  event: Pick<GooglePrivacyFields, "visibility"> | null | undefined,
): boolean {
  return event?.visibility === "private" || event?.visibility === "confidential";
}

/**
 * Centralt server-side værn: private Google-felter må ikke nå delelinks,
 * Workers AI eller pushtekster og må derfor redigeres før data forlader
 * kalenderintegrationslaget.
 */
export function getSafeGoogleEventDetails(
  event: GooglePrivacyFields,
): SafeGoogleEventDetails {
  if (isPrivateGoogleEvent(event)) {
    return {
      title: "Optaget",
      isPrivate: true,
    };
  }

  return {
    title: event.summary || "Aftale",
    description: event.description,
    location: event.location,
    isPrivate: false,
  };
}
