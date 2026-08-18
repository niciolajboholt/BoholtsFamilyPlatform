import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from "@mui/material";

// Sprint 26: den eneste side i appen, der ikke går gennem AppLayout's
// login-gate (se AppRouter.tsx — monteret som en søskende-rute, ikke inde i
// AppLayout's <Route>). Rent skrivebeskyttet: ingen navigation til resten
// af appen, ingen opret/redigér/slet-handlinger.

interface PublicCalendarEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
  memberName: string;
  memberColor: string;
}

interface PublicCalendarResponse {
  familyName: string;
  events: PublicCalendarEvent[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PublicCalendarResponse };

function errorMessageForStatus(status: number): string {
  if (status === 404) {
    return "Linket er ugyldigt eller er blevet deaktiveret.";
  }

  if (status === 429) {
    return "For mange forespørgsler lige nu. Prøv igen om lidt.";
  }

  if (status === 503) {
    return "Kalenderen er midlertidigt utilgængelig. Prøv igen senere.";
  }

  return "Kalenderen kunne ikke indlæses.";
}

function formatDayHeading(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTimeRange(event: PublicCalendarEvent): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  const formatter = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(event.start))}–${formatter.format(new Date(event.end))}`;
}

function dayKey(event: PublicCalendarEvent): string {
  const date = new Date(event.start);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupEventsByDay(
  events: PublicCalendarEvent[],
): { key: string; date: Date; events: PublicCalendarEvent[] }[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  const groups = new Map<string, { date: Date; events: PublicCalendarEvent[] }>();

  for (const event of sorted) {
    const key = dayKey(event);
    const existing = groups.get(key);

    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, { date: new Date(event.start), events: [event] });
    }
  }

  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

function PublicSharedCalendarPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const effectiveState: LoadState = token
    ? state
    : { status: "error", message: "Linket mangler et token." };

  useEffect(() => {
    if (!token) {
      return;
    }

    let isCancelled = false;
    // Er en no-op ved første kørsel (state starter allerede som "loading"
    // ovenfor) — kun reelt nødvendigt hvis token'et ændrer sig og effekten
    // genkøres, samme mønster som useCalendarEvents.ts's refreshEvents().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });

    fetch(`/api/public/family-calendar/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (isCancelled) {
          return;
        }

        if (!response.ok) {
          setState({ status: "error", message: errorMessageForStatus(response.status) });
          return;
        }

        const data = (await response.json()) as PublicCalendarResponse;
        setState({ status: "ready", data });
      })
      .catch(() => {
        if (!isCancelled) {
          setState({ status: "error", message: "Kalenderen kunne ikke indlæses." });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Box sx={{ maxWidth: 640, mx: "auto" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          {effectiveState.status === "ready" ? effectiveState.data.familyName : "Familiens kalender"}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Delt kalendervisning — kun til at kigge på.
        </Typography>

        {effectiveState.status === "loading" && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {effectiveState.status === "error" && (
          <Alert severity="error">{effectiveState.message}</Alert>
        )}

        {effectiveState.status === "ready" && effectiveState.data.events.length === 0 && (
          <Alert severity="info">Ingen kommende aftaler.</Alert>
        )}

        {effectiveState.status === "ready" &&
          groupEventsByDay(effectiveState.data.events).map((group) => (
            <Box key={group.key} sx={{ mb: 2.5 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, textTransform: "capitalize", mb: 1 }}
              >
                {formatDayHeading(group.date)}
              </Typography>

              <Box sx={{ display: "grid", gap: 1 }}>
                {group.events.map((event, index) => (
                  <Card
                    key={`${group.key}-${index}`}
                    sx={{ borderLeft: `4px solid ${event.memberColor}` }}
                  >
                    <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: event.memberColor }}>
                        {formatTimeRange(event)} · {event.memberName}
                      </Typography>

                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {event.title}
                      </Typography>

                      {event.location && (
                        <Typography variant="body2" color="text.secondary">
                          {event.location}
                        </Typography>
                      )}

                      {event.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {event.description}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          ))}
      </Box>
    </Box>
  );
}

export default PublicSharedCalendarPage;
