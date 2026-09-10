import { useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, CircularProgress, Typography } from "@mui/material";

import { CalendarViewSwitch } from "./CalendarViewSwitch";
import EventList from "./EventList";
import type { useCalendarPageController } from "../hooks/useCalendarPageController";

type Controller = ReturnType<typeof useCalendarPageController>;

type CalendarBodyProps = Pick<
  Controller,
  | "calendarView"
  | "selectedDate"
  | "visibleDate"
  | "visibleEvents"
  | "members"
  | "conflictEventIds"
  | "sourceFilteredRawEvents"
  | "recurrenceExceptions"
  | "swipeNavigation"
  | "handleSelectDate"
  | "handleOpenDayFromWeek"
  | "handleSelectEvent"
  | "handleLongPressCreate"
  | "events"
  | "hasLoadedEvents"
  | "isLoading"
  | "error"
  | "isInitialLoading"
  | "isInitialSourceLoading"
  | "isRefreshing"
  | "visibleCalendarSourceIds"
  | "showAllCalendarSources"
  | "refreshEvents"
  | "refreshCalendarSources"
  | "eventsForSelectedDate"
>;

export function CalendarBody({
  events,
  hasLoadedEvents,
  isLoading,
  error,
  isInitialLoading,
  isInitialSourceLoading,
  isRefreshing,
  visibleCalendarSourceIds,
  visibleEvents,
  showAllCalendarSources,
  refreshEvents,
  refreshCalendarSources,
  eventsForSelectedDate,
  calendarView,
  ...viewSwitchProps
}: CalendarBodyProps) {
  const isInitial = isInitialLoading || isInitialSourceLoading;

  // En langsom/ustabil forbindelse (fx svagt mobilsignal) kan lade den
  // indledende hentning tage lang tid — fetch() har ingen indbygget
  // timeout, så uden dette ville "Indlæser kalender…" stå helt uden
  // forklaring eller en måde at gøre noget ved det, indtil forbindelsen
  // reelt kommer igennem. Rører ikke selve kaldet (det kan sagtens lykkes
  // efter lang tid) — tilføjer kun en synlig forklaring og en manuel
  // "Prøv igen", der starter et nyt kald.
  const [isTakingLong, setIsTakingLong] = useState(false);

  useEffect(() => {
    // isInitial kan kun være true én gang pr. montering (hasLoadedEvents
    // forbliver true resten af komponentens levetid, når først den er
    // sat) — der er derfor ikke brug for at nulstille isTakingLong her,
    // kun for at undgå at sætte den, mens der ikke er noget at vente på.
    if (!isInitial) {
      return;
    }

    const timeoutId = window.setTimeout(() => setIsTakingLong(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [isInitial]);

  if (isInitial) {
    return (
      <Card sx={{ mb: 2.5 }}>
        <CardContent>
          <Box
            role="status"
            sx={{
              minHeight: 180,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <CircularProgress />
            <Typography>Indlæser kalender…</Typography>

            {isTakingLong && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  Dette tager længere end normalt — tjek din internetforbindelse.
                </Typography>

                <Button
                  size="small"
                  onClick={() => {
                    void refreshEvents();
                    void refreshCalendarSources();
                  }}
                >
                  Prøv igen
                </Button>
              </>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error && !hasLoadedEvents) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            aria-label="Prøv at indlæse kalenderen igen"
            color="inherit"
            size="small"
            disabled={isLoading}
            onClick={() => {
              void refreshEvents();
            }}
          >
            Prøv igen
          </Button>
        }
        sx={{ mb: 2.5 }}
      >
        Kalenderen kunne ikke indlæses.
      </Alert>
    );
  }

  return (
    <>
      {isRefreshing && (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <CircularProgress size={18} />
          <Typography variant="body2">Opdaterer kalender…</Typography>
        </Box>
      )}

      {error && (
        <Alert
          severity="warning"
          action={
            <Button
              aria-label="Prøv at indlæse kalenderen igen"
              color="inherit"
              size="small"
              disabled={isLoading}
              onClick={() => {
                void refreshEvents();
              }}
            >
              Prøv igen
            </Button>
          }
          sx={{ mb: 2.5 }}
        >
          Kalenderen kunne ikke opdateres. De senest indlæste aftaler vises.
        </Alert>
      )}

      {visibleCalendarSourceIds.length === 0 ? (
        <Alert
          severity="info"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={showAllCalendarSources}>
              Vis alle kalendere
            </Button>
          }
        >
          Ingen kalendere er valgt.
        </Alert>
      ) : events.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Ingen aftaler endnu.
        </Alert>
      ) : visibleEvents.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Ingen aftaler matcher de valgte kalendere.
        </Alert>
      ) : null}

      <CalendarViewSwitch calendarView={calendarView} visibleEvents={visibleEvents} {...viewSwitchProps} />

      {calendarView === "month" && (
        <EventList
          selectedDate={viewSwitchProps.selectedDate}
          events={eventsForSelectedDate}
          members={viewSwitchProps.members}
          conflictEventIds={viewSwitchProps.conflictEventIds}
          onSelectEvent={viewSwitchProps.handleSelectEvent}
        />
      )}
    </>
  );
}
