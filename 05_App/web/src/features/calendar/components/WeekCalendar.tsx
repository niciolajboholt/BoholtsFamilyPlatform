import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";
import { getEventsForDate } from "../utils/getEventsForDate";
import { getWeekDays } from "../utils/getWeekDays";

interface WeekCalendarProps {
  selectedDate: Date;
  events: CalendarEvent[];
  selectedOwnerId: CalendarOwnerId | "all";
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

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

function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
  }).format(date);
}

function formatTime(event: CalendarEvent): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start));
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

function WeekCalendar({
  selectedDate,
  events,
  selectedOwnerId,
  onSelectDate,
  onSelectEvent,
}: WeekCalendarProps) {
  const weekDays = getWeekDays(selectedDate);
  const today = new Date();

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent
        sx={{
          p: {
            xs: 1.5,
            sm: 2.5,
          },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(7, minmax(0, 1fr))",
            },
            gap: 1,
          }}
        >
          {weekDays.map((date) => {
            const dayEvents = filterEventsByOwner(
              getEventsForDate(events, date),
              selectedOwnerId,
            );

            const isSelected = isSameDate(
              date,
              selectedDate,
            );

            const isToday = isSameDate(date, today);

            return (
              <Box
                key={date.toISOString()}
                component="button"
                type="button"
                onClick={() => onSelectDate(date)}
                sx={{
                  appearance: "none",
                  width: "100%",
                  minWidth: 0,
                  minHeight: {
                    xs: 100,
                    md: 220,
                  },
                  p: 1.25,
                  border: "1px solid",
                  borderColor: isSelected
                    ? "primary.main"
                    : "divider",
                  borderRadius: 2,
                  backgroundColor: isSelected
                    ? "action.selected"
                    : "background.paper",
                  color: "text.primary",
                  font: "inherit",
                  textAlign: "left",
                  cursor: "pointer",

                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      textTransform: "capitalize",
                      fontWeight: 700,
                    }}
                  >
                    {formatWeekday(date)}
                  </Typography>

                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isToday
                        ? "primary.main"
                        : "transparent",
                      color: isToday
                        ? "primary.contrastText"
                        : "text.primary",
                      fontWeight: 700,
                    }}
                  >
                    {date.getDate()}
                  </Box>
                </Box>

                {dayEvents.length === 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Ingen aftaler
                  </Typography>
                )}

                <Box
                  sx={{
                    display: "grid",
                    gap: 0.75,
                  }}
                >
                  {dayEvents.slice(0, 3).map((event) => {
                    const primaryOwner =
                      calendarOwners[event.ownerIds[0]];

                    return (
                      <Box
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        onClick={(mouseEvent) => {
                          mouseEvent.stopPropagation();
                          onSelectEvent(event);
                        }}
                        onKeyDown={(keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " "
                          ) {
                            keyboardEvent.preventDefault();
                            keyboardEvent.stopPropagation();
                            onSelectEvent(event);
                          }
                        }}
                        sx={{
                          minWidth: 0,
                          p: 0.75,
                          borderRadius: 1,
                          borderLeft: `4px solid ${primaryOwner.color}`,
                          backgroundColor: `${primaryOwner.color}14`,
                          cursor: "pointer",

                          "&:hover": {
                            backgroundColor: `${primaryOwner.color}24`,
                          },

                          "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            outlineOffset: 1,
                          },
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontWeight: 700,
                          }}
                        >
                          {formatTime(event)}
                        </Typography>

                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 600 }}
                        >
                          {event.title}
                        </Typography>

                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.5,
                            mt: 0.5,
                          }}
                        >
                          {event.ownerIds.map((ownerId) => {
                            const owner =
                              calendarOwners[ownerId];

                            return (
                              <Chip
                                key={ownerId}
                                label={owner.name}
                                size="small"
                                sx={{
                                  height: 20,
                                  backgroundColor:
                                    owner.color,
                                  color: "#ffffff",

                                  "& .MuiChip-label": {
                                    px: 0.75,
                                    fontSize: "0.65rem",
                                  },
                                }}
                              />
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}

                  {dayEvents.length > 3 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      +{dayEvents.length - 3} flere
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

export default WeekCalendar;