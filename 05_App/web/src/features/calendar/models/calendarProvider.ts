export type CalendarProviderType =
  | "google"
  | "outlook"
  | "apple";

/**
 * En leverandøruafhængig kalenderkilde.
 *
 * `externalReference` bruges kun af provider-laget til senere synkronisering
 * og må ikke behandles som en Google- eller Apple-identitet i UI-laget.
 */
export interface CalendarSource {
  id: string;
  name: string;
  providerType: CalendarProviderType;
  color: string;
  isVisible: boolean;
  isReadOnly: boolean;
  ownerId?: string;
  externalReference?: string;
}

export interface CalendarEventRange {
  start: string;
  end: string;
}

/**
 * Eksterne kilder (Google/Outlook/Apple) deler samme begrænsninger i UI'et:
 * ejerskab kommer fra kalender-til-familiemedlem-tildelingen (ADR-014) i
 * stedet for manuel valg, og appen opretter ikke selv nye gentagelsesregler
 * på dem. Brug denne i stedet for at sammenligne mod "google" direkte, så en
 * ny provider (fx Outlook) automatisk får samme behandling.
 */
export function isExternalCalendarProviderType(
  providerType: CalendarProviderType | undefined,
): boolean {
  return (
    providerType === "google" ||
    providerType === "outlook" ||
    providerType === "apple"
  );
}

/**
 * Standardvindue for at hente aftaler: begrænset og gyldigt for Googles
 * `timeMin`/`timeMax` (RFC3339-tidspunkter), i modsætning til den tidligere
 * konstant der brugte ECMAScripts dato-yderpunkter (år -271821 til +275760)
 * — ugyldige/urimelige år som blev sendt direkte til Google Calendar-API'et.
 * Beregnes ud fra det aktuelle tidspunkt, så vinduet altid er "nu ± et par år".
 */
export function getDefaultCalendarEventRange(
  referenceDate: Date = new Date(),
): CalendarEventRange {
  const start = new Date(referenceDate);
  start.setFullYear(start.getFullYear() - 1);

  const end = new Date(referenceDate);
  end.setFullYear(end.getFullYear() + 2);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
