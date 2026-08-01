import { useEffect, useRef, useState } from "react";

import {
  Box,
  ButtonBase,
  Card,
  CardContent,
  Divider,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import { getEventOwnerColor } from "../utils/getEventOwnerColor";
import type { CalendarEvent } from "../models/calendarEvent";
import { getEventsForDate } from "../utils/getEventsForDate";
import { layoutDayTimelineEvents } from "../utils/layoutDayTimelineEvents";
import { getEventActionLabel } from "../utils/calendarAccessibility";

interface DayCalendarProps {
  selectedDate: Date;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  onSelectEvent: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT_PX = 64;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;
const TIMELINE_HEIGHT_PX = HOUR_HEIGHT_PX * HOURS_PER_DAY;
const TIME_AXIS_WIDTH_PX = 56;

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

function getMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatEventTimeRange(event: CalendarEvent): string {
  const formatter = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(event.start))}–${formatter.format(
    new Date(event.end),
  )}`;
}

function DayCalendar({
  selectedDate,
  events,
  members,
  onSelectEvent,
}: DayCalendarProps) {
  const isToday = isSameDate(selectedDate, new Date());

  const [nowMinutes, setNowMinutes] = useState(() =>
    getMinutesSinceMidnight(new Date()),
  );

  useEffect(() => {
    if (!isToday) {
      return;
    }

    const interval = setInterval(() => {
      setNowMinutes(getMinutesSinceMidnight(new Date()));
    }, 60_000);

    return () => clearInterval(interval);
  }, [isToday]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    const scrollToMinutes = isToday
      ? Math.max(0, getMinutesSinceMidnight(new Date()) - 60)
      : 7 * 60;

    scrollContainer.scrollTop =
      (scrollToMinutes / MINUTES_PER_DAY) * TIMELINE_HEIGHT_PX;
    // Skal kun genkøres når den viste dag skifter, ikke ved hvert "nu"-tik
    // (ellers ville "nu"-linjens minutlige opdatering rykke brugerens
    // scroll-position tilbage hvert minut).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const dayEvents = getEventsForDate(events, selectedDate);
  const allDayEvents = dayEvents.filter((event) => event.allDay);
  const timedEvents = dayEvents.filter((event) => !event.allDay);
  const layoutEntries = layoutDayTimelineEvents(timedEvents, selectedDate);

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        {allDayEvents.length > 0 && (
          <Box sx={{ mb: 1.5, pl: `${TIME_AXIS_WIDTH_PX}px` }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mb: 0.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Hele dagen
            </Typography>

            <Box sx={{ display: "grid", gap: 0.75 }}>
              {allDayEvents.map((event) => {
                const ownerColor = getEventOwnerColor(event, members);

                return (
                  <ButtonBase
                    key={event.id}
                    aria-label={getEventActionLabel(event)}
                    onClick={() => onSelectEvent(event)}
                    sx={{
                      justifyContent: "flex-start",
                      minWidth: 0,
                      p: 0.75,
                      borderRadius: 1,
                      borderLeft: `4px solid ${ownerColor}`,
                      backgroundColor: `${ownerColor}14`,

                      "&:hover": {
                        backgroundColor: `${ownerColor}24`,
                      },

                      "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: "primary.main",
                        outlineOffset: 1,
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ fontWeight: 600 }}
                    >
                      {event.title}
                    </Typography>
                  </ButtonBase>
                );
              })}
            </Box>

            <Divider sx={{ mt: 1.5 }} />
          </Box>
        )}

        <Box
          ref={scrollContainerRef}
          sx={{
            position: "relative",
            maxHeight: 640,
            overflowY: "auto",
          }}
        >
          <Box sx={{ position: "relative", height: TIMELINE_HEIGHT_PX }}>
            {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
              <Box
                key={hour}
                sx={{
                  position: "absolute",
                  top: hour * HOUR_HEIGHT_PX,
                  left: 0,
                  right: 0,
                  height: HOUR_HEIGHT_PX,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    position: "absolute",
                    top: 2,
                    left: 0,
                    width: TIME_AXIS_WIDTH_PX - 8,
                    textAlign: "right",
                  }}
                >
                  {formatHourLabel(hour)}
                </Typography>
              </Box>
            ))}

            {isToday && (
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  top: `${(nowMinutes / MINUTES_PER_DAY) * 100}%`,
                  left: TIME_AXIS_WIDTH_PX,
                  right: 0,
                  height: 0,
                  borderTop: "2px solid",
                  borderColor: "error.main",
                  zIndex: 2,

                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: -5,
                    top: -4,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "error.main",
                  },
                }}
              />
            )}

            <Box
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: TIME_AXIS_WIDTH_PX,
                right: 0,
              }}
            >
              {layoutEntries.map((entry) => {
                const ownerColor = getEventOwnerColor(
                  entry.event,
                  members,
                );
                const gapPx = 1;

                return (
                  <ButtonBase
                    key={entry.event.id}
                    aria-label={getEventActionLabel(entry.event)}
                    onClick={() => onSelectEvent(entry.event)}
                    sx={{
                      position: "absolute",
                      top: `${entry.topPercent}%`,
                      height: `${entry.heightPercent}%`,
                      left: `calc(${
                        (entry.columnIndex / entry.columnCount) * 100
                      }% + ${gapPx}px)`,
                      width: `calc(${
                        (1 / entry.columnCount) * 100
                      }% - ${gapPx * 2}px)`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      minWidth: 0,
                      p: 0.5,
                      overflow: "hidden",
                      borderRadius: 1,
                      borderLeft: `3px solid ${ownerColor}`,
                      backgroundColor: `${ownerColor}1c`,
                      textAlign: "left",

                      "&:hover": {
                        backgroundColor: `${ownerColor}30`,
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
                      noWrap
                      sx={{ display: "block", fontWeight: 700 }}
                    >
                      {formatEventTimeRange(entry.event)}
                    </Typography>

                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ display: "block", fontWeight: 600 }}
                    >
                      {entry.event.title}
                    </Typography>
                  </ButtonBase>
                );
              })}

              {dayEvents.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    position: "absolute",
                    top: 8 * HOUR_HEIGHT_PX,
                    left: 8,
                  }}
                >
                  Ingen aftaler denne dag
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default DayCalendar;
