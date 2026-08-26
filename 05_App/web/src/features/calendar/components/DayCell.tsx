import {
  Box,
  ButtonBase,
  Chip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CalendarOwner } from "../data/calendarOwners";
import { getEventOwnerColor } from "../utils/getEventOwnerColor";
import { useLongPress } from "../hooks/useLongPress";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";
import {
  getDayActionLabel,
  getEventActionLabel,
} from "../utils/calendarAccessibility";
import ConflictBadge from "./ConflictBadge";

interface DayCellProps {
  date: Date;
  events: CalendarEvent[];
  members: readonly CalendarOwner[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  conflictEventIds?: ReadonlySet<string>;
  onSelect: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onLongPressCreate?: (date: Date) => void;
}

type MultiDayStatus =
  | "starter"
  | "continues"
  | "ends"
  | null;

function getStartOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}



function getEventLastVisibleDay(
  event: CalendarEvent,
): Date {
  const eventEnd = new Date(event.end);

  if (event.allDay) {
    return new Date(
      eventEnd.getFullYear(),
      eventEnd.getMonth(),
      eventEnd.getDate() - 1,
      0,
      0,
      0,
      0,
    );
  }

  const endOfPreviousMillisecond = new Date(
    eventEnd.getTime() - 1,
  );

  return getStartOfDay(
    endOfPreviousMillisecond,
  );
}

function isSameDate(
  firstDate: Date,
  secondDate: Date,
): boolean {
  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth() &&
    firstDate.getDate() ===
      secondDate.getDate()
  );
}

function getMultiDayStatus(
  event: CalendarEvent,
  visibleDate: Date,
): MultiDayStatus {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  if (
    Number.isNaN(eventStart.getTime()) ||
    Number.isNaN(eventEnd.getTime())
  ) {
    return null;
  }

  const firstVisibleDay =
    getStartOfDay(eventStart);

  const lastVisibleDay =
    getEventLastVisibleDay(event);

  if (
    isSameDate(
      firstVisibleDay,
      lastVisibleDay,
    )
  ) {
    return null;
  }

  const currentDay =
    getStartOfDay(visibleDate);

  if (
    isSameDate(
      currentDay,
      firstVisibleDay,
    )
  ) {
    return "starter";
  }

  if (
    isSameDate(
      currentDay,
      lastVisibleDay,
    )
  ) {
    return "ends";
  }

  if (
    currentDay > firstVisibleDay &&
    currentDay < lastVisibleDay
  ) {
    return "continues";
  }

  return null;
}

function formatEventTime(date: Date): string {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getMultiDayLabel(
  status: MultiDayStatus,
): string | null {
  switch (status) {
    case "starter":
      return "Starter";

    case "continues":
      return "Fortsætter";

    case "ends":
      return "Slutter";

    default:
      return null;
  }
}

function DayCell({
  date,
  events,
  members,
  isCurrentMonth,
  isSelected,
  isToday,
  conflictEventIds,
  onSelect,
  onSelectEvent,
  onLongPressCreate,
}: DayCellProps) {
  const longPress = useLongPress({
    onLongPress: () => onLongPressCreate?.(date),
    onClick: () => onSelect(date),
  });

  const ownerIds = Array.from(
    new Set(
      events.flatMap(
        (event) => event.ownerIds,
      ),
    ),
  ) as CalendarOwnerId[];

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      <ButtonBase
        aria-label={getDayActionLabel(date)}
        {...longPress}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          width: "100%",
          height: "100%",
          borderRadius: 1.5,
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          pointerEvents: "none",
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
          borderColor: (theme) =>
            isSelected
              ? theme.palette.primary.main
              : isToday
                ? alpha(theme.palette.primary.main, 0.35)
                : theme.palette.divider,
          borderRadius: 1.5,
          // Dags dato får en tonet baggrund, så den er tydelig at få øje på
          // uden at skulle finde den lille cirkel om taldatoen.
          backgroundColor: (theme) =>
            isSelected
              ? alpha(theme.palette.primary.main, 0.14)
              : isToday
                ? alpha(theme.palette.primary.main, 0.06)
                : isCurrentMonth
                  ? theme.palette.background.paper
                  : theme.palette.action.hover,
          opacity: isCurrentMonth ? 1 : 0.55,
          transition:
            "background-color 150ms, border-color 150ms",

          "&:hover": {
            backgroundColor: (theme) =>
              isSelected
                ? alpha(theme.palette.primary.main, 0.14)
                : theme.palette.action.hover,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
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
                  isToday || isSelected
                    ? 700
                    : 500,
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
          {ownerIds
            .slice(0, 5)
            .map((ownerId) => {
              const owner = members.find(
                (candidate) => candidate.id === ownerId,
              );

              if (!owner) {
                return null;
              }

              return (
                <Box
                  key={ownerId}
                  title={owner.name}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor:
                      owner.color,
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
            {events
              .slice(0, 2)
              .map((event) => {
                const ownerColor = getEventOwnerColor(
                  event,
                  members,
                );

                const multiDayStatus =
                  getMultiDayStatus(
                    event,
                    date,
                  );

                const multiDayLabel =
                  getMultiDayLabel(
                    multiDayStatus,
                  );

                return (
                  <ButtonBase
                    key={event.id}
                    aria-label={getEventActionLabel(event)}
                    title={`${event.allDay ? "Hele dagen" : formatEventTime(new Date(event.start))} · ${event.title}`}
                    onClick={() => onSelectEvent(event)}
                    sx={{
                      pointerEvents: "auto",
                      justifyContent: "flex-start",
                      px: 1,
                      py: 0.5,
                      borderRadius: 0.75,
                      // Aftalens farve som en tydelig, lys baggrund — ikke
                      // kun en tynd venstrekant — så aftalen er nem at
                      // skelne uden at skulle læse teksten først.
                      backgroundColor:
                        `${ownerColor}30`,
                      borderLeft:
                        `3px solid ${ownerColor}`,
                      overflow: "hidden",
                      cursor: "pointer",

                      "&:hover": {
                        backgroundColor:
                          `${ownerColor}45`,
                      },

                      "&:focus-visible": {
                        outline:
                          "2px solid",
                        outlineColor:
                          "primary.main",
                        outlineOffset: 1,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 0.5,
                        minWidth: 0,
                        width: "100%",
                      }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          display: "block",
                          minWidth: 0,
                          flex: 1,
                          fontSize: "0.875rem",
                          lineHeight: 1.3,
                        }}
                      >
                        {!event.allDay && (
                          <Box
                            component="span"
                            sx={{ fontWeight: 700 }}
                          >
                            {formatEventTime(new Date(event.start))}{" "}
                          </Box>
                        )}
                        {event.title}
                      </Typography>

                      <ConflictBadge
                        isConflict={conflictEventIds?.has(event.id) ?? false}
                      />

                      {multiDayLabel && (
                        <Chip
                          label={
                            multiDayLabel
                          }
                          size="small"
                          variant="outlined"
                          sx={{
                            flexShrink: 0,
                            height: 18,
                            borderColor:
                              ownerColor,
                            color:
                              ownerColor,

                            "& .MuiChip-label":
                              {
                                px: 0.6,
                                fontSize:
                                  "0.58rem",
                                fontWeight: 700,
                              },
                          }}
                        />
                      )}
                    </Box>
                  </ButtonBase>
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
    </Box>
    </Box>
  );
}

export default DayCell;
