import { useMemo, useState } from "react";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";

import CalendarToolbar from "../features/calendar/components/CalendarToolbar";
import EventList from "../features/calendar/components/EventList";
import MonthCalendar from "../features/calendar/components/MonthCalendar";
import { calendarOwners } from "../features/calendar/data/calendarOwners";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type { CalendarOwnerId } from "../features/calendar/models/calendarEvent";
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

function CalendarPage() {
  const initialDate = new Date(
    "2026-07-27T12:00:00",
  );

  const [selectedDate, setSelectedDate] =
    useState(initialDate);

  const [visibleMonth, setVisibleMonth] =
    useState(startOfMonth(initialDate));

  const [selectedOwnerId, setSelectedOwnerId] =
    useState<CalendarOwnerId | "all">("all");

  const { events, isLoading, error } =
    useCalendarEvents();

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

    if (
      date.getMonth() !== visibleMonth.getMonth() ||
      date.getFullYear() !== visibleMonth.getFullYear()
    ) {
      setVisibleMonth(startOfMonth(date));
    }
  }

  function handlePreviousMonth() {
    setVisibleMonth((currentMonth) =>
      changeMonth(currentMonth, -1),
    );
  }

  function handleNextMonth() {
    setVisibleMonth((currentMonth) =>
      changeMonth(currentMonth, 1),
    );
  }

  function handleToday() {
    const today = new Date();

    today.setHours(12, 0, 0, 0);

    setSelectedDate(today);
    setVisibleMonth(startOfMonth(today));
  }

  return (
    <Box
      sx={{
        maxWidth: 1100,
        mx: "auto",
        pb: 4,
      }}
    >
      <Box sx={{ mb: 3 }}>
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

      <CalendarToolbar
        visibleMonth={visibleMonth}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
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

      <MonthCalendar
        visibleMonth={visibleMonth}
        selectedDate={selectedDate}
        events={events}
        selectedOwnerId={selectedOwnerId}
        onSelectDate={handleSelectDate}
      />

      <EventList
        selectedDate={selectedDate}
        events={eventsForSelectedDate}
        isLoading={isLoading}
        error={error}
      />
    </Box>
  );
}

export default CalendarPage;