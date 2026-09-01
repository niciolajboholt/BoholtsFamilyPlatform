import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { setEventReminder } from "../eventReminders/eventReminderApi";
import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import type { CalendarView } from "../models/calendarView";
import {
  changeDay,
  changeMonth,
  changeWeek,
  getDefaultCalendarView,
  getTodayCalendarDate,
  getVisibleRange,
  startOfMonth,
} from "../utils/calendarPageDateNavigation";
import { expandRecurringEvents } from "../utils/expandRecurringEvents";
import { findAllCalendarConflicts } from "../utils/findAllCalendarConflicts";
import { getEventsForDate } from "../utils/getEventsForDate";
import { redactCalendarEventForViewer } from "../utils/redactCalendarEventForViewer";
import { useCalendarEvents } from "./useCalendarEvents";
import { useCalendarSources } from "./useCalendarSources";
import { useCurrentMember } from "./useCurrentMember";
import { useFamilyId } from "./useFamilyId";
import { useFamilyMembers } from "./useFamilyMembers";
import { useGoogleCalendarConnection } from "./useGoogleCalendarConnection";
import { useOutlookCalendarConnection } from "./useOutlookCalendarConnection";
import { useRecurrenceExceptions } from "./useRecurrenceExceptions";
import { useSwipeNavigation } from "./useSwipeNavigation";

export type SnackbarSeverity =
  | "success"
  | "error";

export interface SnackbarState {
  open: boolean;
  severity: SnackbarSeverity;
  message: string;
  showUndo: boolean;
}

// Al ikke-visuel tilstand og logik for CalendarPage samlet ét sted, så selve
// siden kan koncentrere sig om at koordinere komponenter. Ren udflytning fra
// CalendarPage.tsx — ingen adfærdsændring.
export function useCalendarPageController() {
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
  const { currentMember } = useCurrentMember();

  // Kun brugt til aftale-påmindelser (Sprint 31) — resten af kalenderen
  // scopes sig selv via sessionen alene, se useFamilyId's egen kommentar.
  const familyId = useFamilyId();

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

  const viewerEvents = useMemo(
    () =>
      events.map((event) =>
        redactCalendarEventForViewer(event, currentMember?.id),
      ),
    [currentMember?.id, events],
  );

  const expandedEvents = useMemo(
    () =>
      expandRecurringEvents(
        viewerEvents,
        visibleRange,
        recurrenceExceptions.exceptions,
      ),
    [viewerEvents, visibleRange, recurrenceExceptions.exceptions],
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

      return viewerEvents.filter((event) =>
        visibleSourceIds.has(event.sourceId),
      );
    }, [viewerEvents, visibleCalendarSourceIds]);

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
    reminderOffsetMinutes: number | null,
  ) {
    try {
      const createdEvent =
        await createEvent(input);

      if (reminderOffsetMinutes !== null && familyId) {
        // Et nyoprettet event har intet id at knytte en påmindelse til, før
        // createEvent selv er lykkedes (se NewEventDialog) — en fejlet
        // påmindelse her må ikke vælte selve aftale-oprettelsen, som
        // allerede er gennemført.
        setEventReminder(familyId, createdEvent.id, reminderOffsetMinutes).catch(() => undefined);
      }

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
    sourceId?: string,
  ) {
    const eventToDelete =
      events.find(
        (event) =>
          event.id === eventId,
      );

    const selectedEventToDelete = eventToDelete ?? selectedEvent;

    if (!selectedEventToDelete) {
      showSnackbar(
        "error",
        "Aftalen kunne ikke findes.",
      );

      return;
    }

    try {
      await deleteEvent(eventId, sourceId ?? selectedEventToDelete.sourceId);

      setDeletedEvent(
        selectedEventToDelete,
      );

      setSelectedEvent(null);

      showSnackbar(
        "success",
        "Aftalen blev slettet.",
        selectedEventToDelete.source === "internal",
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

  return {
    selectedDate,
    calendarView,
    visibleDate,
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
    longPressCreateDate,
    setLongPressCreateDate,
    handleLongPressCreate,
    selectedEvent,
    snackbar,
    events,
    hasLoadedEvents,
    isLoading,
    isSaving,
    error,
    providerHealth,
    calendarSources,
    visibleCalendarSourceIds,
    isLoadingCalendarSources,
    calendarSourcesError,
    toggleCalendarSource,
    showAllCalendarSources,
    refreshCalendarSources,
    refreshEvents,
    members,
    recurrenceExceptions,
    isGoogleCalendarStatusLoading,
    isGoogleCalendarConnected,
    isOutlookCalendarConfigured,
    outlookCalendarConfigurationError,
    isOutlookCalendarConnected,
    wasOutlookCalendarEverConnected,
    isAttemptingOutlookSilentReconnect,
    connectedProviderLabels,
    isInitialLoading,
    isInitialSourceLoading,
    isRefreshing,
    viewerEvents,
    visibleEvents,
    conflictEventIds,
    sourceFilteredRawEvents,
    eventsForSelectedDate,
    swipeNavigation,
    handleCloseSnackbar,
    handleSelectDate,
    handleOpenDayFromWeek,
    handlePrevious,
    handleNext,
    handleToday,
    handleChangeView,
    handleCreateEvent,
    handleSelectEvent,
    handleCloseEditDialog,
    handleUpdateEvent,
    handleDeleteEvent,
    handleUndoDelete,
  };
}
