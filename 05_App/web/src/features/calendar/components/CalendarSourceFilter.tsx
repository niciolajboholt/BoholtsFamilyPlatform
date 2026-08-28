import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Typography,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import { getCalendarSourceDisplayColors } from "../utils/getEventOwnerColor";

interface CalendarSourceFilterProps {
  calendarSources: CalendarSource[];
  visibleCalendarSourceIds: string[];
  events?: readonly CalendarEvent[];
  members?: readonly CalendarOwner[];
  isLoading: boolean;
  error: string | null;
  onToggle: (sourceId: string) => void;
  onShowAll: () => void;
  onRetry: () => void;
}

export function CalendarSourceFilter({
  calendarSources,
  visibleCalendarSourceIds,
  events = [],
  members = [],
  isLoading,
  error,
  onToggle,
  onShowAll,
  onRetry,
}: CalendarSourceFilterProps) {
  if (isLoading && calendarSources.length === 0) {
    return (
      <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2">Indlæser kalendere…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Prøv igen
          </Button>
        }
      >
        Kalenderkilder kunne ikke indlæses.
      </Alert>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Vis kalendere
        </Typography>
        <Button size="small" onClick={onShowAll}>
          Vis alle
        </Button>
      </Box>

      <FormGroup row sx={{ gap: { xs: 0, sm: 1 } }}>
        {calendarSources.map((source) => {
          const checked = visibleCalendarSourceIds.includes(source.id);
          const displayColors = getCalendarSourceDisplayColors(
            source.id,
            source.color,
            events,
            members,
          );
          const primaryColor = displayColors[0];

          return (
            <FormControlLabel
              key={source.id}
              sx={{ mr: 1 }}
              control={
                <Checkbox
                  checked={checked}
                  onChange={() => onToggle(source.id)}
                  sx={{
                    color: primaryColor,
                    "&.Mui-checked": { color: primaryColor },
                  }}
                />
              }
              label={
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                  <Typography component="span">{source.name}</Typography>
                  <Box
                    component="span"
                    aria-label={`Aftalefarver: ${displayColors.join(", ")}`}
                    sx={{ display: "inline-flex", gap: 0.35 }}
                  >
                    {displayColors.slice(0, 4).map((color) => (
                      <Box
                        component="span"
                        key={color}
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: color,
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              }
            />
          );
        })}
      </FormGroup>
    </>
  );
}
