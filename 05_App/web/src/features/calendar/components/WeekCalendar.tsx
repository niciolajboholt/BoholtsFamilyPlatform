import {
  Box,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import { getEventOwnerColor } from "../utils/getEventOwnerColor";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";
import { getEventsForDate } from "../utils/getEventsForDate";
import { getWeekDays } from "../utils/getWeekDays";
import {
  getDayActionLabel,
  getEventActionLabel,
} from "../utils/calendarAccessibility";
import ConflictBadge from "./ConflictBadge";

interface WeekCalendarProps {
  selectedDate: Date;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  selectedOwnerId?: CalendarOwnerId | "all";
  conflictEventIds?: ReadonlySet<string>;
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

function sortTimedEvents(
  events: CalendarEvent[],
): CalendarEvent[] {
  return [...events].sort(
    (firstEvent, secondEvent) =>
      new Date(firstEvent.start).getTime() -
      new Date(secondEvent.start).getTime(),
  );
}

interface EventCardProps {
  event: CalendarEvent;
  showTime: boolean;
  members: readonly CalendarOwner[];
  isConflict: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
}

function EventCard({
  event,
  showTime,
  members,
  isConflict,
  onSelectEvent,
}: EventCardProps) {
  const ownerColor = getEventOwnerColor(event, members);

  return (
    <ButtonBase
      aria-label={getEventActionLabel(event)}
      onClick={() => onSelectEvent(event)}
      sx={{
        position: "relative",
        zIndex: 1,
        pointerEvents: "auto",
        minWidth: 0,
        p: 0.75,
        borderRadius: 1,
        borderLeft: `4px solid ${ownerColor}`,
        backgroundColor: `${ownerColor}30`,
        cursor: "pointer",

        "&:hover": {
          backgroundColor: `${ownerColor}45`,
        },

        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      {showTime && (
        <Typography
          variant="body2"
          sx={{
            display: "block",
            fontWeight: 700,
            fontSize: "0.875rem",
          }}
        >
          {formatTime(event)}
        </Typography>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, minWidth: 0, fontSize: "0.875rem" }}
        >
          {event.title}
        </Typography>

        <ConflictBadge isConflict={isConflict} />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          mt: 0.5,
        }}
      >
        {event.ownerIds.map((ownerId) => {
          const owner = members.find(
            (candidate) => candidate.id === ownerId,
          );

          if (!owner) {
            return null;
          }

          return (
            <Chip
              key={ownerId}
              label={owner.name}
              size="small"
              sx={{
                height: 20,
                backgroundColor: owner.color,
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
    </ButtonBase>
  );
}

function WeekCalendar({
  selectedDate,
  events,
  members,
  selectedOwnerId = "all",
  conflictEventIds,
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
            const dayEvents =
              filterEventsByOwner(
                getEventsForDate(events, date),
                selectedOwnerId,
              );

            const allDayEvents =
              dayEvents.filter(
                (event) => event.allDay,
              );

            const timedEvents =
              sortTimedEvents(
                dayEvents.filter(
                  (event) => !event.allDay,
                ),
              );

            const isSelected =
              isSameDate(
                date,
                selectedDate,
              );

            const isToday =
              isSameDate(date, today);

            return (
              <Box
                key={date.toISOString()}
                sx={{
                  position: "relative",
                  pointerEvents: "none",
                  width: "100%",
                  minWidth: 0,
                  minHeight: {
                    xs: 140,
                    md: 260,
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
                  textAlign: "left",
                }}
              >
                <ButtonBase
                  aria-label={getDayActionLabel(date)}
                  onClick={() => onSelectDate(date)}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "auto",
                    borderRadius: 2,
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
                    "&:focus-visible": {
                      outline: "3px solid",
                      outlineColor: "primary.main",
                      outlineOffset: 2,
                    },
                  }}
                />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      textTransform:
                        "capitalize",
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
                      justifyContent:
                        "center",
                      backgroundColor:
                        isToday
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

                {allDayEvents.length >
                  0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "block",
                        mb: 0.5,
                        fontWeight: 700,
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.04em",
                      }}
                    >
                      Hele dagen
                    </Typography>

                    <Box
                      sx={{
                        display: "grid",
                        gap: 0.75,
                      }}
                    >
                      {allDayEvents.map(
                        (event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            showTime={false}
                            members={members}
                            isConflict={
                              conflictEventIds?.has(event.id) ?? false
                            }
                            onSelectEvent={
                              onSelectEvent
                            }
                          />
                        ),
                      )}
                    </Box>
                  </Box>
                )}

                {allDayEvents.length >
                  0 &&
                  timedEvents.length >
                    0 && (
                    <Divider
                      sx={{ mb: 1 }}
                    />
                  )}

                {timedEvents.length === 0 &&
                  allDayEvents.length ===
                    0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Ingen aftaler
                    </Typography>
                  )}

                {timedEvents.length >
                  0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "block",
                        mb: 0.5,
                        fontWeight: 700,
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.04em",
                      }}
                    >
                      Tidspunkter
                    </Typography>

                    <Box
                      sx={{
                        display: "grid",
                        gap: 0.75,
                      }}
                    >
                      {timedEvents
                        .slice(0, 3)
                        .map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            showTime
                            members={members}
                            isConflict={
                              conflictEventIds?.has(event.id) ?? false
                            }
                            onSelectEvent={
                              onSelectEvent
                            }
                          />
                        ))}

                      {timedEvents.length >
                        3 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          +
                          {timedEvents.length -
                            3}{" "}
                          flere
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

export default WeekCalendar;
