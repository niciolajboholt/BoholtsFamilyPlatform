import { useState } from "react";

import { Box, Card, CardContent, TextField, Typography } from "@mui/material";

import type { MealPlanDay } from "../hooks/useMealPlan";

interface MealPlanWeekGridProps {
  days: MealPlanDay[];
  onSetDish: (date: string, dishName: string) => void;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("da-DK", { weekday: "long" }).format(date);
  const dayMonth = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayMonth}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function DayRow({ day, onSetDish }: { day: MealPlanDay; onSetDish: (date: string, dishName: string) => void }) {
  const [value, setValue] = useState(day.dishName);

  function commit(): void {
    if (value.trim() !== day.dishName) {
      onSetDish(day.date, value);
    }
  }

  return (
    <Card variant={isToday(day.date) ? "elevation" : "outlined"} sx={{ mb: 1.5 }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5 }}>
        <Typography sx={{ width: 120, flexShrink: 0, fontWeight: isToday(day.date) ? 600 : 400 }}>
          {formatDayLabel(day.date)}
        </Typography>

        <TextField
          fullWidth
          size="small"
          placeholder="Ingen ret planlagt"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

export function MealPlanWeekGrid({ days, onSetDish }: MealPlanWeekGridProps) {
  return (
    <Box>
      {days.map((day) => (
        <DayRow key={day.date} day={day} onSetDish={onSetDish} />
      ))}
    </Box>
  );
}
