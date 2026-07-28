import {
  Alert,
  Box,
  Typography,
} from "@mui/material";

import { isSameCalendarDate } from "../form/eventFormDateUtils";
import type { CalendarEvent } from "../models/calendarEvent";

interface EventConflictAlertProps {
  conflicts: CalendarEvent[];
  continuationText: string;
}

function formatConflictTime(
  event: CalendarEvent,
): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  const dateFormatter =
    new Intl.DateTimeFormat(
      "da-DK",
      {
        day: "numeric",
        month: "short",
      },
    );

  const timeFormatter =
    new Intl.DateTimeFormat(
      "da-DK",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  if (isSameCalendarDate(startDate, endDate)) {
    return `${timeFormatter.format(startDate)}–${timeFormatter.format(endDate)}`;
  }

  return `${dateFormatter.format(startDate)} ${timeFormatter.format(startDate)} – ${dateFormatter.format(endDate)} ${timeFormatter.format(endDate)}`;
}

export function EventConflictAlert({
  conflicts,
  continuationText,
}: EventConflictAlertProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Alert severity="warning">
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
        }}
      >
        Mulig kalenderkonflikt
      </Typography>

      <Typography
        variant="body2"
        sx={{ mt: 0.5 }}
      >
        Aftalen overlapper med:
      </Typography>

      <Box
        component="ul"
        sx={{
          mt: 0.75,
          mb: 0,
          pl: 2.5,
        }}
      >
        {conflicts.map((conflict) => (
          <Typography
            key={conflict.id}
            component="li"
            variant="body2"
          >
            {formatConflictTime(conflict)}{" "}
            – {conflict.title}
          </Typography>
        ))}
      </Box>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 1,
        }}
      >
        {continuationText}
      </Typography>
    </Alert>
  );
}
