import { useEffect, useMemo, useState } from "react";

import {
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import { Avatar, Box, CircularProgress, Divider, Typography } from "@mui/material";

import { useSession } from "../features/auth/hooks/useSession";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import { useCalendarSources } from "../features/calendar/hooks/useCalendarSources";
import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { useRecurrenceExceptions } from "../features/calendar/hooks/useRecurrenceExceptions";
import { expandRecurringEvents } from "../features/calendar/utils/expandRecurringEvents";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";
import { redactCalendarEventForViewer } from "../features/calendar/utils/redactCalendarEventForViewer";
import type { FamilyMemberDto } from "../features/family/familyApi";
import { getMyFamily } from "../features/family/familyApi";
import { useShoppingList } from "../features/shoppingList/hooks/useShoppingList";
import { useTasks } from "../features/tasks/hooks/useTasks";
import LoginPage from "./LoginPage";

// Sprint 43: fastmonteret køkkenskærm-visning — dagens aftaler, ufuldførte
// opgaver og indkøbslistens ikke-afkrydsede varer, skrivebeskyttet (se
// 43_Sprint43_Kiosk_Dashboard_Plan.md). Ingen af hooksne nedenfor
// (useCalendarEvents/useTasks/useShoppingList) har selv en polling-
// mekanisme — i stedet remountes hele KioskContent med jævne mellemrum via
// en skiftende `key`, hvilket får deres eksisterende mount-effekter til at
// hente frisk data, uden at ændre nogen af de tre hooks.
const refreshIntervalMs = 2 * 60 * 1000;

function formatEventTime(value: string, allDay: boolean): string {
  if (allDay) {
    return "Hele dagen";
  }
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function KioskSectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
      <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>{icon}</Avatar>
      <Typography variant="h4">{title}</Typography>
    </Box>
  );
}

function KioskContent() {
  // Hentes direkte fra serveren her, IKKE via calendar-featurets
  // useFamilyMembers()/localStorage-cache: den cache fyldes kun af
  // AppLayouts egen mount-effekt (syncFamilyMembersFromServer), som aldrig
  // kører for /kiosk, da siden bevidst ligger uden for AppLayout. En
  // fastmonteret skærm, der ALDRIG besøger en anden side i appen, ville
  // ellers permanent vise tomme/generiske medlemsnavne — samme begrundelse
  // som BirthdaysSection.tsx og SharedExpensesSection.tsx fra tidligere
  // sprints.
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const { currentMember } = useCurrentMember();
  const { events } = useCalendarEvents();
  const { visibleCalendarSourceIds } = useCalendarSources();
  const recurrenceExceptions = useRecurrenceExceptions();
  const { tasks } = useTasks();
  const { items: shoppingItems } = useShoppingList();

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.members) {
        setMembers(result.data.members);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const todaysEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const visibleSourceIds = new Set(visibleCalendarSourceIds);

    const expandedEvents = expandRecurringEvents(
      events.filter((event) => visibleSourceIds.has(event.sourceId)),
      { start: startOfToday.toISOString(), end: startOfTomorrow.toISOString() },
      recurrenceExceptions.exceptions,
    ).map((event) => redactCalendarEventForViewer(event, currentMember?.id));

    return getEventsForDate(expandedEvents, now);
  }, [events, visibleCalendarSourceIds, recurrenceExceptions.exceptions, currentMember?.id]);

  const undoneTasks = tasks.filter((task) => !task.isDone);
  const uncheckedItems = shoppingItems.filter((item) => !item.isChecked);

  function memberName(memberId: string | null): string | null {
    if (!memberId) {
      return null;
    }
    return members.find((member) => member.id === memberId)?.name ?? null;
  }

  const now = new Date();
  const currentDate = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const currentTime = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(now);

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 3, sm: 5 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 4 }}>
        <Typography variant="h3" sx={{ textTransform: "capitalize" }}>
          {currentDate}
        </Typography>
        <Typography variant="h3" color="text.secondary">
          {currentTime}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
          gap: 4,
        }}
      >
        <Box>
          <KioskSectionHeading icon={<CalendarMonthRounded fontSize="large" />} title="I dag" />
          {todaysEvents.length === 0 ? (
            <Typography variant="h6" color="text.secondary">
              Ingen aftaler i dag.
            </Typography>
          ) : (
            todaysEvents.map((event, index) => (
              <Box key={event.id}>
                <Box sx={{ py: 1.5 }}>
                  <Typography variant="h6">{event.title}</Typography>
                  <Typography variant="body1" color="text.secondary">
                    {formatEventTime(event.start, event.allDay)}
                  </Typography>
                </Box>
                {index < todaysEvents.length - 1 && <Divider />}
              </Box>
            ))
          )}
        </Box>

        <Box>
          <KioskSectionHeading icon={<CheckCircleOutlineRounded fontSize="large" />} title="Opgaver" />
          {undoneTasks.length === 0 ? (
            <Typography variant="h6" color="text.secondary">
              Ingen ufuldførte opgaver.
            </Typography>
          ) : (
            undoneTasks.map((task, index) => (
              <Box key={task.id}>
                <Box sx={{ py: 1.5 }}>
                  <Typography variant="h6">{task.name}</Typography>
                  {memberName(task.assignedMemberId) && (
                    <Typography variant="body1" color="text.secondary">
                      {memberName(task.assignedMemberId)}
                    </Typography>
                  )}
                </Box>
                {index < undoneTasks.length - 1 && <Divider />}
              </Box>
            ))
          )}
        </Box>

        <Box>
          <KioskSectionHeading icon={<ShoppingCartOutlined fontSize="large" />} title="Indkøb" />
          {uncheckedItems.length === 0 ? (
            <Typography variant="h6" color="text.secondary">
              Indkøbslisten er tom.
            </Typography>
          ) : (
            uncheckedItems.map((item, index) => (
              <Box key={item.id}>
                <Box sx={{ py: 1.5 }}>
                  <Typography variant="h6">{item.name}</Typography>
                </Box>
                {index < uncheckedItems.length - 1 && <Divider />}
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

function KioskPage() {
  const { user, isLoading } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => setRefreshKey((key) => key + 1), refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Kiosk-visningen forbliver bag login (i modsætning til /share/:token) —
  // en delt køkkenskærm er antaget allerede logget ind permanent, se
  // plandokumentets kendte risici om session-levetid.
  if (!user) {
    return <LoginPage />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <KioskContent key={refreshKey} />
    </Box>
  );
}

export default KioskPage;
