import type { KeyboardEventHandler, RefObject } from "react";
import { useState } from "react";

import { DateField } from "@mui/x-date-pickers/DateField";
import { TimeField } from "@mui/x-date-pickers/TimeField";

// Native <input type="date">/<input type="time"> formaterer sig efter
// BROWSERENS sprog (fx navigator.language), ikke appens eget "da"
// html-lang — derfor kunne datoer og klokkeslæt vise sig som 08/22/2026 og
// 09:00 AM for en dansk bruger med en engelsksproget browser. DateField/
// TimeField er rene JS-tekstfelter (ingen native browser-UI), så formatet
// nedenfor er altid det, appen selv vælger, uanset browserens sprog.
const danishDateFormat = "dd.MM.yyyy";
const danishTimeFormat = "HH.mm";

function parseDateValue(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Klokkeslættet bæres kun af form-state'ens "HH:MM"-streng — dagen er
// ligegyldig, så et fast, neutralt referencedatum bruges blot til at kunne
// repræsentere tidspunktet som et Date-objekt (det eneste TimeField forstår).
function parseTimeValue(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`2000-01-01T${value}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimeValue(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

interface DanishDateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string | null;
  fullWidth?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onBlur?: () => void;
  onFocus?: () => void;
  minDate?: string;
}

export function DanishDateField({
  label,
  value,
  onChange,
  required,
  disabled,
  error,
  helperText,
  fullWidth,
  inputRef,
  onBlur,
  onFocus,
  minDate,
}: DanishDateFieldProps) {
  // DateField rapporterer `null` for hvert tastetryk, indtil alle tre
  // sektioner (dag/måned/år) er udfyldt — hvis det blev sendt videre til
  // forælderens string-state med det samme, ville næste render's
  // value={null} nulstille de sektioner, brugeren allerede havde skrevet i
  // (set i praksis: "15.09.2026" endte som "DD.MM.2026", kun årstallet
  // overlevede). Feltet holder derfor sin egen kladde og sender kun en
  // FÆRDIG dato videre til forælderen.
  const [draft, setDraft] = useState<Date | null>(() => parseDateValue(value));

  const externalValue = parseDateValue(value);
  if (
    formatDateValue(externalValue) !== formatDateValue(draft) &&
    formatDateValue(externalValue) !== ""
  ) {
    // Forælderen har sat en ny, færdig værdi udefra (fx dialogens reset ved
    // åbning, eller "Slutdato" der følger "Startdato") — kladden skal følge
    // med. Kun mens forælderens værdi er en anden RIGTIG dato, ikke en tom
    // streng, som ellers ville nulstille en aftale, der lige er ved at blive
    // skrevet.
    setDraft(externalValue);
  }

  return (
    <DateField
      label={label}
      format={danishDateFormat}
      value={draft}
      onChange={(date) => {
        // MUI rapporterer `null`, indtil alle tre sektioner (dag/måned/år)
        // er udfyldt — kladden (og dermed feltets `value`-prop) røres
        // bevidst IKKE ved et sådant mellemliggende null, ellers ville
        // feltet nulstille de sektioner, brugeren allerede har skrevet i
        // (se kommentaren ved `draft` ovenfor).
        if (date) {
          setDraft(date);

          const formatted = formatDateValue(date);
          if (formatted) {
            onChange(formatted);
          }
        }
      }}
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      inputRef={inputRef}
      onBlur={onBlur}
      onFocus={onFocus}
      minDate={parseDateValue(minDate ?? "") ?? undefined}
    />
  );
}

interface DanishTimeFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string | null;
  fullWidth?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  size?: "small" | "medium";
  variant?: "outlined" | "standard" | "filled";
  autoFocus?: boolean;
  sx?: object;
}

export function DanishTimeField({
  label,
  value,
  onChange,
  required,
  disabled,
  error,
  helperText,
  fullWidth,
  inputRef,
  onBlur,
  onFocus,
  onKeyDown,
  size,
  variant,
  autoFocus,
  sx,
}: DanishTimeFieldProps) {
  // Samme kladde-mønster som DanishDateField ovenfor, og af samme grund —
  // TimeField's time-sektion (og evt. AM/PM) rapporterer også `null`
  // undervejs, før begge dele er udfyldt.
  const [draft, setDraft] = useState<Date | null>(() => parseTimeValue(value));

  const externalValue = parseTimeValue(value);
  if (
    formatTimeValue(externalValue) !== formatTimeValue(draft) &&
    formatTimeValue(externalValue) !== ""
  ) {
    setDraft(externalValue);
  }

  return (
    <TimeField
      label={label}
      format={danishTimeFormat}
      ampm={false}
      value={draft}
      onChange={(date) => {
        if (date) {
          setDraft(date);

          const formatted = formatTimeValue(date);
          if (formatted) {
            onChange(formatted);
          }
        }
      }}
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      inputRef={inputRef}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      size={size}
      variant={variant}
      autoFocus={autoFocus}
      sx={sx}
    />
  );
}
