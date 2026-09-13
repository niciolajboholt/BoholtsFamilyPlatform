import { useEffect, useState } from "react";

import { Alert, Box, Checkbox, CircularProgress, FormControlLabel, FormGroup, Typography } from "@mui/material";

import type { CalendarSource } from "../../calendar/models/calendarProvider";

interface CalendarSelectionPanelProps {
  // Samme mønster som IcsSubscriptionsPanel/IcloudConnectionsPanel — panelet
  // (gen)henter sin liste, hver gang dialogen åbnes.
  isOpen: boolean;
  // Provider-uafhængig: googleCalendarExclusionStorage.ts/
  // outlookCalendarExclusionStorage.ts og GoogleCalendarProvider/
  // OutlookCalendarProvider's egen eksklusionsfiltrering fandtes allerede
  // (mirror af hinanden) — men intet UI kaldte nogensinde setterne, så en
  // fravalgt kalender kunne aldrig faktisk vælges. Dette panel er den
  // manglende bro, delt af begge providere i stedet for to næsten-identiske
  // komponenter.
  listCalendars: () => Promise<CalendarSource[]>;
  getExcludedIds: () => string[];
  setExcludedIds: (ids: string[]) => void;
  loadErrorMessage: string;
  emptyStateMessage: string;
}

export function CalendarSelectionPanel({
  isOpen,
  listCalendars,
  getExcludedIds,
  setExcludedIds,
  loadErrorMessage,
  emptyStateMessage,
}: CalendarSelectionPanelProps) {
  const [calendars, setCalendars] = useState<CalendarSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [excludedIds, setExcludedIdsState] = useState<string[]>(() => getExcludedIds());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setErrorMessage(null);
    // Genindlæser altid det aktuelle fravalg, hver gang dialogen åbnes — en
    // frisk kopi, uafhængig af hvad en tidligere åbning måtte have efterladt
    // i denne komponents egen state.
    setExcludedIdsState(getExcludedIds());

    listCalendars()
      .then((result) => {
        if (isCancelled) return;
        setCalendars(result);
        setIsLoading(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setErrorMessage(loadErrorMessage);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
    // listCalendars/getExcludedIds er stabile provider-funktioner (moduleksporter),
    // ikke reaktiv state — kun isOpen skal genudløse hentningen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleToggle(rawCalendarId: string) {
    const next = excludedIds.includes(rawCalendarId)
      ? excludedIds.filter((id) => id !== rawCalendarId)
      : [...excludedIds, rawCalendarId];

    setExcludedIdsState(next);
    setExcludedIds(next);
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (errorMessage) {
    return <Alert severity="warning">{errorMessage}</Alert>;
  }

  return (
    <Box>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
        En fravalgt kalender hentes slet ikke — ikke kun skjult i visningen.
      </Typography>

      {calendars.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyStateMessage}
        </Typography>
      ) : (
        <FormGroup>
          {calendars.map((source) => {
            const rawCalendarId = source.externalReference;
            if (!rawCalendarId) return null;

            return (
              <FormControlLabel
                key={source.id}
                control={
                  <Checkbox
                    checked={!excludedIds.includes(rawCalendarId)}
                    onChange={() => handleToggle(rawCalendarId)}
                  />
                }
                label={source.name}
              />
            );
          })}
        </FormGroup>
      )}
    </Box>
  );
}
