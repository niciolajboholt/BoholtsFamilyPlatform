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
import {
  getEventOwnerBadges,
  getEventOwnerBorderSx,
  getEventOwnerColors,
} from "../utils/getEventOwnerColor";
import { useLongPress } from "../hooks/useLongPress";
import type { CalendarEvent } from "../models/calendarEvent";
import { getEventsForDate } from "../utils/getEventsForDate";
import { layoutDayTimelineEvents } from "../utils/layoutDayTimelineEvents";
import { getEventActionLabel } from "../utils/calendarAccessibility";
import ConflictBadge from "./ConflictBadge";
import EventOwnerBadges from "./EventOwnerBadges";

interface DayCalendarProps {
  selectedDate: Date;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  conflictEventIds?: ReadonlySet<string>;
  onSelectEvent: (event: CalendarEvent) => void;
  onLongPressCreate: (date: Date) => void;
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
  conflictEventIds,
  onSelectEvent,
  onLongPressCreate,
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

  const timelineRef = useRef<HTMLDivElement>(null);

  // Udregner det trykkede klokkeslæt ud fra Y-positionen i tidslinjen —
  // rundet til nærmeste kvarter, så det matcher hvad man rammer med
  // fingeren, ikke minuttet præcist. Klemt til [00:00, 23:45], så et tryk
  // helt i bunden aldrig ryger over i den følgende dag.
  function computeDateFromClientY(clientY: number): Date {
    const result = new Date(selectedDate);
    result.setHours(0, 0, 0, 0);

    const container = timelineRef.current;
    if (!container) {
      return result;
    }

    const offsetY = clientY - container.getBoundingClientRect().top;
    const rawMinutes = (offsetY / TIMELINE_HEIGHT_PX) * MINUTES_PER_DAY;
    const snappedMinutes = Math.round(rawMinutes / 15) * 15;
    const clampedMinutes = Math.min(
      Math.max(snappedMinutes, 0),
      MINUTES_PER_DAY - 15,
    );

    result.setMinutes(clampedMinutes);
    return result;
  }

  const longPress = useLongPress({
    onLongPress: (position) =>
      onLongPressCreate(computeDateFromClientY(position.clientY)),
  });

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
                const ownerColors = getEventOwnerColors(event, members);
                const ownerColor = ownerColors[0];
                const ownerBadges = getEventOwnerBadges(event, members);

                return (
                  <ButtonBase
                    key={event.id}
                    aria-label={getEventActionLabel(event, members)}
                    onClick={() => onSelectEvent(event)}
                    sx={{
                      position: "relative",
                      justifyContent: "flex-start",
                      minWidth: 0,
                      p: 0.75,
                      borderRadius: 1,
                      ...getEventOwnerBorderSx(ownerColors, 4),
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: 600, minWidth: 0 }}
                      >
                        {event.title}
                      </Typography>

                      <EventOwnerBadges owners={ownerBadges} sizePx={14} />

                      <ConflictBadge
                        isConflict={conflictEventIds?.has(event.id) ?? false}
                      />
                    </Box>
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
          <Box
            ref={timelineRef}
            {...longPress}
            sx={{
              position: "relative",
              height: TIMELINE_HEIGHT_PX,
              touchAction: "pan-y",
            }}
          >
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
                const ownerColors = getEventOwnerColors(
                  entry.event,
                  members,
                );
                const ownerColor = ownerColors[0];
                const ownerBadges = getEventOwnerBadges(
                  entry.event,
                  members,
                );
                const gapPx = 1;

                return (
                  <ButtonBase
                    key={entry.event.id}
                    aria-label={getEventActionLabel(entry.event, members)}
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
                      ...getEventOwnerBorderSx(ownerColors, 3),
                      backgroundColor: `${ownerColor}14`,
                      textAlign: "left",

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
                      sx={{ display: "block", fontWeight: 700, fontSize: "0.875rem" }}
                    >
                      {formatEventTimeRange(entry.event)}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ display: "block", fontWeight: 600, minWidth: 0, fontSize: "0.875rem" }}
                      >
                        {entry.event.title}
                      </Typography>

                      <EventOwnerBadges owners={ownerBadges} sizePx={14} />

                      <ConflictBadge
                        isConflict={conflictEventIds?.has(entry.event.id) ?? false}
                      />
                    </Box>
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
