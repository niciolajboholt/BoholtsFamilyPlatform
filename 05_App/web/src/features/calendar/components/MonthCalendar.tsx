import {
  Box,
  Card,
  CardContent,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";
import {
  getCalendarMonth,
  type CalendarMonthDay,
} from "../utils/getCalendarMonth";
import { getEventsForDate } from "../utils/getEventsForDate";
import DayCell from "./DayCell";

interface MonthCalendarProps {
  visibleMonth: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  selectedOwnerId?: CalendarOwnerId | "all";
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const weekdays = [
  "Man",
  "Tir",
  "Ons",
  "Tor",
  "Fre",
  "Lør",
  "Søn",
];

function isSameDate(
  firstDate: Date,
  secondDate: Date,
): boolean {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function filterEventsByOwner(
  events: CalendarEvent[],
  selectedOwnerId: CalendarOwnerId | "all",
): CalendarEvent[] {
  if (selectedOwnerId === "all") {
    return events;
  }

  return events.filter((event) =>
    event.ownerIds.includes(selectedOwnerId),
  );
}

function MonthCalendar({
  visibleMonth,
  selectedDate,
  events,
  members,
  selectedOwnerId = "all",
  onSelectDate,
  onSelectEvent,
}: MonthCalendarProps) {
  const calendarDays =
    getCalendarMonth(visibleMonth);

  const today = new Date();

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent
        sx={{
          p: {
            xs: 1,
            sm: 2,
          },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns:
              "repeat(7, minmax(0, 1fr))",
            gap: {
              xs: 0.5,
              sm: 0.75,
            },
            mb: 0.75,
          }}
        >
          {weekdays.map((weekday) => (
            <Box
              key={weekday}
              sx={{
                py: 0.75,
                textAlign: "center",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700 }}
              >
                {weekday}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns:
              "repeat(7, minmax(0, 1fr))",
            gap: {
              xs: 0.5,
              sm: 0.75,
            },
          }}
        >
          {calendarDays.map(
            ({
              date,
              isCurrentMonth,
            }: CalendarMonthDay) => {
              const dateEvents =
                filterEventsByOwner(
                  getEventsForDate(
                    events,
                    date,
                  ),
                  selectedOwnerId,
                );

              return (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  events={dateEvents}
                  members={members}
                  isCurrentMonth={
                    isCurrentMonth
                  }
                  isSelected={isSameDate(
                    date,
                    selectedDate,
                  )}
                  isToday={isSameDate(
                    date,
                    today,
                  )}
                  onSelect={onSelectDate}
                  onSelectEvent={
                    onSelectEvent
                  }
                />
              );
            },
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default MonthCalendar;
