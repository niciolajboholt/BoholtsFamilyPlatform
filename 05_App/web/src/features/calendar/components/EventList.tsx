import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import { getEventOwnerBorderSx, getEventOwnerColors } from "../utils/getEventOwnerColor";
import type { CalendarEvent } from "../models/calendarEvent";
import ConflictBadge from "./ConflictBadge";

const unknownOwnerColor = "#607d8b";

interface EventListProps {
  selectedDate: Date;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  conflictEventIds?: ReadonlySet<string>;
  onSelectEvent: (event: CalendarEvent) => void;
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
  members,
  conflictEventIds,
  onSelectEvent,
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

      {events.length === 0 && (
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

      {events.length > 0 && (
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
              members={members}
              isConflict={conflictEventIds?.has(event.id) ?? false}
              onSelectEvent={onSelectEvent}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

interface EventCardProps {
  event: CalendarEvent;
  members: readonly CalendarOwner[];
  isConflict: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
}

function EventCard({
  event,
  members,
  isConflict,
  onSelectEvent,
}: EventCardProps) {
  const ownerColors = getEventOwnerColors(event, members);
  const sourceColor = ownerColors[0];

  return (
    <Card
      sx={{
        position: "relative",
        ...getEventOwnerBorderSx(ownerColors, 5),
      }}
    >
      <CardActionArea
        onClick={() => onSelectEvent(event)}
        aria-label={`Åbn aftalen ${event.title}`}
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
                  color: sourceColor,
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

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography
                  variant="h6"
                  sx={{ mt: 0.5 }}
                >
                  {event.title}
                </Typography>

                <ConflictBadge isConflict={isConflict} />
              </Box>

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
                const owner = members.find(
                  (candidate) => candidate.id === ownerId,
                );

                return (
                  <Chip
                    key={ownerId}
                    label={owner?.name ?? ownerId}
                    size="small"
                    sx={{
                      backgroundColor: owner?.color ?? unknownOwnerColor,
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
      </CardActionArea>
    </Card>
  );
}

export default EventList;
