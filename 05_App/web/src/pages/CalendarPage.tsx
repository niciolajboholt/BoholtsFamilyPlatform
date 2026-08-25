import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AddIcon from "@mui/icons-material/Add";
import { CloudDoneRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";

import { useLocation, useNavigate } from "react-router-dom";

import CalendarToolbar from "../features/calendar/components/CalendarToolbar";
import { CalendarSourceFilter } from "../features/calendar/components/CalendarSourceFilter";
import DayCalendar from "../features/calendar/components/DayCalendar";
import EditEventDialog from "../features/calendar/components/EditEventDialog";
import EventList from "../features/calendar/components/EventList";
import { ExternalCalendarConnectionBanner } from "../features/calendar/components/ExternalCalendarConnectionBanner";
import FamilyPlannerCalendar from "../features/calendar/components/FamilyPlannerCalendar";
import MonthCalendar from "../features/calendar/components/MonthCalendar";
import NewEventDialog from "../features/calendar/components/NewEventDialog";
import WeekCalendar from "../features/calendar/components/WeekCalendar";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import { useCalendarSources } from "../features/calendar/hooks/useCalendarSources";
import { useFamilyMembers } from "../features/calendar/hooks/useFamilyMembers";
import { useGoogleCalendarConnection } from "../features/calendar/hooks/useGoogleCalendarConnection";
import { useOutlookCalendarConnection } from "../features/calendar/hooks/useOutlookCalendarConnection";
import { useRecurrenceExceptions } from "../features/calendar/hooks/useRecurrenceExceptions";
import { useSwipeNavigation } from "../features/calendar/hooks/useSwipeNavigation";
import type {
  CalendarEvent,
} from "../features/calendar/models/calendarEvent";
import type { CreateCalendarEventInput } from "../features/calendar/models/calendarEventInput";
import type { CalendarEventRange } from "../features/calendar/models/calendarProvider";
import type { CalendarView } from "../features/calendar/models/calendarView";
import { expandRecurringEvents } from "../features/calendar/utils/expandRecurringEvents";
import { findAllCalendarConflicts } from "../features/calendar/utils/findAllCalendarConflicts";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";

type SnackbarSeverity =
  | "success"
  | "error";

interface SnackbarState {
  open: boolean;
  severity: SnackbarSeverity;
  message: string;
  showUndo: boolean;
}

function getTodayCalendarDate(): Date {
  const today = new Date();

  today.setHours(12, 0, 0, 0);

  return today;
}

function startOfMonth(
  date: Date,
): Date {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );

  result.setHours(12, 0, 0, 0);

  return result;
}

function changeMonth(
  date: Date,
  numberOfMonths: number,
): Date {
  const result = new Date(
    date.getFullYear(),
    date.getMonth() +
      numberOfMonths,
    1,
  );

  result.setHours(12, 0, 0, 0);

  return result;
}

function changeWeek(
  date: Date,
  numberOfWeeks: number,
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() +
      numberOfWeeks * 7,
  );

  result.setHours(12, 0, 0, 0);

  return result;
}

function changeDay(
  date: Date,
  numberOfDays: number,
): Date {
  const result = new Date(date);

  result.setDate(result.getDate() + numberOfDays);
  result.setHours(12, 0, 0, 0);

  return result;
}

// Rundhåndet interval omkring det synlige tidsrum (uge- eller måneds-gitter
// kan række ~1 uge ind i nabomåneder) — bruges kun til at afgrænse
// gentagelses-udfoldning, ikke til præcis dag-visning (det gør
// getEventsForDate/getEventsForWeek stadig nedstrøms). Planlæggeren udregner
// sit eget, dynamisk voksende interval internt (se FamilyPlannerCalendar) og
// bruger ikke denne værdi — falder derfor blot igennem til månedens brede
// standardbuffer nedenfor.
function getVisibleRange(
  visibleDate: Date,
  calendarView: CalendarView,
): CalendarEventRange {
  if (calendarView === "week") {
    const start = new Date(visibleDate);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(visibleDate);
    end.setDate(end.getDate() + 14);
    end.setHours(0, 0, 0, 0);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  if (calendarView === "day") {
    const start = new Date(visibleDate);
    start.setDate(start.getDate() - 3);
    start.setHours(0, 0, 0, 0);

    const end = new Date(visibleDate);
    end.setDate(end.getDate() + 4);
    end.setHours(0, 0, 0, 0);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  const start = new Date(
    visibleDate.getFullYear(),
    visibleDate.getMonth(),
    1,
  );
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(
    visibleDate.getFullYear(),
    visibleDate.getMonth() + 1,
    1,
  );
  end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Månedsvisningen er svær at læse på en telefon (aftalekortene skal være
// meget små for at være der) — mobil starter derfor i ugevisning, mens
// større skærme fortsat starter i månedsvisning.
function getDefaultCalendarView(): CalendarView {
  if (typeof window === "undefined") {
    return "month";
  }

  return window.innerWidth < 600 ? "week" : "month";
}

function CalendarPage() {
  const [
    selectedDate,
    setSelectedDate,
  ] = useState(getTodayCalendarDate);

  const [
    calendarView,
    setCalendarView,
  ] =
    useState<CalendarView>(getDefaultCalendarView);

  const [
    visibleDate,
    setVisibleDate,
  ] = useState(() =>
    calendarView === "month"
      ? startOfMonth(getTodayCalendarDate())
      : getTodayCalendarDate(),
  );

  const location = useLocation();
  const navigate = useNavigate();

  // Sprint 29: HomePage's "Ny aftale"-genvej navigerer hertil med
  // state.openNewEventDialog — læses direkte som initial-værdi (ikke
  // via setState i en effekt) for at undgå en unødvendig ekstra render.
  const [
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
  ] = useState(
    () => Boolean((location.state as { openNewEventDialog?: boolean } | null)?.openNewEventDialog),
  );

  // Ryddes med det samme via replace, så et browser-tilbage-klik ikke
  // åbner dialogen igen.
  useEffect(() => {
    if (location.state) {
      navigate(".", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  // Langt tryk på et tomt sted i kalenderen (alle tre visninger) åbner
  // opret-dialogen forudfyldt med det tryk-ramte tidspunkt, i stedet for
  // altid "selectedDate" kl. 09:00 — nulstilles ved dialogens luk, så den
  // almindelige "Ny aftale"-knap fortsat bruger selectedDate som før.
  const [
    longPressCreateDate,
    setLongPressCreateDate,
  ] = useState<Date | null>(null);

  function handleLongPressCreate(date: Date) {
    setLongPressCreateDate(date);
    setIsNewEventDialogOpen(true);
  }

  const [
    selectedEvent,
    setSelectedEvent,
  ] =
    useState<CalendarEvent | null>(
      null,
    );

  const [
    deletedEvent,
    setDeletedEvent,
  ] =
    useState<CalendarEvent | null>(
      null,
    );

  const [
    snackbar,
    setSnackbar,
  ] = useState<SnackbarState>({
    open: false,
    severity: "success",
    message: "",
    showUndo: false,
  });

  const {
    events,
    hasLoadedEvents,
    isLoading,
    isSaving,
    error,
    providerHealth,
    createEvent,
    updateEvent,
    deleteEvent,
    restoreEvent,
    refreshEvents,
  } = useCalendarEvents();

  const {
    calendarSources,
    visibleCalendarSourceIds,
    isLoading: isLoadingCalendarSources,
    hasLoadedSources,
    error: calendarSourcesError,
    toggleCalendarSource,
    showAll: showAllCalendarSources,
    refresh: refreshCalendarSources,
  } = useCalendarSources();

  const { members } = useFamilyMembers();

  const recurrenceExceptions = useRecurrenceExceptions();

  const {
    isLoading: isGoogleCalendarStatusLoading,
    isConnected: isGoogleCalendarConnected,
  } = useGoogleCalendarConnection();

  const {
    isConfigured: isOutlookCalendarConfigured,
    configurationError: outlookCalendarConfigurationError,
    isConnected: isOutlookCalendarConnected,
    wasEverConnected: wasOutlookCalendarEverConnected,
    isAttemptingSilentReconnect: isAttemptingOutlookSilentReconnect,
  } = useOutlookCalendarConnection();

  const wasGoogleCalendarConnectedRef = useRef(isGoogleCalendarConnected);
  const wasOutlookCalendarConnectedRef = useRef(isOutlookCalendarConnected);

  useEffect(() => {
    const wasConnected = wasGoogleCalendarConnectedRef.current;
    wasGoogleCalendarConnectedRef.current = isGoogleCalendarConnected;

    if (!wasConnected && isGoogleCalendarConnected) {
      // Covers both a manual connect and Sprint 14's silent reconnect —
      // either way, the calendar list and events need to catch up now
      // that Google is reachable.
      void refreshCalendarSources();
      void refreshEvents();
    }
  }, [isGoogleCalendarConnected, refreshCalendarSources, refreshEvents]);

  useEffect(() => {
    const wasConnected = wasOutlookCalendarConnectedRef.current;
    wasOutlookCalendarConnectedRef.current = isOutlookCalendarConnected;

    if (!wasConnected && isOutlookCalendarConnected) {
      void refreshCalendarSources();
      void refreshEvents();
    }
  }, [isOutlookCalendarConnected, refreshCalendarSources, refreshEvents]);

  // Erstatter det tidligere permanente grønne "Google Kalender er
  // forbundet"-banner over kalenderen — den gode tilstand fylder nu kun et
  // lille synkroniseringsikon ved overskriften (se JSX nedenfor), mens
  // ExternalCalendarConnectionBanner stadig viser fejl/afbrudt-tilstande.
  const connectedProviderLabels = [
    isGoogleCalendarConnected &&
    providerHealth.find((health) => health.providerId === "google")?.status !== "error"
      ? "Google"
      : null,
    isOutlookCalendarConfigured &&
    isOutlookCalendarConnected &&
    providerHealth.find((health) => health.providerId === "outlook")?.status !== "error"
      ? "Outlook"
      : null,
  ].filter((label): label is string => Boolean(label));

  const isInitialLoading =
    isLoading && !hasLoadedEvents;
  const isInitialSourceLoading =
    isLoadingCalendarSources && !hasLoadedSources;
  const isRefreshing =
    isLoading && hasLoadedEvents;

  const visibleRange = useMemo(
    () => getVisibleRange(visibleDate, calendarView),
    [visibleDate, calendarView],
  );

  const expandedEvents = useMemo(
    () =>
      expandRecurringEvents(
        events,
        visibleRange,
        recurrenceExceptions.exceptions,
      ),
    [events, visibleRange, recurrenceExceptions.exceptions],
  );

  const visibleEvents =
    useMemo(() => {
      const visibleSourceIds = new Set(visibleCalendarSourceIds);

      return expandedEvents.filter((event) =>
        visibleSourceIds.has(event.sourceId),
      );
    }, [expandedEvents, visibleCalendarSourceIds]);

  // Sprint 26: vedvarende visuel markering af overlappende aftaler direkte i
  // kalendervisningen — beregnes over det viste sæt (samme grundlag som
  // eventsForSelectedDate nedenfor), ikke over ALLE hentede aftaler.
  const conflictEventIds = useMemo(
    () => findAllCalendarConflicts(visibleEvents),
    [visibleEvents],
  );

  // Planlæggeren udfolder selv gentagne aftaler internt over sit eget,
  // dynamisk voksende rulle-vindue (se FamilyPlannerCalendar) — sourceId er
  // uændret på tværs af gentagelses-udfoldning, så det er korrekt at filtrere
  // her på de rå aftaler, i stedet for at afhænge af expandedEvents' faste,
  // lille synlige interval.
  const sourceFilteredRawEvents =
    useMemo(() => {
      const visibleSourceIds = new Set(visibleCalendarSourceIds);

      return events.filter((event) =>
        visibleSourceIds.has(event.sourceId),
      );
    }, [events, visibleCalendarSourceIds]);

  const eventsForSelectedDate =
    useMemo(() => {
      const dateEvents =
        getEventsForDate(
          visibleEvents,
          selectedDate,
        );

      return dateEvents;
    }, [
      visibleEvents,
      selectedDate,
    ]);

  function showSnackbar(
    severity: SnackbarSeverity,
    message: string,
    showUndo = false,
  ) {
    setSnackbar({
      open: true,
      severity,
      message,
      showUndo,
    });
  }

  function handleCloseSnackbar(
    _event?: Event | React.SyntheticEvent,
    reason?: string,
  ) {
    if (reason === "clickaway") {
      return;
    }

    setSnackbar(
      (currentSnackbar) => ({
        ...currentSnackbar,
        open: false,
      }),
    );
  }

  function handleSelectDate(
    date: Date,
  ) {
    setSelectedDate(date);

    if (
      calendarView === "month"
    ) {
      setVisibleDate(
        startOfMonth(date),
      );
    } else {
      setVisibleDate(date);
    }
  }

  // Ugevisningens dagkort er en agenda-oversigt, for lille til selv at vise
  // aftalernes fulde detaljer — et tryk på en dag giver derfor mere mening
  // som "gå til den dags fulde dagvisning" end blot at markere dagen uden at
  // skifte visning (det sidste er stadig det rigtige for månedsvisningen,
  // hvor EventList nedenunder allerede viser den valgte dags aftaler).
  function handleOpenDayFromWeek(
    date: Date,
  ) {
    setSelectedDate(date);
    setVisibleDate(date);
    setCalendarView("day");
  }

  function handlePrevious() {
    setVisibleDate((currentDate) => {
      if (calendarView === "month") return changeMonth(currentDate, -1);
      if (calendarView === "week") return changeWeek(currentDate, -1);
      if (calendarView === "day") return changeDay(currentDate, -1);
      return changeMonth(currentDate, -1); // planner: skifter vinduets centrum en måned ad gangen
    });

    if (calendarView === "week") {
      setSelectedDate((currentDate) => changeWeek(currentDate, -1));
    } else if (calendarView === "day") {
      setSelectedDate((currentDate) => changeDay(currentDate, -1));
    }
  }

  function handleNext() {
    setVisibleDate((currentDate) => {
      if (calendarView === "month") return changeMonth(currentDate, 1);
      if (calendarView === "week") return changeWeek(currentDate, 1);
      if (calendarView === "day") return changeDay(currentDate, 1);
      return changeMonth(currentDate, 1); // planner: skifter vinduets centrum en måned ad gangen
    });

    if (calendarView === "week") {
      setSelectedDate((currentDate) => changeWeek(currentDate, 1));
    } else if (calendarView === "day") {
      setSelectedDate((currentDate) => changeDay(currentDate, 1));
    }
  }

  // Swipe venstre/højre over selve kalendervisningen genbruger nøjagtig de
  // samme handlere som </>-knapperne i CalendarToolbar — samme betydning
  // (venstre = frem, højre = tilbage), bare som gestus i stedet for tryk.
  const swipeNavigation = useSwipeNavigation({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrevious,
  });

  function handleToday() {
    const today = getTodayCalendarDate();

    setSelectedDate(today);

    setVisibleDate(
      calendarView === "month"
        ? startOfMonth(today)
        : today,
    );
  }

  function handleChangeView(
    view: CalendarView,
  ) {
    setCalendarView(view);

    setVisibleDate(
      view === "month"
        ? startOfMonth(
            selectedDate,
          )
        : selectedDate,
    );
  }

  async function handleCreateEvent(
    input: CreateCalendarEventInput,
  ) {
    try {
      const createdEvent =
        await createEvent(input);

      const createdDate =
        new Date(
          createdEvent.start,
        );

      createdDate.setHours(
        12,
        0,
        0,
        0,
      );

      setSelectedDate(
        createdDate,
      );

      setVisibleDate(
        calendarView === "month"
          ? startOfMonth(
              createdDate,
            )
          : createdDate,
      );

      showSnackbar(
        "success",
        "Aftalen blev oprettet.",
      );
    } catch {
      showSnackbar(
        "error",
        "Aftalen kunne ikke oprettes.",
      );
    }
  }

  function handleSelectEvent(
    event: CalendarEvent,
  ) {
    setSelectedEvent(event);
  }

  function handleCloseEditDialog() {
    setSelectedEvent(null);
  }

  async function handleUpdateEvent(
    event: CalendarEvent,
  ) {
    try {
      const updatedEvent =
        await updateEvent(event);

      const updatedDate =
        new Date(
          updatedEvent.start,
        );

      updatedDate.setHours(
        12,
        0,
        0,
        0,
      );

      setSelectedDate(
        updatedDate,
      );

      setVisibleDate(
        calendarView === "month"
          ? startOfMonth(
              updatedDate,
            )
          : updatedDate,
      );

      setSelectedEvent(
        updatedEvent,
      );

      showSnackbar(
        "success",
        "Aftalen blev opdateret.",
      );
    } catch (caughtError: unknown) {
      showSnackbar(
        "error",
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "Aftalen kunne ikke opdateres.",
      );
    }
  }

  async function handleDeleteEvent(
    eventId: string,
  ) {
    const eventToDelete =
      events.find(
        (event) =>
          event.id === eventId,
      );

    if (!eventToDelete) {
      showSnackbar(
        "error",
        "Aftalen kunne ikke findes.",
      );

      return;
    }

    try {
      await deleteEvent(eventId);

      setDeletedEvent(
        eventToDelete,
      );

      setSelectedEvent(null);

      showSnackbar(
        "success",
        "Aftalen blev slettet.",
        true,
      );
    } catch {
      showSnackbar(
        "error",
        "Aftalen kunne ikke slettes.",
      );
    }
  }

  async function handleUndoDelete() {
    if (!deletedEvent) {
      return;
    }

    try {
      const restoredEvent =
        await restoreEvent(
          deletedEvent,
        );

      const restoredDate =
        new Date(
          restoredEvent.start,
        );

      restoredDate.setHours(
        12,
        0,
        0,
        0,
      );

      setSelectedDate(
        restoredDate,
      );

      setVisibleDate(
        calendarView === "month"
          ? startOfMonth(
              restoredDate,
            )
          : restoredDate,
      );

      setDeletedEvent(null);

      showSnackbar(
        "success",
        "Aftalen blev gendannet.",
      );
    } catch {
      showSnackbar(
        "error",
        "Aftalen kunne ikke gendannes.",
      );
    }
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        pb: 4,
      }}
    >
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: {
            xs: "stretch",
            sm: "center",
          },
          justifyContent:
            "space-between",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          gap: 2,
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="h4">
              Kalender
            </Typography>

            {connectedProviderLabels.length > 0 && (
              <Tooltip
                title={`${connectedProviderLabels.join(" og ")} Kalender: Synkroniseret`}
                enterTouchDelay={0}
              >
                <CloudDoneRounded
                  color="success"
                  fontSize="small"
                  aria-label={`${connectedProviderLabels.join(" og ")} Kalender er synkroniseret`}
                />
              </Tooltip>
            )}
          </Box>

          <Typography
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            Familiens aftaler samlet
            ét sted.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            setIsNewEventDialogOpen(
              true,
            )
          }
        >
          Ny aftale
        </Button>
      </Box>

      <CalendarToolbar
        calendarView={
          calendarView
        }
        visibleDate={visibleDate}
        onPrevious={
          handlePrevious
        }
        onNext={handleNext}
        onToday={handleToday}
        onChangeView={
          handleChangeView
        }
      />

      {!isGoogleCalendarStatusLoading && (
        <ExternalCalendarConnectionBanner
          providerLabel="Google"
          isConfigured
          isConnected={isGoogleCalendarConnected}
          wasEverConnected
          isAttemptingSilentReconnect={false}
          health={providerHealth.find(
            (health) => health.providerId === "google",
          )}
          onRetry={() => {
            void refreshEvents();
            void refreshCalendarSources();
          }}
        />
      )}

      {/*
        Outlook er midlertidigt slået fra uden en configurationError (se
        outlookCalendarConfig.ts) — vises slet ikke her, mens den er ukonfigureret,
        i stedet for en "ikke konfigureret"-boks ingen kan handle på endnu.
        Dukker automatisk op igen, når Outlook genaktiveres.
      */}
      {isOutlookCalendarConfigured && (
      <ExternalCalendarConnectionBanner
        providerLabel="Outlook"
        isConfigured={isOutlookCalendarConfigured}
        configurationError={outlookCalendarConfigurationError}
        isConnected={isOutlookCalendarConnected}
        wasEverConnected={wasOutlookCalendarEverConnected}
        isAttemptingSilentReconnect={isAttemptingOutlookSilentReconnect}
        health={providerHealth.find(
          (health) => health.providerId === "outlook",
        )}
        onRetry={() => {
          void refreshEvents();
          void refreshCalendarSources();
        }}
      />
      )}

      <Card sx={{ mb: 2.5 }}>
        <CardContent
          sx={{ p: 2.5 }}
        >
          <CalendarSourceFilter
            calendarSources={calendarSources}
            visibleCalendarSourceIds={visibleCalendarSourceIds}
            isLoading={isLoadingCalendarSources}
            error={calendarSourcesError}
            onToggle={toggleCalendarSource}
            onShowAll={showAllCalendarSources}
            onRetry={() => { void refreshCalendarSources(); }}
          />
        </CardContent>
      </Card>

      {isInitialLoading || isInitialSourceLoading ? (
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

              <Typography>
                Indlæser kalender…
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : error && !hasLoadedEvents ? (
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
      ) : (
        <>
          {isRefreshing && (
            <Box
              role="status"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 1.5,
              }}
            >
              <CircularProgress size={18} />

              <Typography variant="body2">
                Opdaterer kalender…
              </Typography>
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
            <Alert severity="info" sx={{ mb: 2.5 }} action={<Button color="inherit" size="small" onClick={showAllCalendarSources}>Vis alle kalendere</Button>}>
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

      <Box
        {...(calendarView === "planner" ? {} : swipeNavigation)}
        sx={
          calendarView === "planner"
            ? undefined
            // Frigør vandrette strøg til vores egen pointer-håndtering i
            // stedet for at lade browseren først forsøge at fortolke dem som
            // sin egen pan/scroll-gestus (hvilket ellers kunne kræve et
            // urealistisk langt strøg, før det overhovedet blev registreret)
            // — lodret scroll (fx dagvisningens tidslinje) er upåvirket.
            : { touchAction: "pan-y" }
        }
      >
      {calendarView === "month" ? (
        <MonthCalendar
          visibleMonth={visibleDate}
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectDate={handleSelectDate}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : calendarView === "week" ? (
        <WeekCalendar
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectDate={handleOpenDayFromWeek}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : calendarView === "day" ? (
        <DayCalendar
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : (
        <FamilyPlannerCalendar
          visibleDate={visibleDate}
          events={sourceFilteredRawEvents}
          recurrenceExceptions={recurrenceExceptions.exceptions}
          members={members}
          onSelectEvent={handleSelectEvent}
        />
      )}
      </Box>

      {calendarView === "month" && (
        <EventList
          selectedDate={selectedDate}
          events={eventsForSelectedDate}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectEvent={handleSelectEvent}
        />
      )}
        </>
      )}

      <NewEventDialog
        open={isNewEventDialogOpen}
        initialDate={longPressCreateDate ?? selectedDate}
        events={events}
        calendarSources={calendarSources}
        members={members}
        isSaving={isSaving}
        onClose={() => {
          setIsNewEventDialogOpen(false);
          setLongPressCreateDate(null);
        }}
        onCreate={handleCreateEvent}
      />

      <EditEventDialog
        open={selectedEvent !== null}
        event={selectedEvent}
        events={events}
        calendarSources={calendarSources}
        members={members}
        isSaving={isSaving}
        onClose={handleCloseEditDialog}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        onUpdateOccurrence={recurrenceExceptions.modifyOccurrence}
        onDeleteOccurrence={recurrenceExceptions.cancelOccurrence}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={
          snackbar.showUndo
            ? 6000
            : 3000
        }
        onClose={
          handleCloseSnackbar
        }
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <Alert
          severity={
            snackbar.severity
          }
          variant="filled"
          onClose={
            handleCloseSnackbar
          }
          action={
            snackbar.showUndo ? (
              <Button
                color="inherit"
                size="small"
                disabled={isSaving}
                onClick={() => {
                  void handleUndoDelete();
                }}
              >
                Fortryd
              </Button>
            ) : undefined
          }
          sx={{
            width: "100%",
            alignItems: "center",
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CalendarPage;
