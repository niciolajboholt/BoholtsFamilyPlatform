export type CalendarProviderType =
  | "google"
  | "outlook"
  | "apple"
  | "ics";

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
    providerType === "apple" ||
    providerType === "ics"
  );
}

/**
 * Sprint 34: kun Google Kalender-skrivevejen (googleCalendarWriteMapper.ts)
 * ved i dag, hvordan en gentagelsesregel oversættes til det format,
 * kilden forstår (RFC 5545 RRULE for Google) — Outlook/Apple/ICS er
 * fortsat udenfor scope. Brug denne i stedet for at sammenligne mod
 * "google" direkte i UI-laget, så det er tydeligt hvorfor Google er en
 * undtagelse fra isExternalCalendarProviderType ovenfor, ikke en
 * modsigelse af den.
 */
export function providerSupportsRecurrenceCreation(
  providerType: CalendarProviderType | undefined,
): boolean {
  return providerType === "google";
}

/**
 * Sprint 36: kun Google Kalender-skrivevejen ved i dag, hvordan et manuelt
 * ejerskab skrives/ryddes (Googles egne extendedProperties, se
 * googleCalendarWriteMapper.ts/googleCalendarMapper.ts) — for et
 * familiemedlem uden egen konto/kalender, som hverken deltager- eller
 * kalender-tildeling kan nå. Outlook/Apple/ICS er fortsat udenfor scope.
 * Brug denne i stedet for at sammenligne mod "google" direkte i UI-laget.
 */
export function providerSupportsManualOwnerOverride(
  providerType: CalendarProviderType | undefined,
): boolean {
  return providerType === "google";
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
