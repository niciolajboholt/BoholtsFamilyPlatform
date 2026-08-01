import { Box } from "@mui/material";

import type { CalendarEventSource } from "../models/calendarEvent";

interface EventSourceBadgeProps {
  source: CalendarEventSource;
}

// Kun Google har en badge i dag ("internal" har ingen kilde-markør, kun
// ejer-farven som ellers). Udvides trivielt med en Outlook-variant, den dag
// Outlook genaktiveres og tilføjes til CalendarEventSource (se ADR-016).
function EventSourceBadge({ source }: EventSourceBadgeProps) {
  if (source !== "google") {
    return null;
  }

  return (
    <Box
      aria-label="Fra Google Kalender"
      title="Google Kalender"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: "50%",
        backgroundColor: "#0F9D58",
        color: "#ffffff",
        fontSize: "0.55rem",
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      G
    </Box>
  );
}

export default EventSourceBadge;
