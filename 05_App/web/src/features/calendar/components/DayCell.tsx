import { Box, ButtonBase, Typography } from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";

interface DayCellProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

function DayCell({
  date,
  events,
  isCurrentMonth,
  isSelected,
  isToday,
  onSelect,
  onSelectEvent,
}: DayCellProps) {
  const ownerIds = Array.from(
    new Set(
      events.flatMap((event) => event.ownerIds),
    ),
  ) as CalendarOwnerId[];

  function handleSelectEvent(
    event: CalendarEvent,
    mouseEvent: React.MouseEvent,
  ) {
    mouseEvent.stopPropagation();
    onSelectEvent(event);
  }

  return (
    <ButtonBase
      onClick={() => onSelect(date)}
      sx={{
        width: "100%",
        height: "100%",
        display: "block",
        textAlign: "left",
        borderRadius: 1.5,
      }}
    >
      <Box
        sx={{
          minHeight: {
            xs: 72,
            sm: 100,
          },
          height: "100%",
          p: {
            xs: 0.75,
            sm: 1,
          },
          border: "1px solid",
          borderColor: isSelected
            ? "primary.main"
            : "divider",
          borderRadius: 1.5,
          backgroundColor: isSelected
            ? "primary.50"
            : isCurrentMonth
              ? "background.paper"
              : "action.hover",
          opacity: isCurrentMonth ? 1 : 0.55,
          transition:
            "background-color 150ms, border-color 150ms",

          "&:hover": {
            backgroundColor: isSelected
              ? "primary.50"
              : "action.hover",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isToday
                ? "primary.main"
                : "transparent",
              color: isToday
                ? "primary.contrastText"
                : "text.primary",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight:
                  isToday || isSelected ? 700 : 500,
              }}
            >
              {date.getDate()}
            </Typography>
          </Box>

          {events.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: {
                  xs: "none",
                  sm: "block",
                },
              }}
            >
              {events.length}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.5,
            mt: 1,
          }}
        >
          {ownerIds.slice(0, 5).map((ownerId) => {
            const owner = calendarOwners[ownerId];

            return (
              <Box
                key={ownerId}
                title={owner.name}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: owner.color,
                }}
              />
            );
          })}
        </Box>

        {events.length > 0 && (
          <Box
            sx={{
              mt: 1,
              display: {
                xs: "none",
                md: "grid",
              },
              gap: 0.4,
            }}
          >
            {events.slice(0, 2).map((event) => {
              const firstOwnerId = event.ownerIds[0];
              const firstOwner =
                calendarOwners[firstOwnerId];

              return (
                <Box
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={(mouseEvent) =>
                    handleSelectEvent(
                      event,
                      mouseEvent,
                    )
                  }
                  onKeyDown={(keyboardEvent) => {
                    if (
                      keyboardEvent.key === "Enter" ||
                      keyboardEvent.key === " "
                    ) {
                      keyboardEvent.stopPropagation();
                      onSelectEvent(event);
                    }
                  }}
                  sx={{
                    px: 0.75,
                    py: 0.3,
                    borderRadius: 0.75,
                    backgroundColor: `${firstOwner.color}18`,
                    borderLeft: `3px solid ${firstOwner.color}`,
                    overflow: "hidden",
                    cursor: "pointer",

                    "&:hover": {
                      backgroundColor: `${firstOwner.color}28`,
                    },

                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: 1,
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      display: "block",
                      fontWeight: 600,
                    }}
                  >
                    {event.title}
                  </Typography>
                </Box>
              );
            })}

            {events.length > 2 && (
              <Typography
                variant="caption"
                color="text.secondary"
              >
                +{events.length - 2} flere
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </ButtonBase>
  );
}

export default DayCell;