import { useEffect, useState } from "react";

import { CloseRounded } from "@mui/icons-material";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";
import PlannerEventChip from "./PlannerEventChip";

interface PlannerOverflowDialogProps {
  open: boolean;
  day: Date | null;
  columnLabel: string;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  conflictEventIds: ReadonlySet<string>;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

function formatDialogDate(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Åbnes fra "+N mere"-knappen i en dato×medlem-celle i FamilyPlannerCalendar
// — viser ALLE den celles aftaler (ikke kun de skjulte), så listen giver
// mening uafhængigt af hvor grænsen for direkte visning ligger. Fullscreen
// på mobil (en "bundark"-lignende oplevelse uden en separat Drawer-
// mekanik), almindeligt modal på desktop. MUI's Dialog giver Escape-luk,
// backdrop-luk, fokusfælde og fokus-retur til den knap, der åbnede den,
// uden ekstra kode her.
function PlannerOverflowDialog({
  open,
  day,
  columnLabel,
  events,
  members,
  conflictEventIds,
  onClose,
  onSelectEvent,
}: PlannerOverflowDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Familie-visningens gitter har BEVIDST vandret overflow (hele pointen
  // med visningen) — det får browserens layout-viewport (og dermed enhver
  // position:fixed-boks, herunder MUI's fuldskærms Dialog-Paper) til at
  // blive lige så BRED som gitterets fulde, urullede bredde i stedet for
  // den faktiske enhedsbredde, på trods af index.html's viewport-meta-tag.
  // document.documentElement.clientWidth er den ene måling, der konsekvent
  // forbliver korrekt uanset dette (bekræftet ved fejlsøgning) — bruges
  // derfor til eksplicit at låse Paperets bredde, så både luk-knappen og
  // selve indholdet forbliver inden for det, brugeren rent faktisk ser,
  // i stedet for at flyde ud over kanten og blive utilgængelige for tryk.
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    function updateViewportWidth() {
      setViewportWidth(document.documentElement.clientWidth);
    }

    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, [isMobile]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="xs"
      aria-labelledby="planner-overflow-dialog-title"
      // Se noten ved viewportWidth ovenfor — samme årsag som kræver en
      // eksplicit Paper-bredde gør også MUI's normale scroll-lock-baserede
      // padding-right-kompensation på <body> forkert her. Baggrunden er
      // alligevel skjult bag en fuldskærms-dialog på mobil, så scroll-lock
      // reelt intet beskytter i det tilfælde.
      disableScrollLock
      slotProps={
        isMobile && viewportWidth
          ? {
              // .MuiDialog-container (som centrerer Paperet med flexbox)
              // arver SAMME for brede layout-viewport som Paperet selv —
              // uden at låse containerens bredde ligeså ville et korrekt
              // dimensioneret Paper blot blive centreret midt i den for
              // brede container og dermed stadig forskubbet væk fra
              // skærmens venstre kant.
              container: {
                sx: { width: viewportWidth, maxWidth: viewportWidth },
              },
              paper: {
                sx: { width: viewportWidth, maxWidth: viewportWidth },
              },
            }
          : undefined
      }
    >
      {/*
        Luk-knappen er bevidst en SØSKENDE til DialogTitle, ikke et
        flex-barn inde i den — DialogTitle rendered som <h2>, og at lægge en
        <button> ind i et flex-layout i overskriften gav uforudsigelig
        hit-testing. Absolut positionering i toppen af Dialogens Paper (som
        har position: relative) er MUI's egen anbefalede opskrift til en
        luk-knap i et dialog-hjørne.
      */}
      <DialogTitle
        id="planner-overflow-dialog-title"
        sx={{ pr: 7 }}
      >
        <Typography variant="h6" component="span" sx={{ display: "block" }}>
          {columnLabel}
        </Typography>

        {day && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: "block", textTransform: "capitalize" }}
          >
            {formatDialogDate(day)}
          </Typography>
        )}
      </DialogTitle>

      <IconButton
        aria-label="Luk"
        onClick={onClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          width: 44,
          height: 44,
        }}
      >
        <CloseRounded />
      </IconButton>

      <DialogContent
        dividers
        // alignContent: "start" er nødvendig, ikke kosmetisk — uden den
        // strækker CSS Grids standardopførsel ("normal", som her svarer
        // til "stretch") hver aftale-række til at udfylde HELE den
        // resterende højde af en fuldskærms-dialog ligeligt (fx ~212px pr.
        // aftale ved 4 aftaler), i stedet for hver akkordets naturlige,
        // kompakte højde.
        sx={{ display: "grid", gap: 1, alignContent: "start" }}
      >
        {events.map((event) => (
          <PlannerEventChip
            key={event.id}
            event={event}
            members={members}
            isConflict={conflictEventIds.has(event.id)}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </DialogContent>
    </Dialog>
  );
}

export default PlannerOverflowDialog;
