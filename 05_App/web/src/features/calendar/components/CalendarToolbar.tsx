import {
  ChevronLeftRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Typography,
} from "@mui/material";

import type { CalendarView } from "../models/calendarView";
import { getWeekDays } from "../utils/getWeekDays";
import CalendarViewToggle from "./CalendarViewToggle";

const previousLabelByView: Record<CalendarView, string> = {
  month: "Forrige måned",
  week: "Forrige uge",
  day: "Forrige dag",
  planner: "Forrige måned",
};

const nextLabelByView: Record<CalendarView, string> = {
  month: "Næste måned",
  week: "Næste uge",
  day: "Næste dag",
  planner: "Næste måned",
};

interface CalendarToolbarProps {
  calendarView: CalendarView;
  visibleDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onChangeView: (view: CalendarView) => void;
}

function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWeek(date: Date): string {
  const weekDays = getWeekDays(date);
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];

  const firstText = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
  }).format(firstDay);

  const lastText = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(lastDay);

  return `${firstText} – ${lastText}`;
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

// Planlæggeren viser et fortløbende, uendeligt rulle-vindue uden ét fast
// "synligt tidsrum" som de andre visninger — titlen viser derfor blot den
// måned, brugeren sidst navigerede til (via Frem/Tilbage/I dag), ikke
// nødvendigvis det, der er øverst i viewporten lige nu.
function formatPlanner(date: Date): string {
  return formatMonth(date);
}

function CalendarToolbar({
  calendarView,
  visibleDate,
  onPrevious,
  onNext,
  onToday,
  onChangeView,
}: CalendarToolbarProps) {
  const title =
    calendarView === "month"
      ? formatMonth(visibleDate)
      : calendarView === "week"
        ? formatWeek(visibleDate)
        : calendarView === "day"
          ? formatDay(visibleDate)
          : formatPlanner(visibleDate);

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <IconButton
            onClick={onPrevious}
            aria-label={previousLabelByView[calendarView]}
          >
            <ChevronLeftRounded />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              textTransform: "capitalize",
              fontWeight: 700,
              textAlign: "center",
              flexGrow: 1,
              minWidth: 0,
              // Ugevisningens interval ("17. aug. – 23. aug. 2026") er for
              // langt til med sikkerhed at være på én linje ved siden af
              // pileknapperne på en telefon — ombrydning er en langt bedre
              // løsning end at afkorte datoen med "…".
              fontSize: { xs: "1rem", sm: "1.25rem" },
            }}
          >
            {title}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton
              onClick={onNext}
              aria-label={nextLabelByView[calendarView]}
            >
              <ChevronRightRounded />
            </IconButton>

            <Button
              size="small"
              variant="outlined"
              onClick={onToday}
              aria-label="Gå til i dag"
            >
              I dag
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 1.5,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CalendarViewToggle
            value={calendarView}
            onChange={onChangeView}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export default CalendarToolbar;
