import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";

import type { CalendarEvent } from "../features/calendar/models/calendarEvent";
import MonthCalendar from "../features/calendar/components/MonthCalendar";
import EventList from "../features/calendar/components/EventList";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";
import {
  addMonths,
  startOfMonth,
  toCalendarModel,
  toMonthNavBounds,
  type PublicCalendarEvent,
} from "../features/calendar/utils/publicSharedCalendarModel";

// Sprint 26: den eneste side i appen, der ikke går gennem AppLayout's
// login-gate (se AppRouter.tsx — monteret som en søskende-rute, ikke inde i
// AppLayout's <Route>). Rent skrivebeskyttet: ingen navigation til resten
// af appen, ingen opret/redigér/slet-handlinger — genbruger de samme
// måned-/dagslistevisningskomponenter som den almindelige kalenderside,
// blot med et informationsdialog i stedet for et redigér-flow ved klik.

interface PublicCalendarResponse {
  familyName: string;
  events: PublicCalendarEvent[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PublicCalendarResponse };

function errorMessageForStatus(status: number): string {
  if (status === 404) {
    return "Linket er ugyldigt eller er blevet deaktiveret.";
  }

  if (status === 429) {
    return "For mange forespørgsler lige nu. Prøv igen om lidt.";
  }

  if (status === 503) {
    return "Kalenderen er midlertidigt utilgængelig. Prøv igen senere.";
  }

  return "Kalenderen kunne ikke indlæses.";
}

function formatTimeRange(event: CalendarEvent): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  const formatter = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(event.start))}–${formatter.format(new Date(event.end))}`;
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", { month: "long", year: "numeric" }).format(date);
}

function PublicSharedCalendarPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [detailsEvent, setDetailsEvent] = useState<CalendarEvent | null>(null);
  const effectiveState: LoadState = useMemo(
    () => (token ? state : { status: "error", message: "Linket mangler et token." }),
    [token, state],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let isCancelled = false;
    // Er en no-op ved første kørsel (state starter allerede som "loading"
    // ovenfor) — kun reelt nødvendigt hvis token'et ændrer sig og effekten
    // genkøres, samme mønster som useCalendarEvents.ts's refreshEvents().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });

    fetch(`/api/public/family-calendar/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setState({ status: "error", message: errorMessageForStatus(response.status) });
          return;
        }

        const data = (await response.json()) as PublicCalendarResponse;
        setState({ status: "ready", data });
      })
      .catch(() => {
        if (!isCancelled) {
          setState({ status: "error", message: "Kalenderen kunne ikke indlæses." });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const calendarModel = useMemo(
    () =>
      effectiveState.status === "ready"
        ? toCalendarModel(effectiveState.data.events)
        : { members: [], events: [] },
    [effectiveState],
  );

  const navBounds = useMemo(() => toMonthNavBounds(new Date()), []);
  const eventsForSelectedDate = getEventsForDate(calendarModel.events, selectedDate);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          {effectiveState.status === "ready" ? effectiveState.data.familyName : "Familiens kalender"}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Delt kalendervisning — kun til at kigge på.
        </Typography>

        {effectiveState.status === "loading" && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {effectiveState.status === "error" && (
          <Alert severity="error">{effectiveState.message}</Alert>
        )}

        {effectiveState.status === "ready" && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                mb: 1.5,
              }}
            >
              <IconButton
                aria-label="Forrige måned"
                disabled={visibleMonth <= navBounds.min}
                onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
              >
                <ChevronLeftRounded />
              </IconButton>

              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, textTransform: "capitalize", minWidth: 160, textAlign: "center" }}
              >
                {formatMonthLabel(visibleMonth)}
              </Typography>

              <IconButton
                aria-label="Næste måned"
                disabled={visibleMonth >= navBounds.max}
                onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              >
                <ChevronRightRounded />
              </IconButton>
            </Box>

            <MonthCalendar
              visibleMonth={visibleMonth}
              selectedDate={selectedDate}
              events={calendarModel.events}
              members={calendarModel.members}
              onSelectDate={setSelectedDate}
              onSelectEvent={setDetailsEvent}
            />

            <EventList
              selectedDate={selectedDate}
              events={eventsForSelectedDate}
              members={calendarModel.members}
              onSelectEvent={setDetailsEvent}
            />
          </>
        )}
      </Box>

      <Dialog open={detailsEvent !== null} onClose={() => setDetailsEvent(null)} maxWidth="xs" fullWidth>
        {detailsEvent && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>{detailsEvent.title}</DialogTitle>
            <DialogContent sx={{ pb: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {formatTimeRange(detailsEvent)}
              </Typography>

              {detailsEvent.location && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {detailsEvent.location}
                </Typography>
              )}

              {detailsEvent.description && (
                <Typography variant="body2" color="text.secondary">
                  {detailsEvent.description}
                </Typography>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default PublicSharedCalendarPage;
