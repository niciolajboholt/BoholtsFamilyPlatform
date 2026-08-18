import {
  Fragment,
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
import { findAllCalendarConflicts } from "../utils/findAllCalendarConflicts";
import { getDayKey, groupEventsByDay } from "../utils/groupEventsByDay";
import { getIsoWeekNumber } from "../utils/getIsoWeekNumber";
import {
  buildInitialWindow,
  windowReducer,
} from "../utils/plannerWindowReducer";
import { getEventActionLabel } from "../utils/calendarAccessibility";
import ConflictBadge from "./ConflictBadge";
import EventSourceBadge from "./EventSourceBadge";

interface FamilyPlannerCalendarProps {
  visibleDate: Date;
  events: CalendarEvent[];
  recurrenceExceptions: readonly RecurrenceException[];
  members: readonly CalendarOwner[];
  onSelectEvent: (event: CalendarEvent) => void;
}

// Denne visning ruller sammen med hele siden (ikke i en indre boks) for at
// navne-headeren reelt kan fastfryses mod skærmen, når man ruller.
const HEADER_ROW_HEIGHT_PX = 44;
const WEEK_BAND_HEIGHT_PX = 32;
const DATE_COLUMN_WIDTH_PX = 64;
const MEMBER_COLUMN_MIN_WIDTH_PX = 128;

// AppLayout.tsx's sticky AppBar er højere end MUI's standard Toolbar-højde
// (den har to tekstlinjer + et ikon), og dens præcise højde kan variere
// (fx et langt familienavn der ombrydes). AppLayout måler derfor selv sin
// AppBar og eksponerer den som en CSS-variabel — herunder-headeren skal
// klæbe lige under den, ikke bruge et gættet fast pixeltal (som tidligere
// gav en overlappende visning på rigtige enheder).
const APP_BAR_HEIGHT_VAR = "var(--app-bar-height, 64px)";

function getMeasuredAppBarHeight(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    "--app-bar-height",
  );
  const parsed = parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 64;
}

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

  const conflictEventIds = useMemo(
    () => findAllCalendarConflicts(expandedEvents),
    [expandedEvents],
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
  // Ruller siden (ikke en indre boks — se note ved APP_BAR_HEIGHT_VAR) og
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
        getMeasuredAppBarHeight() + HEADER_ROW_HEIGHT_PX + WEEK_BAND_HEIGHT_PX;

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
      // ruller, se note ved APP_BAR_HEIGHT_VAR.
      { root: null, rootMargin: "1000px 0px 1000px 0px" },
    );

    observer.observe(topSentinel);
    observer.observe(bottomSentinel);

    return () => observer.disconnect();
  }, []);

  const gridTemplateColumns = `${DATE_COLUMN_WIDTH_PX}px repeat(${columns.length}, minmax(${MEMBER_COLUMN_MIN_WIDTH_PX}px, 1fr))`;

  const today = new Date();

  return (
    <Card
      sx={{
        mb: 2.5,
        // MUI's Card klipper som standard sit indhold (overflow: hidden),
        // hvilket ville tvinge klæbende elementer herunder til kun at
        // fastfryse inden for selve kortets boks i stedet for mod hele
        // siden, når man ruller — se APP_BAR_HEIGHT_VAR-noten.
        overflow: "visible",
      }}
    >
      <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
        {/*
          Hele tabellen (header + alle dage) er ÉT delt CSS-grid, ikke ét
          grid pr. række — ellers udregner hver række sine "1fr"-kolonner
          uafhængigt af de andre, og selv en lille afvigelse mellem rækker
          gør de lodrette linjer forskudt/"trappede" ned igennem visningen.
          Med ét fælles grid deler alle rækker nøjagtigt de samme
          kolonnebredder.

          Gitterlinjerne selv tegnes IKKE som border på hver enkelt celle —
          det gav ekstra/fordoblede linjer på nogle enheder (formentlig en
          gengivelses-finesse ved mange celler med individuelle borders i et
          grid med brøkdels-kolonnebredder). I stedet bruges det klassiske,
          robuste "gap + baggrundsfarve"-trick: containeren har en 1px
          "gap" og selv er farvet som en streg (divider), og hver celle har
          sin egen uigennemsigtige baggrund — stregerne er dermed reelt kun
          det ene pixel mellemrum, ikke en border, og kan ikke fordobles.

          width: "fit-content" er nødvendig, fordi kolonnerne (minmax(128px,
          1fr)) kan kræve mere plads end det smalle skærmbillede har — uden
          den forbliver selve grid-boksens EGEN bredde låst til den synlige
          viewport, mens cellerne visuelt fortsætter ud over den (siden
          ruller vandret som forventet, det er kun boksens baggrund der
          ellers ville stoppe for tidligt). Da containerens baggrundsfarve
          er det, der tegner gap-linjerne, betød det at linjerne forsvandt
          efter de første par kolonner — selve fejlen brugeren så.
        */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns,
            width: "fit-content",
            gap: "1px",
            backgroundColor: "divider",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              position: "sticky",
              top: APP_BAR_HEIGHT_VAR,
              zIndex: 3,
              backgroundColor: "background.paper",
              borderBottom: "2px solid",
              borderColor: "divider",
              minHeight: HEADER_ROW_HEIGHT_PX,
            }}
          />

          {columns.map((column) => (
            <Box
              key={column.id}
              sx={{
                position: "sticky",
                top: APP_BAR_HEIGHT_VAR,
                zIndex: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 0.75,
                minWidth: 0,
                backgroundColor: "background.paper",
                borderBottom: "2px solid",
                borderColor: "divider",
                minHeight: HEADER_ROW_HEIGHT_PX,
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

          <div
            ref={topSentinelRef}
            style={{ height: 1, gridColumn: "1 / -1" }}
          />

          {weekBands.map((weekDays) => (
            <Fragment key={weekDays[0].toISOString()}>
              <Box
                sx={{
                  gridColumn: "1 / -1",
                  position: "sticky",
                  top: `calc(${APP_BAR_HEIGHT_VAR} + ${HEADER_ROW_HEIGHT_PX}px)`,
                  zIndex: 2,
                  backgroundColor: "action.hover",
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
                  <Fragment key={dayKey}>
                    <Box
                      ref={(element: HTMLDivElement | null) => {
                        if (element) {
                          dayRowRefs.current.set(dayKey, element);
                        } else {
                          dayRowRefs.current.delete(dayKey);
                        }
                      }}
                      sx={{
                        p: 0.75,
                        textAlign: "center",
                        backgroundColor: "background.paper",
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

                    {columns.map((column) => {
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
                            backgroundColor: "background.paper",
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

                                  <ConflictBadge
                                    isConflict={conflictEventIds.has(event.id)}
                                  />
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
                  </Fragment>
                );
              })}
            </Fragment>
          ))}

          <div
            ref={bottomSentinelRef}
            style={{ height: 1, gridColumn: "1 / -1" }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default FamilyPlannerCalendar;
