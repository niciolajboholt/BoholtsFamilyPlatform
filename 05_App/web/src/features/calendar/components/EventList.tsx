import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";

interface EventListProps {
  selectedDate: Date;
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(
  value: string,
  allDay: boolean,
): string {
  if (allDay) {
    return "Hele dagen";
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function EventList({
  selectedDate,
  events,
  isLoading,
  error,
}: EventListProps) {
  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="h6"
          sx={{
            textTransform: "capitalize",
            fontWeight: 700,
          }}
        >
          {formatDate(selectedDate)}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
        >
          {events.length}{" "}
          {events.length === 1 ? "aftale" : "aftaler"}
        </Typography>
      </Box>

      {isLoading && (
        <Card>
          <CardContent
            sx={{
              p: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      {!isLoading && !error && events.length === 0 && (
        <Card>
          <CardContent
            sx={{
              p: 3,
              textAlign: "center",
            }}
          >
            <Typography variant="h6">
              Ingen aftaler
            </Typography>

            <Typography
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Familien har ingen registrerede aftaler denne dag.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && events.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gap: 2,
          }}
        >
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

interface EventCardProps {
  event: CalendarEvent;
}

function EventCard({ event }: EventCardProps) {
  const primaryOwner =
    calendarOwners[event.ownerIds[0]];

  return (
    <Card
      sx={{
        borderLeft: `5px solid ${primaryOwner.color}`,
      }}
    >
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
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: primaryOwner.color,
              }}
            >
              {formatTime(
                event.start,
                event.allDay,
              )}

              {!event.allDay &&
                ` – ${formatTime(
                  event.end,
                  event.allDay,
                )}`}
            </Typography>

            <Typography
              variant="h6"
              sx={{ mt: 0.5 }}
            >
              {event.title}
            </Typography>

            {event.description && (
              <Typography
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
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
            {event.ownerIds.map((ownerId) => {
              const owner = calendarOwners[ownerId];

              return (
                <Chip
                  key={owner.id}
                  label={owner.name}
                  size="small"
                  sx={{
                    backgroundColor: owner.color,
                    color: "#ffffff",
                    fontWeight: 600,

                    "& .MuiChip-label": {
                      color: "#ffffff",
                    },
                  }}
                />
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default EventList;