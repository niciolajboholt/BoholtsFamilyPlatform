import { ToggleButton, ToggleButtonGroup } from "@mui/material";

import type { CalendarView } from "../models/calendarView";

interface CalendarViewToggleProps {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
}

function CalendarViewToggle({
  value,
  onChange,
}: CalendarViewToggleProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={(_, nextView: CalendarView | null) => {
        if (nextView) {
          onChange(nextView);
        }
      }}
      aria-label="Kalendervisning"
    >
      <ToggleButton value="month">
        Måned
      </ToggleButton>

      <ToggleButton value="week">
        Uge
      </ToggleButton>

      <ToggleButton value="day">
        Dag
      </ToggleButton>

      <ToggleButton value="planner">
        Planlægger
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

export default CalendarViewToggle;