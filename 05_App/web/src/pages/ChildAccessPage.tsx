import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

import { CampaignRounded, LogoutRounded, StopRounded, VolumeUpRounded } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import {
  childLogout,
  getChildAccessLinkInfo,
  getChildCalendarEvents,
  getChildMessages,
  getChildSessionMe,
  getChildTasksForDate,
  markChildMessageRead,
  setChildTaskDone,
  verifyChildAccessPin,
  type ChildCalendarEventDto,
  type ChildMessageDto,
} from "../features/family/childAccessApi";
import { useSpeechReadout } from "../features/mitIDag/hooks/useSpeechReadout";
import { localDateKey } from "../features/mitIDag/mitIDagUtils";
import type { TaskDto } from "../features/tasks/tasksApi";

// Sprint 53 (Fase 3) + Sprint 55 (Fase A/C/D/E, se
// 01_Project_Documentation/Development/55_Sprint55_Barn_Adgang_UX_Plan.md):
// børneadgang på en helt ny, ikke-logget-ind enhed — barnets eget device.
// Uden for AppLayout (samme princip som /share/:token og /kiosk): denne
// side bruger slet ikke den almindelige users/sessions-model, kun
// child_session-cookien fra features/family/childAccessApi.ts.
//
// Kalenderaftaler dækker bevidst kun barnets eget kalendermappede
// medlem-id og familiens fælles kalender — se childAccess.ts's egen
// kommentar og planens "Fase C — afgrænsning" for hvorfor ægte
// flerpersoners deltager-matchede aftaler ikke er med i v1.

type Phase = "loading" | "pin-entry" | "dashboard" | "invalid-link";

function formatEventTime(value: string, allDay: boolean): string {
  if (allDay) {
    return "Hele dagen";
  }
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function DayTaskRow({
  task,
  onToggleDone,
}: {
  task: TaskDto;
  onToggleDone: (taskId: string, isDone: boolean) => void;
}) {
  const isDone = Boolean(task.isDone);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Checkbox
        checked={isDone}
        onChange={(event) => onToggleDone(task.id, event.target.checked)}
        slotProps={{
          input: {
            "aria-label": `${task.name}: ${isDone ? "marker som ikke færdig" : "marker som færdig"}`,
          },
        }}
      />
      <Typography
        sx={{
          fontWeight: 600,
          color: isDone ? "text.secondary" : "text.primary",
          textDecoration: isDone ? "line-through" : "none",
        }}
      >
        {task.name}
      </Typography>
    </Box>
  );
}

function DayEventRow({ event }: { event: ChildCalendarEventDto }) {
  return (
    <Box sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography sx={{ fontWeight: 600 }}>{event.title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {formatEventTime(event.start, event.allDay)}
      </Typography>
    </Box>
  );
}

// Bygger oplæsningsteksten UDELUKKENDE af data, siden allerede har hentet
// og vist — aldrig en rå kilde. Aftaler er allerede privatlivsredigeret af
// serveren (getSafeGoogleEventDetails, se childAccess.ts), så en privat
// aftales titel her er allerede "Optaget", ikke det rigtige indhold.
function buildReadoutText(
  name: string,
  tasks: TaskDto[],
  events: ChildCalendarEventDto[],
  unreadMessages: ChildMessageDto[],
): string {
  const parts = [`Hej, ${name}!`];

  if (events.length > 0) {
    parts.push("Dagens aftaler:");
    events.forEach((event) => parts.push(`${event.title} klokken ${formatEventTime(event.start, event.allDay)}.`));
  }

  const undoneTasks = tasks.filter((task) => !task.isDone);
  if (undoneTasks.length > 0) {
    parts.push("Dine opgaver i dag:");
    undoneTasks.forEach((task) => parts.push(`${task.name}.`));
  } else if (tasks.length > 0) {
    parts.push("Du har lavet alle dine opgaver i dag!");
  }

  if (unreadMessages.length > 0) {
    parts.push("Du har en besked:");
    unreadMessages.forEach((message) => parts.push(message.body));
  }

  return parts.join(" ");
}

function ChildDashboard({ name, color }: { name: string; color: string }) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [events, setEvents] = useState<ChildCalendarEventDto[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [calendarAvailable, setCalendarAvailable] = useState(true);
  const [messages, setMessages] = useState<ChildMessageDto[]>([]);
  const readout = useSpeechReadout();

  useEffect(() => {
    let isCancelled = false;
    const date = localDateKey(new Date());

    getChildTasksForDate(date).then((response) => {
      if (isCancelled) return;
      if (response.ok && response.data.tasks) {
        setTasks(response.data.tasks);
      } else {
        setTaskError("Opgaverne kunne ikke hentes.");
      }
      setIsLoadingTasks(false);
    });

    getChildCalendarEvents().then((response) => {
      if (isCancelled) return;
      setEvents(response.ok ? (response.data.events ?? []) : []);
      setCalendarAvailable(response.ok ? (response.data.calendarAvailable ?? false) : false);
      setIsLoadingEvents(false);
    });

    getChildMessages().then((response) => {
      if (!isCancelled && response.ok) {
        setMessages(response.data.messages ?? []);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleToggleDone(taskId: string, isDone: boolean) {
    // Optimistisk, samme mønster som useTasks() — føles hurtigere på en
    // enhed, der måske har et langsommere netværk end forældrenes.
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, isDone: isDone ? 1 : 0 } : task)));

    const response = await setChildTaskDone(taskId, isDone);

    if (response.ok && response.data.tasks) {
      setTasks(response.data.tasks);
    }
  }

  async function handleMarkMessageRead(messageId: string) {
    const response = await markChildMessageRead(messageId);

    if (response.ok && response.data.messages) {
      setMessages(response.data.messages);
    }
  }

  async function handleLogout() {
    readout.stop();
    await childLogout();
    window.location.reload();
  }

  const unreadMessages = messages.filter((message) => !message.readAt);

  function handleReadAloud() {
    readout.speak(buildReadoutText(name, tasks, events, unreadMessages));
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 5 } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{name.charAt(0).toUpperCase()}</Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Hej, {name}!
          </Typography>
        </Box>

        <IconButton aria-label="Log ud" onClick={() => void handleLogout()}>
          <LogoutRounded />
        </IconButton>
      </Box>

      {readout.isSupported && (
        <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
          {readout.isSpeaking ? (
            <Button variant="outlined" size="small" startIcon={<StopRounded />} onClick={() => readout.stop()}>
              Stop oplæsning
            </Button>
          ) : (
            <Button variant="outlined" size="small" startIcon={<VolumeUpRounded />} onClick={handleReadAloud}>
              Læs op
            </Button>
          )}
        </Box>
      )}

      {unreadMessages.map((message) => (
        <Alert
          key={message.id}
          severity="info"
          icon={<CampaignRounded />}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void handleMarkMessageRead(message.id)}>
              Læst
            </Button>
          }
        >
          {message.body}
        </Alert>
      ))}

      {events.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Dagens aftaler
          </Typography>
          <Box sx={{ mb: 3 }}>
            {events.map((event, index) => (
              <DayEventRow key={`${event.title}-${event.start}-${index}`} event={event} />
            ))}
          </Box>
        </>
      )}

      {!isLoadingEvents && !calendarAvailable && events.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Kalenderaftaler kunne ikke hentes lige nu. Dine opgaver vises stadig.
        </Alert>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Dine opgaver i dag
      </Typography>

      {taskError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {taskError}
        </Alert>
      )}

      {isLoadingTasks ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : tasks.length === 0 ? (
        <Typography color="text.secondary">Ingen opgaver i dag.</Typography>
      ) : (
        <Box>
          {tasks.map((task) => (
            <DayTaskRow key={task.id} task={task} onToggleDone={(id, done) => void handleToggleDone(id, done)} />
          ))}
        </Box>
      )}
    </Container>
  );
}

function PinEntry({
  name,
  color,
  onSuccess,
}: {
  name: string;
  color: string;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { token } = useParams<{ token: string }>();

  async function handleSubmit() {
    if (!/^\d{4}$/.test(pin) || !token) {
      setError("Koden skal være 4 cifre.");
      return;
    }

    setError(null);
    setIsVerifying(true);
    const response = await verifyChildAccessPin(token, pin);
    setIsVerifying(false);

    if (!response.ok) {
      setError(response.data.error ?? "Forkert kode.");
      setPin("");
      return;
    }

    onSuccess();
  }

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, sm: 10 }, textAlign: "center" }}>
      <Avatar sx={{ bgcolor: color, width: 72, height: 72, mx: "auto", mb: 2, fontSize: 28 }}>
        {name.charAt(0).toUpperCase()}
      </Avatar>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Hej, {name}! Skriv din kode.
      </Typography>

      <TextField
        label="Kode"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void handleSubmit();
          }
        }}
        type="tel"
        autoFocus
        fullWidth
        error={Boolean(error)}
        helperText={error}
        slotProps={{ htmlInput: { inputMode: "numeric", style: { textAlign: "center", letterSpacing: "0.5em", fontSize: 24 } } }}
        sx={{ mb: 3 }}
      />

      <Button variant="contained" fullWidth size="large" disabled={isVerifying} onClick={() => void handleSubmit()}>
        {isVerifying ? "Tjekker…" : "Fortsæt"}
      </Button>
    </Container>
  );
}

function ChildAccessPage() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6D597A");

  useEffect(() => {
    let isCancelled = false;

    // Et barns egen enhed har typisk allerede en gyldig child_session fra et
    // tidligere besøg (30 dages levetid, se lib/childSession.ts) — så PIN-
    // skærmen springes over, medmindre man lige er logget ud (se
    // ChildDashboard's handleLogout, som genindlæser siden bagefter).
    getChildSessionMe().then((sessionResponse) => {
      if (isCancelled) return;

      if (sessionResponse.ok && sessionResponse.data.member) {
        setName(sessionResponse.data.member.name);
        setColor(sessionResponse.data.member.color);
        setPhase("dashboard");
        return;
      }

      if (!token) {
        setPhase("invalid-link");
        return;
      }

      getChildAccessLinkInfo(token).then((linkResponse) => {
        if (isCancelled) return;

        if (!linkResponse.ok) {
          setPhase("invalid-link");
          return;
        }

        setName(linkResponse.data.name ?? "");
        setColor(linkResponse.data.color ?? "#6D597A");
        setPhase("pin-entry");
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  if (phase === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (phase === "invalid-link") {
    return (
      <Container maxWidth="xs" sx={{ py: 8, textAlign: "center" }}>
        <Alert severity="error">Linket er ugyldigt eller udløbet. Spørg en voksen om et nyt link.</Alert>
      </Container>
    );
  }

  if (phase === "pin-entry") {
    return <PinEntry name={name} color={color} onSuccess={() => setPhase("dashboard")} />;
  }

  return <ChildDashboard name={name} color={color} />;
}

export default ChildAccessPage;
