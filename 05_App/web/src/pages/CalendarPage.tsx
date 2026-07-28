import {
  useMemo,
  useState,
} from "react";

import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Snackbar,
  Typography,
} from "@mui/material";

import CalendarToolbar from "../features/calendar/components/CalendarToolbar";
import EditEventDialog from "../features/calendar/components/EditEventDialog";
import EventList from "../features/calendar/components/EventList";
import MonthCalendar from "../features/calendar/components/MonthCalendar";
import NewEventDialog from "../features/calendar/components/NewEventDialog";
import WeekCalendar from "../features/calendar/components/WeekCalendar";
import { calendarOwners } from "../features/calendar/data/calendarOwners";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../features/calendar/models/calendarEvent";
import type { CalendarView } from "../features/calendar/models/calendarView";
import type { CreateCalendarEventInput } from "../features/calendar/services/CalendarService";
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

function CalendarPage() {
  const [
    selectedDate,
    setSelectedDate,
  ] = useState(getTodayCalendarDate);

  const [
    visibleDate,
    setVisibleDate,
  ] = useState(() =>
    startOfMonth(getTodayCalendarDate()),
  );

  const [
    calendarView,
    setCalendarView,
  ] =
    useState<CalendarView>("month");

  const [
    selectedOwnerId,
    setSelectedOwnerId,
  ] = useState<
    CalendarOwnerId | "all"
  >("all");

  const [
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
  ] = useState(false);

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
    isLoading,
    isSaving,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    restoreEvent,
  } = useCalendarEvents();

  const eventsForSelectedDate =
    useMemo(() => {
      const dateEvents =
        getEventsForDate(
          events,
          selectedDate,
        );

      if (
        selectedOwnerId === "all"
      ) {
        return dateEvents;
      }

      return dateEvents.filter(
        (event) =>
          event.ownerIds.includes(
            selectedOwnerId,
          ),
      );
    }, [
      events,
      selectedDate,
      selectedOwnerId,
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

  function handlePrevious() {
    setVisibleDate(
      (currentDate) =>
        calendarView === "month"
          ? changeMonth(
              currentDate,
              -1,
            )
          : changeWeek(
              currentDate,
              -1,
            ),
    );

    if (
      calendarView === "week"
    ) {
      setSelectedDate(
        (currentDate) =>
          changeWeek(
            currentDate,
            -1,
          ),
      );
    }
  }

  function handleNext() {
    setVisibleDate(
      (currentDate) =>
        calendarView === "month"
          ? changeMonth(
              currentDate,
              1,
            )
          : changeWeek(
              currentDate,
              1,
            ),
    );

    if (
      calendarView === "week"
    ) {
      setSelectedDate(
        (currentDate) =>
          changeWeek(
            currentDate,
            1,
          ),
      );
    }
  }

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
    } catch {
      showSnackbar(
        "error",
        "Aftalen kunne ikke opdateres.",
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
          <Typography variant="h4">
            Kalender
          </Typography>

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

      <Card sx={{ mb: 2.5 }}>
        <CardContent
          sx={{ p: 2.5 }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              mb: 1.5,
            }}
          >
            Vis kalender for
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Chip
              label="Alle"
              clickable
              onClick={() =>
                setSelectedOwnerId(
                  "all",
                )
              }
              variant={
                selectedOwnerId ===
                "all"
                  ? "filled"
                  : "outlined"
              }
              color={
                selectedOwnerId ===
                "all"
                  ? "primary"
                  : "default"
              }
            />

            {Object.values(
              calendarOwners,
            ).map((owner) => {
              const isSelected =
                selectedOwnerId ===
                owner.id;

              return (
                <Chip
                  key={owner.id}
                  label={owner.name}
                  clickable
                  onClick={() =>
                    setSelectedOwnerId(
                      owner.id,
                    )
                  }
                  variant={
                    isSelected
                      ? "filled"
                      : "outlined"
                  }
                  sx={{
                    borderColor:
                      owner.color,
                    backgroundColor:
                      isSelected
                        ? owner.color
                        : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : owner.color,
                    fontWeight: 600,

                    "&:hover": {
                      backgroundColor:
                        isSelected
                          ? owner.color
                          : `${owner.color}18`,
                    },
                  }}
                />
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {calendarView ===
      "month" ? (
        <MonthCalendar
          visibleMonth={
            visibleDate
          }
          selectedDate={
            selectedDate
          }
          events={events}
          selectedOwnerId={
            selectedOwnerId
          }
          onSelectDate={
            handleSelectDate
          }
          onSelectEvent={
            handleSelectEvent
          }
        />
      ) : (
        <WeekCalendar
          selectedDate={
            selectedDate
          }
          events={events}
          selectedOwnerId={
            selectedOwnerId
          }
          onSelectDate={
            handleSelectDate
          }
          onSelectEvent={
            handleSelectEvent
          }
        />
      )}

      <EventList
        selectedDate={
          selectedDate
        }
        events={
          eventsForSelectedDate
        }
        isLoading={isLoading}
        error={error}
        onSelectEvent={
          handleSelectEvent
        }
      />

      <NewEventDialog
        open={isNewEventDialogOpen}
        initialDate={selectedDate}
        events={events}
        isSaving={isSaving}
        onClose={() =>
          setIsNewEventDialogOpen(false)
        }
        onCreate={handleCreateEvent}
      />

      <EditEventDialog
        open={selectedEvent !== null}
        event={selectedEvent}
        events={events}
        isSaving={isSaving}
        onClose={handleCloseEditDialog}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
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
