import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  Box,
  ButtonBase,
  Card,
  CardContent,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import { getEventOwnerColor } from "../utils/getEventOwnerColor";
import {
  familyPseudoMemberId,
  type CalendarEvent,
} from "../models/calendarEvent";
import type { RecurrenceException } from "../preferences/recurrenceExceptionsStorage";
import { expandRecurringEvents } from "../utils/expandRecurringEvents";
import { getDayKey, groupEventsByDay } from "../utils/groupEventsByDay";
import { getIsoWeekNumber } from "../utils/getIsoWeekNumber";
import {
  buildInitialWindow,
  windowReducer,
} from "../utils/plannerWindowReducer";
import { getEventActionLabel } from "../utils/calendarAccessibility";
import EventSourceBadge from "./EventSourceBadge";

interface FamilyPlannerCalendarProps {
  visibleDate: Date;
  events: CalendarEvent[];
  recurrenceExceptions: readonly RecurrenceException[];
  members: readonly CalendarOwner[];
  onSelectEvent: (event: CalendarEvent) => void;
}

// Denne visning ruller sammen med hele siden (ikke i en indre boks) for at
// navne-headeren reelt kan fastfryses mod skærmen, når man ruller — se
// forklaringen ved appBarOffset nedenfor for hvorfor det kræver et par
// justeringer.
const HEADER_ROW_HEIGHT_PX = 44;
const WEEK_BAND_HEIGHT_PX = 32;
const DATE_COLUMN_WIDTH_PX = 64;
const MEMBER_COLUMN_MIN_WIDTH_PX = 128;

// Matcher AppLayout.tsx's sticky AppBar (MUI's standard Toolbar-højde:
// 56px under "sm"-breakpointet, 64px derover) — headeren herunder skal
// klæbe lige under den, ikke oven i den.
const APP_BAR_HEIGHT_PX = { xs: 56, sm: 64 };

function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    12,
    0,
    0,
    0,
  );
}

function isSameDate(firstDate: Date, secondDate: Date): boolean {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", { weekday: "short" }).format(date);
}

function formatWeekBandLabel(weekStartDate: Date): string {
  const weekNumber = getIsoWeekNumber(weekStartDate);

  const monthYear = new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(weekStartDate);

  return `Uge ${weekNumber} · ${monthYear}`;
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start));
}

interface PlannerColumn {
  id: string;
  label: string;
}

function getEventsForColumn(
  dayEvents: CalendarEvent[],
  columnId: string,
): CalendarEvent[] {
  if (columnId === familyPseudoMemberId) {
    return dayEvents.filter(
      (event) =>
        event.ownerIds.includes(familyPseudoMemberId) ||
        event.ownerIds.length > 1,
    );
  }

  return dayEvents.filter((event) => event.ownerIds.includes(columnId));
}

function FamilyPlannerCalendar({
  visibleDate,
  events,
  recurrenceExceptions,
  members,
  onSelectEvent,
}: FamilyPlannerCalendarProps) {
  const individualMembers = members.filter(
    (member) => member.id !== familyPseudoMemberId,
  );

  const columns: PlannerColumn[] = [
    { id: familyPseudoMemberId, label: "Alle" },
    ...individualMembers.map((member) => ({
      id: member.id,
      label: member.name,
    })),
  ];

  const [windowRange, dispatchWindow] = useReducer(
    windowReducer,
    visibleDate,
    buildInitialWindow,
  );

  const expandedEvents = useMemo(
    () =>
      expandRecurringEvents(
        events,
        {
          start: windowRange.start.toISOString(),
          end: windowRange.end.toISOString(),
        },
        recurrenceExceptions,
      ),
    [events, windowRange, recurrenceExceptions],
  );

  const eventsByDay = useMemo(
    () => groupEventsByDay(expandedEvents),
    [expandedEvents],
  );

  const weekBands = useMemo(() => {
    const bands: Date[][] = [];
    let weekStart = new Date(windowRange.start);

    while (weekStart.getTime() < windowRange.end.getTime()) {
      bands.push(
        Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
      );
      weekStart = addDays(weekStart, 7);
    }

    return bands;
  }, [windowRange]);

  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const dayRowRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingBackwardScrollHeightRef = useRef<number | null>(null);
  const pendingScrollDateRef = useRef<Date | null>(visibleDate);

  // Ekstern navigation (Frem/Tilbage/"I dag" i værktøjslinjen) ændrer
  // visibleDate — det udløser en gen-forankring af vinduet, hvis den nye dato
  // falder uden for det aktuelt indlæste interval, og beder den følgende
  // effekt om at rulle til datoen, når dens rækkes ref findes.
  useEffect(() => {
    pendingScrollDateRef.current = visibleDate;
    dispatchWindow({ type: "reanchor", centerDate: visibleDate });
  }, [visibleDate]);

  // Kører efter hvert render og tjekker, om den ventende rulle-dato nu har
  // en synlig række (fx efter en gen-forankring har udvidet vinduet) —
  // billig opslag, rydder sig selv op så snart den er tilfredsstillet.
  // Ruller siden (ikke en indre boks — se note ved APP_BAR_HEIGHT_PX) og
  // korrigerer for de klæbende bånd (AppBar + navne-header + uge-bånd), så
  // datoens række ikke havner skjult bagved dem.
  useEffect(() => {
    const pendingDate = pendingScrollDateRef.current;

    if (!pendingDate) {
      return;
    }

    const row = dayRowRefs.current.get(getDayKey(pendingDate));

    if (row) {
      const stickyOffset =
        (window.innerWidth < 600
          ? APP_BAR_HEIGHT_PX.xs
          : APP_BAR_HEIGHT_PX.sm) +
        HEADER_ROW_HEIGHT_PX +
        WEEK_BAND_HEIGHT_PX;

      const rowTop = row.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: rowTop - stickyOffset, behavior: "auto" });
      pendingScrollDateRef.current = null;
    }
  });

  // Bevarer scroll-positionen, når der udvides bagud (nye rækker sat ind
  // foroven ville ellers rykke den synlige position ned) — kun relevant når
  // extend-backward faktisk har sat en ventende højde, ikke ved
  // gen-forankring eller extend-forward.
  useLayoutEffect(() => {
    const previousScrollHeight = pendingBackwardScrollHeightRef.current;

    if (previousScrollHeight !== null) {
      const newScrollHeight = document.documentElement.scrollHeight;
      window.scrollBy(0, newScrollHeight - previousScrollHeight);
      pendingBackwardScrollHeightRef.current = null;
    }
  }, [windowRange]);

  useEffect(() => {
    const topSentinel = topSentinelRef.current;
    const bottomSentinel = bottomSentinelRef.current;

    if (!topSentinel || !bottomSentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          if (entry.target === topSentinel) {
            pendingBackwardScrollHeightRef.current =
              document.documentElement.scrollHeight;
            dispatchWindow({ type: "extend-backward" });
          } else if (entry.target === bottomSentinel) {
            dispatchWindow({ type: "extend-forward" });
          }
        }
      },
      // root: null (browser-viewporten, ikke en indre boks) — hele siden
      // ruller, se note ved APP_BAR_HEIGHT_PX.
      { root: null, rootMargin: "1000px 0px 1000px 0px" },
    );

    observer.observe(topSentinel);
    observer.observe(bottomSentinel);

    return () => observer.disconnect();
  }, []);

  const gridTemplateColumns = `${DATE_COLUMN_WIDTH_PX}px repeat(${columns.length}, minmax(${MEMBER_COLUMN_MIN_WIDTH_PX}px, 1fr))`;
  const cellDividerBorder = { borderRight: "1px solid", borderColor: "divider" };

  const today = new Date();

  return (
    <Card
      sx={{
        mb: 2.5,
        // MUI's Card klipper som standard sit indhold (overflow: hidden),
        // hvilket ville tvinge klæbende elementer herunder til kun at
        // fastfryse inden for selve kortets boks i stedet for mod hele
        // siden, når man ruller — se APP_BAR_HEIGHT_PX-noten.
        overflow: "visible",
      }}
    >
      <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns,
              position: "sticky",
              top: APP_BAR_HEIGHT_PX,
              zIndex: 3,
              backgroundColor: "background.paper",
              borderBottom: "2px solid",
              borderColor: "divider",
              minHeight: HEADER_ROW_HEIGHT_PX,
            }}
          >
            <Box sx={cellDividerBorder} />

            {columns.map((column, index) => (
              <Box
                key={column.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 0.75,
                  minWidth: 0,
                  ...(index < columns.length - 1 ? cellDividerBorder : {}),
                }}
              >
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ fontWeight: 700 }}
                >
                  {column.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <div ref={topSentinelRef} style={{ height: 1 }} />

          {weekBands.map((weekDays) => (
            <Box key={weekDays[0].toISOString()}>
              <Box
                sx={{
                  position: "sticky",
                  top: {
                    xs: APP_BAR_HEIGHT_PX.xs + HEADER_ROW_HEIGHT_PX,
                    sm: APP_BAR_HEIGHT_PX.sm + HEADER_ROW_HEIGHT_PX,
                  },
                  zIndex: 2,
                  backgroundColor: "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  minHeight: WEEK_BAND_HEIGHT_PX,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {formatWeekBandLabel(weekDays[0])}
                </Typography>
              </Box>

              {weekDays.map((day) => {
                const dayKey = getDayKey(day);
                const dayEvents = eventsByDay.get(dayKey) ?? [];
                const isToday = isSameDate(day, today);

                return (
                  <Box
                    key={dayKey}
                    ref={(element: HTMLDivElement | null) => {
                      if (element) {
                        dayRowRefs.current.set(dayKey, element);
                      } else {
                        dayRowRefs.current.delete(dayKey);
                      }
                    }}
                    sx={{
                      display: "grid",
                      gridTemplateColumns,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box
                      sx={{
                        p: 0.75,
                        textAlign: "center",
                        ...cellDividerBorder,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          textTransform: "capitalize",
                        }}
                      >
                        {formatWeekdayShort(day)}
                      </Typography>

                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? "primary.main" : "text.primary",
                        }}
                      >
                        {day.getDate()}
                      </Typography>
                    </Box>

                    {columns.map((column, index) => {
                      const columnEvents = getEventsForColumn(
                        dayEvents,
                        column.id,
                      );

                      return (
                        <Box
                          key={column.id}
                          sx={{
                            p: 0.5,
                            minWidth: 0,
                            display: "grid",
                            gap: 0.5,
                            alignContent: "start",
                            ...(index < columns.length - 1
                              ? cellDividerBorder
                              : {}),
                          }}
                        >
                          {columnEvents.map((event) => {
                            const ownerColor = getEventOwnerColor(
                              event,
                              members,
                            );

                            return (
                              <ButtonBase
                                key={`${column.id}::${event.id}`}
                                aria-label={getEventActionLabel(event)}
                                onClick={() => onSelectEvent(event)}
                                sx={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  justifyContent: "flex-start",
                                  width: "100%",
                                  minWidth: 0,
                                  p: 0.5,
                                  borderRadius: 1,
                                  borderLeft: `3px solid ${ownerColor}`,
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
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    minWidth: 0,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    noWrap
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {formatEventTime(event)}
                                  </Typography>

                                  <EventSourceBadge source={event.source} />
                                </Box>

                                <Typography
                                  variant="caption"
                                  noWrap
                                  sx={{ display: "block" }}
                                >
                                  {event.title}
                                </Typography>
                              </ButtonBase>
                            );
                          })}
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          ))}

          <div ref={bottomSentinelRef} style={{ height: 1 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

export default FamilyPlannerCalendar;
