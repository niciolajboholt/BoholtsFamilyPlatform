import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from "@mui/material";

import type { CalendarView } from "../models/calendarView";
import { getWeekDays } from "../utils/getWeekDays";
import CalendarViewToggle from "./CalendarViewToggle";

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
      : formatWeek(visibleDate);

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "auto 1fr auto",
            },
            alignItems: "center",
            gap: 2,
          }}
        >
          <Button
            variant="outlined"
            onClick={onPrevious}
            aria-label={
              calendarView === "month"
                ? "Forrige måned"
                : "Forrige uge"
            }
          >
            ← Forrige
          </Button>

          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="h5"
              sx={{
                textTransform: "capitalize",
                fontWeight: 700,
              }}
            >
              {title}
            </Typography>

            <Box
              sx={{
                mt: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Button
                size="small"
                onClick={onToday}
                aria-label="Gå til i dag"
              >
                I dag
              </Button>

              <CalendarViewToggle
                value={calendarView}
                onChange={onChangeView}
              />
            </Box>
          </Box>

          <Button
            variant="outlined"
            onClick={onNext}
            aria-label={
              calendarView === "month"
                ? "Næste måned"
                : "Næste uge"
            }
          >
            Næste →
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default CalendarToolbar;
