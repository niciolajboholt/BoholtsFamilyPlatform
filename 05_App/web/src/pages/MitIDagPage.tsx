import { useEffect, useMemo, useState } from "react";

import { CalendarMonthRounded, ChildCareRounded, ExpandMoreRounded } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Typography,
} from "@mui/material";

import { FeatureDisabledNotice } from "../components/FeatureDisabledNotice";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import { useCalendarSources } from "../features/calendar/hooks/useCalendarSources";
import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { useRecurrenceExceptions } from "../features/calendar/hooks/useRecurrenceExceptions";
import { expandRecurringEvents } from "../features/calendar/utils/expandRecurringEvents";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";
import type { CalendarEvent } from "../features/calendar/models/calendarEvent";
import { ChildAccessAdminPanel } from "../features/family/components/ChildAccessAdminPanel";
import { getChildMessagesForMember, getMyFamily, type ChildMessageDto, type FamilyRole } from "../features/family/familyApi";
import { useEnabledFeatures } from "../features/family/hooks/useEnabledFeatures";
import {
  buildMitIDagPlan,
  getMitIDagEvents,
  getMitIDagTasks,
  localDateKey,
} from "../features/mitIDag/mitIDagUtils";
import { useTasks } from "../features/tasks/hooks/useTasks";
import type { TaskDto } from "../features/tasks/tasksApi";

// Sprint 52 (se
// 01_Project_Documentation/Development/52_Sprint52_Mit_I_Dag_Se_Som_Barn_Plan.md):
// "Mit i dag" — et dagsoverblik pr. familiemedlem, bygget oven på de
// samme kalender-/opgavehooks som KioskPage.tsx og TasksPage.tsx, ingen ny
// datamodel. Siden har sin EGEN medlemsvælger (Nicolajs designbeslutning,
// mockup-variant B) — helt uafhængig af useCurrentMember/"Min profil";
// at vælge et medlem her ændrer IKKE enhedens "aktuelle medlem".
//
// Bevidst INGEN ny sikkerhed: siden er lige så tilgængelig som resten af
// appen for enhver, der allerede er logget ind — en PIN-kodet børneadgang
// er en selvstændig, senere sprint (se plandokumentets "Beslutninger").

function formatEventTime(value: string, allDay: boolean): string {
  if (allDay) {
    return "Hele dagen";
  }
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

interface DayEventRowProps {
  event: CalendarEvent;
}

function DayEventRow({ event }: DayEventRowProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.75, borderBottom: "1px solid", borderColor: "divider" }}>
      <Avatar sx={{ bgcolor: "secondary.main", width: 40, height: 40 }}>
        <CalendarMonthRounded fontSize="small" />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{event.title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatEventTime(event.start, event.allDay)}
        </Typography>
      </Box>
    </Box>
  );
}

interface DayTaskRowProps {
  task: TaskDto;
  onToggleDone: (taskId: string, isDone: boolean) => void;
}

function DayTaskRow({ task, onToggleDone }: DayTaskRowProps) {
  const isDone = Boolean(task.isDone);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
      <Checkbox
        checked={isDone}
        onChange={(event) => onToggleDone(task.id, event.target.checked)}
        slotProps={{
          input: {
            "aria-label": `${task.name}: ${isDone ? "marker som ikke færdig" : "marker som færdig"}`,
          },
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 600,
            color: isDone ? "text.secondary" : "text.primary",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.name}
        </Typography>
        {task.timeOfDay && (
          <Typography variant="body2" color="text.secondary">
            {task.timeOfDay}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

interface MitIDagContentProps {
  now: Date;
}

function MitIDagContent({ now }: MitIDagContentProps) {
  const {
    events,
    isLoading: areCalendarEventsLoading,
    error: calendarError,
  } = useCalendarEvents();
  const { visibleCalendarSourceIds } = useCalendarSources();
  const recurrenceExceptions = useRecurrenceExceptions();
  const {
    members,
    tasks,
    toggleDone,
    isLoading: areTasksLoading,
    error: taskError,
    pendingOfflineChangeCount,
  } = useTasks();
  const { currentMember } = useCurrentMember();

  // Sprint 55 (Fase E): korte beskeder fra en voksen til det valgte
  // medlem. useTasks() eksponerer ikke familyId, så den hentes separat
  // her. Bevidst READ-ONLY her: "Se som barn" er en forhåndsvisning for
  // en forælder og må ALDRIG markere en besked som læst på barnets vegne
  // (kun barnets egen session i ChildAccessPage.tsx kan det).
  //
  // Sprint 56: samme kald henter nu også den indloggede brugers EGEN
  // rolle i familien (role) — bruges til at afgøre, om
  // børneadgangs-administrationen nedenfor skal vises. Rent klient-side
  // bekvemmelighed, ikke sikkerhed: serveren håndhæver ejer/admin på hver
  // enkelt børneadgangs-rute uafhængigt af dette (se
  // childAccessManagement.ts).
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [ownRole, setOwnRole] = useState<FamilyRole | null>(null);
  const [messages, setMessages] = useState<ChildMessageDto[]>([]);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (!isCancelled && result.ok && result.data.family) {
        setFamilyId(result.data.family.id);
        setOwnRole(result.data.role ?? null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Egen, lokal vælger-tilstand — bevidst IKKE useCurrentMember's
  // setCurrentMemberId, som også kobler medlemmet til kontoen for push
  // (se familyApi.ts's linkFamilyMemberToMe). currentMember bruges kun som
  // et fornuftigt startvalg, hvis intet er valgt endnu.
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // relation === null er reserveret til familie-pseudomedlemmet på
  // serveren (se familyMembersSync.ts's kommentar) — udelades her, da
  // "Mit i dag" er pr. person, ikke familien som helhed.
  const realMembers = useMemo(() => members.filter((member) => member.relation !== null), [members]);

  useEffect(() => {
    if (selectedMemberId) {
      return;
    }
    if (currentMember && realMembers.some((member) => member.id === currentMember.id)) {
      // currentMember og realMembers ankommer begge asynkront (afhænger af
      // useCurrentMember/useTasks's egne server-kald) — der er intet
      // synkront tilgængeligt ved mount at sætte et lazy useState-
      // startværdi ud fra, i modsætning til AccountDataSection.tsx's
      // URL-baserede tilfælde. Samme accepterede mønster som
      // useTasks.ts's flushQueuedTaskToggles-effekt.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMemberId(currentMember.id);
    } else if (realMembers.length > 0) {
      setSelectedMemberId(realMembers[0].id);
    }
  }, [selectedMemberId, currentMember, realMembers]);

  const todaysEvents = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const visibleSourceIds = new Set(visibleCalendarSourceIds);

    const expandedEvents = expandRecurringEvents(
      events.filter((event) => visibleSourceIds.has(event.sourceId)),
      { start: startOfToday.toISOString(), end: startOfTomorrow.toISOString() },
      recurrenceExceptions.exceptions,
    );

    return getEventsForDate(expandedEvents, now);
  }, [events, visibleCalendarSourceIds, recurrenceExceptions.exceptions, now]);

  const memberEvents = useMemo(() => {
    if (!selectedMemberId) {
      return [];
    }
    return getMitIDagEvents(todaysEvents, selectedMemberId, currentMember?.id);
  }, [todaysEvents, selectedMemberId, currentMember?.id]);

  const memberTasks = useMemo(
    () => (selectedMemberId ? getMitIDagTasks(tasks, selectedMemberId) : []),
    [tasks, selectedMemberId],
  );

  useEffect(() => {
    if (!familyId || !selectedMemberId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([]);
      return;
    }

    let isCancelled = false;

    getChildMessagesForMember(familyId, selectedMemberId).then((result) => {
      if (!isCancelled && result.ok) {
        setMessages(result.data.messages ?? []);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [familyId, selectedMemberId]);

  // "Næste": den først kommende aftale, ellers den første ufærdige
  // opgave — ikke et fuldt kronologisk fletning af begge (opgavers
  // timeOfDay er en fritekst-påmindelse, ikke et pålideligt sorterbart
  // klokkeslæt, se plandokumentets teststrategi-afsnit).
  const { nextEvent, nextTask, restOfDayEvents, restOfDayTasks } = useMemo(
    () => buildMitIDagPlan(memberEvents, memberTasks, now),
    [memberEvents, memberTasks, now],
  );

  const selectedMember = realMembers.find((member) => member.id === selectedMemberId) ?? null;

  const today = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  if (areCalendarEventsLoading || areTasksLoading) {
    return (
      <Box
        role="status"
        sx={{ minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}
      >
        <CircularProgress size={28} aria-hidden="true" />
        <Typography color="text.secondary">Henter dagens aktiviteter…</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 5 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {today.charAt(0).toUpperCase() + today.slice(1)}
      </Typography>

      {calendarError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Kalenderaftalerne kunne ikke hentes. Opgaver vises stadig, hvis de er tilgængelige.
        </Alert>
      )}

      {taskError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {taskError}
        </Alert>
      )}

      {pendingOfflineChangeCount > 0 && (
        <Alert severity="info" role="status" sx={{ mb: 2 }}>
          {pendingOfflineChangeCount === 1
            ? "Én afkrydsning venter på at blive synkroniseret."
            : `${pendingOfflineChangeCount} afkrydsninger venter på at blive synkroniseret.`}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 3 }}>
        {realMembers.map((member) => (
          <Chip
            key={member.id}
            clickable
            onClick={() => setSelectedMemberId(member.id)}
            aria-pressed={member.id === selectedMemberId}
            label={member.name}
            avatar={
              <Avatar sx={{ bgcolor: member.color, color: "#FFFFFF !important" }}>
                {member.name.charAt(0).toUpperCase()}
              </Avatar>
            }
            variant={member.id === selectedMemberId ? "filled" : "outlined"}
            color={member.id === selectedMemberId ? "primary" : "default"}
            sx={{ height: 44, fontSize: 15, fontWeight: 600, pl: 0.5 }}
          />
        ))}
      </Box>

      {!selectedMember ? (
        <Typography color="text.secondary">Tilføj et familiemedlem for at komme i gang.</Typography>
      ) : (
        <>
          <Typography variant="h4" sx={{ mb: 3 }}>
            {selectedMember.name}s dag
          </Typography>

          <Box
            sx={{
              bgcolor: "action.hover",
              borderRadius: 3,
              p: 3,
              mb: 4,
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 700, letterSpacing: "0.08em" }}
            >
              Næste
            </Typography>

            {nextEvent ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {nextEvent.title}
                </Typography>
                <Typography color="text.secondary">{formatEventTime(nextEvent.start, nextEvent.allDay)}</Typography>
              </>
            ) : nextTask ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {nextTask.name}
                </Typography>
                <Typography color="text.secondary">Opgave</Typography>
              </>
            ) : (
              <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
                Ingen flere aktiviteter i dag.
              </Typography>
            )}
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Resten af dagen
          </Typography>

          {restOfDayEvents.length === 0 && restOfDayTasks.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Ikke mere på programmet.
            </Typography>
          ) : (
            <Box sx={{ mb: 3 }}>
              {restOfDayEvents.map((event) => (
                <DayEventRow key={event.id} event={event} />
              ))}
              {restOfDayTasks.map((task) => (
                <DayTaskRow key={task.id} task={task} onToggleDone={toggleDone} />
              ))}
            </Box>
          )}

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Beskeder
          </Typography>

          {messages.length === 0 ? (
            <Box
              sx={{
                border: "1.5px dashed",
                borderColor: "divider",
                borderRadius: 3,
                p: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                Ingen beskeder endnu.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "grid", gap: 1 }}>
              {messages.map((message) => (
                <Alert key={message.id} severity={message.readAt ? "success" : "info"}>
                  {message.body}
                </Alert>
              ))}
            </Box>
          )}

          {familyId && (ownRole === "owner" || ownRole === "admin") && (
            <Accordion disableGutters sx={{ mt: 4 }}>
              <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ChildCareRounded color="action" fontSize="small" />
                  <Typography sx={{ fontWeight: 600 }}>Børneadgang for {selectedMember.name}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <ChildAccessAdminPanel familyId={familyId} member={selectedMember} />
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}
    </Container>
  );
}

function useLiveNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return now;
}

function MitIDagPage() {
  const { isEnabled, isLoading } = useEnabledFeatures();
  const now = useLiveNow();

  if (isLoading) {
    return null;
  }

  if (!isEnabled("mit-i-dag")) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <FeatureDisabledNotice />
      </Box>
    );
  }

  // En ny lokal dato remounter datakilderne, så useTasks() henter den nye
  // dags rutiner/opgaver i stedet for at beholde gårsdagens mount-værdi.
  return <MitIDagContent key={localDateKey(now)} now={now} />;
}

export default MitIDagPage;
