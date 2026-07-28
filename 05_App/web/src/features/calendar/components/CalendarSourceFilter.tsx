import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, FormGroup, Typography } from "@mui/material";

import type { CalendarSource } from "../models/calendarProvider";

interface CalendarSourceFilterProps {
  calendarSources: CalendarSource[];
  visibleCalendarSourceIds: string[];
  isLoading: boolean;
  error: string | null;
  onToggle: (sourceId: string) => void;
  onShowAll: () => void;
  onRetry: () => void;
}

export function CalendarSourceFilter({ calendarSources, visibleCalendarSourceIds, isLoading, error, onToggle, onShowAll, onRetry }: CalendarSourceFilterProps) {
  if (isLoading && calendarSources.length === 0) {
    return <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}><CircularProgress size={18} /><Typography variant="body2">Indlæser kalendere…</Typography></Box>;
  }

  if (error) {
    return <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onRetry}>Prøv igen</Button>}>Kalenderkilder kunne ikke indlæses.</Alert>;
  }

  return <>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Vis kalendere</Typography>
      <Button size="small" onClick={onShowAll}>Vis alle</Button>
    </Box>
    <FormGroup row sx={{ gap: { xs: 0, sm: 1 } }}>
      {calendarSources.map((source) => {
        const checked = visibleCalendarSourceIds.includes(source.id);
        return <FormControlLabel key={source.id} sx={{ mr: 1 }} control={<Checkbox checked={checked} onChange={() => onToggle(source.id)} sx={{ color: source.color, "&.Mui-checked": { color: source.color } }} />} label={source.name} />;
      })}
    </FormGroup>
  </>;
}
