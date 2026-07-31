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

import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { useFamilyMembers } from "../features/calendar/hooks/useFamilyMembers";
import { useRecurrenceExceptions } from "../features/calendar/hooks/useRecurrenceExceptions";
import { familyPseudoMemberId } from "../features/calendar/models/calendarEvent";
import type { CalendarEvent } from "../features/calendar/models/calendarEvent";
import { expandRecurringEvents } from "../features/calendar/utils/expandRecurringEvents";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";

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
  { title: "Indkøbsliste", icon: <ShoppingCartOutlined />, isComingSoon: true },
  { title: "Opgaver", icon: <CheckCircleOutlineRounded />, isComingSoon: true },
];

function getInitials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

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
  const recurrenceExceptions = useRecurrenceExceptions();

  const currentDate = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const { nextEvent, todaysEvents } = useMemo(() => {
    const now = new Date();
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + dashboardLookaheadDays);

    const expandedEvents = expandRecurringEvents(
      events,
      { start: now.toISOString(), end: rangeEnd.toISOString() },
      recurrenceExceptions.exceptions,
    );

    const upcomingEvents = expandedEvents
      .filter((event) => new Date(event.end).getTime() > now.getTime())
      .sort(
        (first, second) =>
          new Date(first.start).getTime() - new Date(second.start).getTime(),
      );

    return {
      nextEvent: upcomingEvents[0] ?? null,
      todaysEvents: getEventsForDate(expandedEvents, now),
    };
  }, [events, recurrenceExceptions.exceptions]);

  const individualMembers = members.filter(
    (member) => member.id !== familyPseudoMemberId,
  );

  function getMemberStatus(memberId: string): string {
    const memberEvent = todaysEvents.find(
      (event) =>
        event.ownerIds.includes(memberId) ||
        event.ownerIds.includes(familyPseudoMemberId),
    );

    return memberEvent
      ? `${formatEventTime(memberEvent.start, memberEvent.allDay)} ${memberEvent.title}`
      : "Ingen aftaler i dag";
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">
          {currentMember ? `Hej ${currentMember.name} 👋` : "Hej! 👋"}
        </Typography>

        <Typography
          color="text.secondary"
          sx={{ mt: 0.5, textTransform: "capitalize" }}
        >
          {currentDate}
        </Typography>
      </Box>

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
              I dag
            </Typography>

            {todaysEvents.length === 0 ? (
              <Typography color="text.secondary">
                Ingen aftaler i dag.
              </Typography>
            ) : (
              todaysEvents.map((event, index) => (
                <Box
                  key={event.id}
                  sx={{ mb: index < todaysEvents.length - 1 ? 2 : 0 }}
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
                <Typography variant="h6">Familien</Typography>

                <Typography variant="body2" color="text.secondary">
                  Dagens planer samlet ét sted
                </Typography>
              </Box>

              <IconButton
                aria-label="Se familien"
                onClick={() => navigate("/settings")}
              >
                <ChevronRightRounded />
              </IconButton>
            </Box>

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
                    navigate("/calendar");
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
