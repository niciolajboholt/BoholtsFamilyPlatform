import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";

import { calendarEvents } from "../features/calendar/data/calendarEvents";
import type { CalendarOwnerId } from "../features/calendar/models/calendarEvent";
import { getEventsForDate } from "../features/calendar/utils/getEventsForDate";

const ownerNames: Record<CalendarOwnerId, string> = {
  nicolaj: "Nicolaj",
  christine: "Christine",
  alfred: "Alfred",
  jens: "Jens",
  family: "Familien",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string, allDay: boolean): string {
  if (allDay) {
    return "Hele dagen";
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function changeDate(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date("2026-07-27T12:00:00"),
  );

  const eventsForSelectedDate = getEventsForDate(
    calendarEvents,
    selectedDate,
  );

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Kalender</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Familiens aftaler samlet ét sted.
        </Typography>
      </Box>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: {
                xs: "stretch",
                sm: "center",
              },
              justifyContent: "space-between",
              flexDirection: {
                xs: "column",
                sm: "row",
              },
              gap: 2,
            }}
          >
            <Button
              variant="outlined"
              onClick={() =>
                setSelectedDate((currentDate) =>
                  changeDate(currentDate, -1),
                )
              }
            >
              Forrige dag
            </Button>

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h6" sx={{ textTransform: "capitalize" }}>
                {formatDate(selectedDate)}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {eventsForSelectedDate.length} aftaler
              </Typography>
            </Box>

            <Button
              variant="outlined"
              onClick={() =>
                setSelectedDate((currentDate) =>
                  changeDate(currentDate, 1),
                )
              }
            >
              Næste dag
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: "grid", gap: 2 }}>
        {eventsForSelectedDate.length === 0 && (
          <Card>
            <CardContent sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h6">Ingen aftaler</Typography>

              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Familien har ingen registrerede aftaler denne dag.
              </Typography>
            </CardContent>
          </Card>
        )}

        {eventsForSelectedDate.map((event) => (
          <Card key={event.id}>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: {
                    xs: "flex-start",
                    sm: "center",
                  },
                  justifyContent: "space-between",
                  flexDirection: {
                    xs: "column",
                    sm: "row",
                  },
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="body2" color="primary.main">
                    {formatTime(event.start, event.allDay)}
                    {!event.allDay &&
                      ` – ${formatTime(event.end, event.allDay)}`}
                  </Typography>

                  <Typography variant="h6" sx={{ mt: 0.5 }}>
                    {event.title}
                  </Typography>

                  {event.description && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {event.description}
                    </Typography>
                  )}

                  {event.location && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.75 }}
                    >
                      {event.location}
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  {event.ownerIds.map((ownerId) => (
                    <Chip
                      key={ownerId}
                      label={ownerNames[ownerId]}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

export default CalendarPage;