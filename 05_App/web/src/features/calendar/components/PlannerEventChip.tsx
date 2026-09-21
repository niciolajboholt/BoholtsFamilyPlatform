import { ButtonBase, Box, Typography } from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";
import { getEventOwnerBorderSx, getEventOwnerColors } from "../utils/getEventOwnerColor";
import { getEventActionLabel } from "../utils/calendarAccessibility";
import ConflictBadge from "./ConflictBadge";
import EventSourceBadge from "./EventSourceBadge";

interface PlannerEventChipProps {
  event: CalendarEvent;
  members: readonly CalendarOwner[];
  isConflict: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
}

function formatPlannerEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start));
}

// Udtrukket fra FamilyPlannerCalendar (planlæggerens gittercelle) så
// PlannerOverflowDialog kan genbruge nøjagtig samme rendering/farvelogik/
// tilgængelighed for en aftale, i stedet for at duplikere den.
function PlannerEventChip({
  event,
  members,
  isConflict,
  onSelectEvent,
}: PlannerEventChipProps) {
  const ownerColors = getEventOwnerColors(event, members);
  const ownerColor = ownerColors[0];

  return (
    <ButtonBase
      aria-label={getEventActionLabel(event, members)}
      title={`${formatPlannerEventTime(event)} · ${event.title}`}
      onClick={() => onSelectEvent(event)}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        width: "100%",
        minWidth: 0,
        p: 0.5,
        borderRadius: 1,
        ...getEventOwnerBorderSx(ownerColors, 3),
        backgroundColor: `${ownerColor}14`,
        textAlign: "left",

        "&:hover": {
          backgroundColor: `${ownerColor}24`,
        },

        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          width: "100%",
          minWidth: 0,
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{ fontWeight: 700, minWidth: 0 }}
        >
          {formatPlannerEventTime(event)}
        </Typography>

        <EventSourceBadge source={event.source} />

        <ConflictBadge isConflict={isConflict} />
      </Box>

      {/*
        Den omgivende ButtonBase bruger bevidst alignItems: "flex-start"
        (venstrejusteret tekst) i stedet for standarden "stretch" — det
        betyder, at et flex-barn IKKE automatisk strækkes til forælderens
        bredde, og derfor ikke har noget at trunkere ("noWrap") imod: uden
        en eksplicit width her rendered titlen altid i sin fulde, uklippede
        bredde og flød visuelt ud over cellen (usynligt på desktops brede
        kolonner, men tydeligt på mobils smalle).
      */}
      <Typography
        variant="caption"
        noWrap
        sx={{ display: "block", width: "100%" }}
      >
        {event.title}
      </Typography>
    </ButtonBase>
  );
}

export default PlannerEventChip;
