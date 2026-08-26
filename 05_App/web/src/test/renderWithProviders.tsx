import type { ReactElement } from "react";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { da } from "date-fns/locale";
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest.config.ts kører uden `test.globals: true` (bevidst, se
// 08_Development_Standards.md), så @testing-library/react's automatiske
// oprydning mellem tests (som ellers kigger efter en global afterEach)
// aktiveres aldrig af sig selv — uden dette blev dialogen fra én test
// stående i DOM'et og gjorde næste tests forespørgsler tvetydige.
afterEach(() => {
  cleanup();
});

// MUI X's DatePicker/TimeField (bag DanishDateField/DanishTimeField, se
// EventDateTimeSection.tsx) kaster, hvis de renderes uden en omsluttende
// LocalizationProvider — samme adapter/locale som main.tsx bruger i den
// rigtige app.
export function renderWithProviders(ui: ReactElement) {
  return render(
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={da}>
      {ui}
    </LocalizationProvider>,
  );
}
