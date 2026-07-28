import {
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type { CalendarOwnerId } from "../models/calendarEvent";

interface EventParticipantsSectionProps {
  ownerIds: CalendarOwnerId[];
  disabled: boolean;
  onToggleOwner: (ownerId: CalendarOwnerId) => void;
  title: string;
  variant: "chips" | "checkboxes";
  errorText?: string | null;
}

export function EventParticipantsSection({
  ownerIds,
  disabled,
  onToggleOwner,
  title,
  variant,
  errorText,
}: EventParticipantsSectionProps) {
  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          mb: variant === "chips" ? 1 : 0.5,
        }}
      >
        {title}
      </Typography>

      {variant === "chips" ? (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          {Object.values(calendarOwners).map(
            (owner) => {
              const isSelected = ownerIds.includes(owner.id);

              return (
                <Chip
                  key={owner.id}
                  label={owner.name}
                  clickable={!disabled}
                  disabled={disabled}
                  onClick={() => onToggleOwner(owner.id)}
                  variant={
                    isSelected ? "filled" : "outlined"
                  }
                  sx={{
                    borderColor: owner.color,
                    backgroundColor: isSelected
                      ? owner.color
                      : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : owner.color,
                    fontWeight: 600,
                  }}
                />
              );
            },
          )}
        </Box>
      ) : (
        Object.values(calendarOwners).map((owner) => (
          <FormControlLabel
            key={owner.id}
            control={
              <Checkbox
                checked={ownerIds.includes(owner.id)}
                disabled={disabled}
                onChange={() => onToggleOwner(owner.id)}
              />
            }
            label={owner.name}
          />
        ))
      )}

      {errorText && (
        <Typography
          color="error"
          variant="caption"
          role="alert"
          sx={{ display: "block", mt: 0.5 }}
        >
          {errorText}
        </Typography>
      )}
    </Box>
  );
}
