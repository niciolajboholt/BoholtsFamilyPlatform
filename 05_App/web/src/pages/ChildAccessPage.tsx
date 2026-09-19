import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

import { LogoutRounded } from "@mui/icons-material";
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
  getChildSessionMe,
  getChildTasksForDate,
  setChildTaskDone,
  verifyChildAccessPin,
} from "../features/family/childAccessApi";
import { localDateKey } from "../features/mitIDag/mitIDagUtils";
import type { TaskDto } from "../features/tasks/tasksApi";

// Sprint 53 (Fase 3, se
// 01_Project_Documentation/Development/53_Sprint53_Barn_Pinkode_Adgang_Plan.md):
// børneadgang på en helt ny, ikke-logget-ind enhed — barnets eget device.
// Uden for AppLayout (samme princip som /share/:token og /kiosk): denne
// side bruger slet ikke den almindelige users/sessions-model, kun
// child_session-cookien fra features/family/childAccessApi.ts.
//
// Bevidst v1-afgrænset: kun dagens opgaver, ingen kalenderaftaler (Google-
// kalenderdata hentes i dag med DEN INDLOGGEDE brugers eget OAuth-token,
// se calendar.ts — en enhed uden nogen voksen logget ind har intet token
// at hente med), og ingen billede-baseret login, kun PIN.

type Phase = "loading" | "pin-entry" | "dashboard" | "invalid-link";

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

function ChildDashboard({ name, color }: { name: string; color: string }) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);

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

  async function handleLogout() {
    await childLogout();
    window.location.reload();
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
