import { useMemo, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";

import CalendarToolbar from "../features/calendar/components/CalendarToolbar";
import EventList from "../features/calendar/components/EventList";
import MonthCalendar from "../features/calendar/components/MonthCalendar";
import NewEventDialog from "../features/calendar/components/NewEventDialog";
import WeekCalendar from "../features/calendar/components/WeekCalendar";
import { calendarOwners } from "../features/calendar/data/calendarOwners";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type { CalendarOwnerId } from "../features/calendar/models/calendarEvent";
import type { CalendarView } from "../features/calendar/models/calendarView";
import type { CreateCalendarEventInput } from "../features/calendar/services/CalendarService";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";

function startOfMonth(date: Date): Date {
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
    date.getMonth() + numberOfMonths,
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

  result.setDate(result.getDate() + numberOfWeeks * 7);
  result.setHours(12, 0, 0, 0);

  return result;
}

function CalendarPage() {
  const initialDate = new Date("2026-07-27T12:00:00");

  const [selectedDate, setSelectedDate] =
    useState(initialDate);

  const [visibleDate, setVisibleDate] =
    useState(startOfMonth(initialDate));

  const [calendarView, setCalendarView] =
    useState<CalendarView>("month");

  const [selectedOwnerId, setSelectedOwnerId] =
    useState<CalendarOwnerId | "all">("all");

  const [
    isNewEventDialogOpen,
    setIsNewEventDialogOpen,
  ] = useState(false);

  const {
    events,
    isLoading,
    isSaving,
    error,
    createEvent,
  } = useCalendarEvents();

  const eventsForSelectedDate = useMemo(() => {
    const dateEvents = getEventsForDate(
      events,
      selectedDate,
    );

    if (selectedOwnerId === "all") {
      return dateEvents;
    }

    return dateEvents.filter((event) =>
      event.ownerIds.includes(selectedOwnerId),
    );
  }, [events, selectedDate, selectedOwnerId]);

  function handleSelectDate(date: Date) {
    setSelectedDate(date);

    if (calendarView === "month") {
      setVisibleDate(startOfMonth(date));
    } else {
      setVisibleDate(date);
    }
  }

  function handlePrevious() {
    setVisibleDate((currentDate) =>
      calendarView === "month"
        ? changeMonth(currentDate, -1)
        : changeWeek(currentDate, -1),
    );

    if (calendarView === "week") {
      setSelectedDate((currentDate) =>
        changeWeek(currentDate, -1),
      );
    }
  }

  function handleNext() {
    setVisibleDate((currentDate) =>
      calendarView === "month"
        ? changeMonth(currentDate, 1)
        : changeWeek(currentDate, 1),
    );

    if (calendarView === "week") {
      setSelectedDate((currentDate) =>
        changeWeek(currentDate, 1),
      );
    }
  }

  function handleToday() {
    const today = new Date();

    today.setHours(12, 0, 0, 0);

    setSelectedDate(today);

    setVisibleDate(
      calendarView === "month"
        ? startOfMonth(today)
        : today,
    );
  }

  function handleChangeView(view: CalendarView) {
    setCalendarView(view);

    setVisibleDate(
      view === "month"
        ? startOfMonth(selectedDate)
        : selectedDate,
    );
  }

  async function handleCreateEvent(
    input: CreateCalendarEventInput,
  ) {
    const createdEvent = await createEvent(input);
    const createdDate = new Date(createdEvent.start);

    createdDate.setHours(12, 0, 0, 0);

    setSelectedDate(createdDate);

    setVisibleDate(
      calendarView === "month"
        ? startOfMonth(createdDate)
        : createdDate,
    );
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
          justifyContent: "space-between",
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
            Familiens aftaler samlet ét sted.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            setIsNewEventDialogOpen(true)
          }
        >
          Ny aftale
        </Button>
      </Box>

      <CalendarToolbar
        calendarView={calendarView}
        visibleDate={visibleDate}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onChangeView={handleChangeView}
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5 }}>
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
                setSelectedOwnerId("all")
              }
              variant={
                selectedOwnerId === "all"
                  ? "filled"
                  : "outlined"
              }
              color={
                selectedOwnerId === "all"
                  ? "primary"
                  : "default"
              }
            />

            {Object.values(calendarOwners).map(
              (owner) => {
                const isSelected =
                  selectedOwnerId === owner.id;

                return (
                  <Chip
                    key={owner.id}
                    label={owner.name}
                    clickable
                    onClick={() =>
                      setSelectedOwnerId(owner.id)
                    }
                    variant={
                      isSelected
                        ? "filled"
                        : "outlined"
                    }
                    sx={{
                      borderColor: owner.color,
                      backgroundColor: isSelected
                        ? owner.color
                        : "transparent",
                      color: isSelected
                        ? "#ffffff"
                        : owner.color,
                      fontWeight: 600,

                      "&:hover": {
                        backgroundColor: isSelected
                          ? owner.color
                          : `${owner.color}18`,
                      },
                    }}
                  />
                );
              },
            )}
          </Box>
        </CardContent>
      </Card>

      {calendarView === "month" ? (
        <MonthCalendar
          visibleMonth={visibleDate}
          selectedDate={selectedDate}
          events={events}
          selectedOwnerId={selectedOwnerId}
          onSelectDate={handleSelectDate}
        />
      ) : (
        <WeekCalendar
          selectedDate={selectedDate}
          events={events}
          selectedOwnerId={selectedOwnerId}
          onSelectDate={handleSelectDate}
        />
      )}

      <EventList
        selectedDate={selectedDate}
        events={eventsForSelectedDate}
        isLoading={isLoading}
        error={error}
      />

      <NewEventDialog
        open={isNewEventDialogOpen}
        initialDate={selectedDate}
        isSaving={isSaving}
        onClose={() =>
          setIsNewEventDialogOpen(false)
        }
        onCreate={handleCreateEvent}
      />
    </Box>
  );
}

export default CalendarPage;