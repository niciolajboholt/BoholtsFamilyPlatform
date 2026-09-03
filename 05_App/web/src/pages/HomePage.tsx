import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  AddRounded,
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
  ChevronRightRounded,
  FamilyRestroomRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";

import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Typography,
} from "@mui/material";

import { ActivityCard } from "../features/activity/ActivityCard";
import { WeeklySummaryCard } from "../features/family/WeeklySummaryCard";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import { useCalendarSources } from "../features/calendar/hooks/useCalendarSources";
import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { redactCalendarEventForViewer } from "../features/calendar/utils/redactCalendarEventForViewer";
import { useFamilyMembers } from "../features/calendar/hooks/useFamilyMembers";
import { useRecurrenceExceptions } from "../features/calendar/hooks/useRecurrenceExceptions";
import { familyPseudoMemberId } from "../features/calendar/models/calendarEvent";
import type { CalendarEvent } from "../features/calendar/models/calendarEvent";
import { expandRecurringEvents } from "../features/calendar/utils/expandRecurringEvents";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";
import { getInitials } from "../features/calendar/utils/getInitials";

// Hvor langt frem "Næste aftale" kigger for at finde en kommende
// forekomst — også af gentagne aftaler, som først udfoldes inden for dette
// vindue (se expandRecurringEvents).
const dashboardLookaheadDays = 14;

interface QuickAction {
  title: string;
  icon: ReactNode;
  isComingSoon: boolean;
}

const quickActions: QuickAction[] = [
  { title: "Ny aftale", icon: <AddRounded />, isComingSoon: false },
  { title: "Indkøbsliste", icon: <ShoppingCartOutlined />, isComingSoon: false },
  { title: "Opgaver", icon: <CheckCircleOutlineRounded />, isComingSoon: false },
];

function formatEventTime(value: string, allDay: boolean): string {
  if (allDay) return "Hele dagen";

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEventTimeRange(event: CalendarEvent): string {
  if (event.allDay) return "Hele dagen";

  return `${formatEventTime(event.start, false)}–${formatEventTime(event.end, false)}`;
}

function formatGreeting(hour: number): string {
  if (hour < 10) return "Godmorgen";
  if (hour < 18) return "God eftermiddag";
  return "God aften";
}

function formatRelativeDayLabel(date: Date): string {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) return "I dag";
  if (diffDays === 1) return "I morgen";

  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function HomePage() {
  const navigate = useNavigate();
  const { members } = useFamilyMembers();
  const { currentMember } = useCurrentMember();
  const { events } = useCalendarEvents();
  const { visibleCalendarSourceIds } = useCalendarSources();
  const recurrenceExceptions = useRecurrenceExceptions();

  const currentDate = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const { nextEvent, todaysEvents, remainingTodaysEvents, familyWideTodaysEvents } =
    useMemo(() => {
      const now = new Date();
      const rangeEnd = new Date(now);
      rangeEnd.setDate(rangeEnd.getDate() + dashboardLookaheadDays);

      // Kun kalendere brugeren faktisk har valgt at vise (samme "Vis
      // kalendere"-tilvalg som Kalender-siden bruger) — ellers dukker en
      // skjult/abonneret kalender (fx et arbejds- eller skoleskema) uventet
      // op på forsidens "Næste aftale"/"Resten af dagen", selvom den er
      // fravalgt i selve kalenderen.
      const visibleSourceIds = new Set(visibleCalendarSourceIds);

      const expandedEvents = expandRecurringEvents(
        events.filter((event) => visibleSourceIds.has(event.sourceId)),
        { start: now.toISOString(), end: rangeEnd.toISOString() },
        recurrenceExceptions.exceptions,
      ).map((event) => redactCalendarEventForViewer(event, currentMember?.id));

      const upcomingEvents = expandedEvents
        .filter((event) => new Date(event.end).getTime() > now.getTime())
        .sort(
          (first, second) =>
            new Date(first.start).getTime() - new Date(second.start).getTime(),
        );

      const todaysExpandedEvents = getEventsForDate(expandedEvents, now);

      return {
        nextEvent: upcomingEvents[0] ?? null,
        todaysEvents: todaysExpandedEvents,
        // Kun aftaler, der ikke allerede er overstået — "Resten af dagen"
        // skal ikke vise ting, der er sket tidligere i dag.
        remainingTodaysEvents: todaysExpandedEvents.filter(
          (event) => new Date(event.end).getTime() > now.getTime(),
        ),
        // Vises ét sted (ikke gentaget under hvert familiemedlem) — se
        // getMemberStatus, som bevidst udelader disse.
        familyWideTodaysEvents: todaysExpandedEvents.filter((event) =>
          event.ownerIds.includes(familyPseudoMemberId),
        ),
      };
    }, [currentMember?.id, events, recurrenceExceptions.exceptions, visibleCalendarSourceIds]);

  const individualMembers = members.filter(
    (member) => member.id !== familyPseudoMemberId,
  );

  // Kun medlemmets EGNE aftaler — fælles familieaftaler vises allerede samlet
  // i "Familien i dag"-blokken ovenfor og skal ikke gentages her for hvert
  // medlem (det gjorde forsiden urolig at overskue).
  function getMemberStatus(memberId: string): string {
    const memberEvent = todaysEvents.find(
      (event) =>
        event.ownerIds.includes(memberId) &&
        !event.ownerIds.includes(familyPseudoMemberId),
    );

    return memberEvent
      ? `${formatEventTime(memberEvent.start, memberEvent.allDay)} ${memberEvent.title}`
      : "Ingen personlige aftaler i dag";
  }

  const greeting = formatGreeting(new Date().getHours());

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h4">
          {currentMember ? `${greeting}, ${currentMember.name} 👋` : `${greeting} 👋`}
        </Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {todaysEvents.length > 0
            ? `Familien har ${todaysEvents.length} ${todaysEvents.length === 1 ? "aftale" : "aftaler"} i dag`
            : "Ingen aftaler i dag"}
          {" · "}
          <Box component="span" sx={{ textTransform: "capitalize" }}>
            {currentDate}
          </Box>
        </Typography>
      </Box>

      <ActivityCard />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "7fr 5fr",
          },
          gap: 2.5,
        }}
      >
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                mb: 2,
              }}
            >
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Næste aftale
                </Typography>

                <Typography variant="h5">
                  {nextEvent ? nextEvent.title : "Ingen kommende aftaler"}
                </Typography>
              </Box>

              <Avatar
                sx={{
                  bgcolor: "primary.main",
                  width: 46,
                  height: 46,
                }}
              >
                <CalendarMonthRounded />
              </Avatar>
            </Box>

            {nextEvent && (
              <>
                <Typography color="text.secondary">
                  {formatRelativeDayLabel(new Date(nextEvent.start))} ·{" "}
                  {formatEventTimeRange(nextEvent)}
                </Typography>

                {nextEvent.ownerIds.includes(familyPseudoMemberId) && (
                  <Chip
                    icon={<FamilyRestroomRounded />}
                    label="Hele familien"
                    sx={{ mt: 1.5 }}
                  />
                )}
              </>
            )}

            <Box>
              <Button
               variant="text"
                endIcon={<ChevronRightRounded />}
                onClick={() => navigate("/calendar")}
                sx={{ mt: 1, px: 0 }}
              >
                Se i kalenderen
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Resten af dagen
            </Typography>

            {remainingTodaysEvents.length === 0 ? (
              <Typography color="text.secondary">
                {todaysEvents.length === 0
                  ? "Ingen aftaler i dag."
                  : "Ikke flere aftaler i dag."}
              </Typography>
            ) : (
              remainingTodaysEvents.map((event, index) => (
                <Box
                  key={event.id}
                  sx={{ mb: index < remainingTodaysEvents.length - 1 ? 2 : 0 }}
                >
                  <Typography sx={{ fontWeight: 600 }}>
                    {formatEventTime(event.start, event.allDay)}
                  </Typography>

                  <Typography color="text.secondary">
                    {event.title}
                  </Typography>
                </Box>
              ))
            )}
          </CardContent>
        </Card>

        <Card sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2.5,
              }}
            >
              <Box>
                <Typography variant="h6">Familien i dag</Typography>

                <Typography variant="body2" color="text.secondary">
                  Fælles og personlige aftaler samlet ét sted
                </Typography>
              </Box>

              <IconButton
                aria-label="Se familien"
                onClick={() => navigate("/settings")}
              >
                <ChevronRightRounded />
              </IconButton>
            </Box>

            {familyWideTodaysEvents.length > 0 && (
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  mb: 2.5,
                }}
              >
                {familyWideTodaysEvents.map((event) => (
                  <Box
                    key={event.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: (theme) =>
                        `${theme.palette.primary.main}14`,
                    }}
                  >
                    <FamilyRestroomRounded color="primary" />

                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>
                        {formatEventTime(event.start, event.allDay)} ·{" "}
                        {event.title}
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        Hele familien
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, 1fr)",
                  sm: "repeat(4, 1fr)",
                },
                gap: 2,
              }}
            >
              {individualMembers.map((member) => (
                <Box
                  key={member.id}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 1,
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: member.color,
                      width: 52,
                      height: 52,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(member.name)}
                  </Avatar>

                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>
                      {member.name}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {getMemberStatus(member.id)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <WeeklySummaryCard />

        <Box sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Hurtige handlinger
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, 1fr)",
              },
              gap: 1.5,
            }}
          >
            {quickActions.map((action) => (
              <Button
                key={action.title}
                fullWidth
                variant="outlined"
                startIcon={action.icon}
                disabled={action.isComingSoon}
                onClick={() => {
                  if (action.title === "Ny aftale") {
                    // Sprint 29: navigerede hidtil kun til kalenderen uden
                    // at åbne opret-dialogen — state-flagget læses af
                    // CalendarPage og åbner den samme dialog, som
                    // kalenderens egen "Ny aftale"-knap bruger.
                    navigate("/calendar", { state: { openNewEventDialog: true } });
                  } else if (action.title === "Indkøbsliste") {
                    navigate("/shopping-list");
                  } else if (action.title === "Opgaver") {
                    navigate("/tasks");
                  }
                }}
                sx={{
                  justifyContent: "flex-start",
                  py: 1.5,
                  bgcolor: "background.paper",
                }}
              >
                {action.title}

                {action.isComingSoon && (
                  <Chip label="Snart" size="small" sx={{ ml: "auto" }} />
                )}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default HomePage;
