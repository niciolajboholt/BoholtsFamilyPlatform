// Fase 8: bruges til at vise, hvor gammel en offline-fallback er ("Sidst
// opdateret ..."). Samme stil (dag/måned/år + time/minut, da-DK) som
// FeedbackInboxCard's formatSubmittedAt.
export function formatDanishDateTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}
