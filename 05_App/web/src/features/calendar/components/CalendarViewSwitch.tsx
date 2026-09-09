import { Box } from "@mui/material";

import DayCalendar from "./DayCalendar";
import FamilyPlannerCalendar from "./FamilyPlannerCalendar";
import MonthCalendar from "./MonthCalendar";
import WeekCalendar from "./WeekCalendar";
import type { useCalendarPageController } from "../hooks/useCalendarPageController";

type Controller = ReturnType<typeof useCalendarPageController>;

type CalendarViewSwitchProps = Pick<
  Controller,
  | "calendarView"
  | "selectedDate"
  | "visibleDate"
  | "visibleEvents"
  | "members"
  | "conflictEventIds"
  | "sourceFilteredRawEvents"
  | "recurrenceExceptions"
  | "swipeNavigation"
  | "handleSelectDate"
  | "handleOpenDayFromWeek"
  | "handleSelectEvent"
  | "handleLongPressCreate"
>;

export function CalendarViewSwitch({
  calendarView,
  selectedDate,
  visibleDate,
  visibleEvents,
  members,
  conflictEventIds,
  sourceFilteredRawEvents,
  recurrenceExceptions,
  swipeNavigation,
  handleSelectDate,
  handleOpenDayFromWeek,
  handleSelectEvent,
  handleLongPressCreate,
}: CalendarViewSwitchProps) {
  return (
    <Box
      {...(calendarView === "planner" ? {} : swipeNavigation)}
      sx={
        calendarView === "planner"
          ? undefined
          : // Frigør vandrette strøg til vores egen pointer-håndtering i
            // stedet for at lade browseren først forsøge at fortolke dem som
            // sin egen pan/scroll-gestus (hvilket ellers kunne kræve et
            // urealistisk langt strøg, før det overhovedet blev registreret)
            // — lodret scroll (fx dagvisningens tidslinje) er upåvirket.
            { touchAction: "pan-y" }
      }
    >
      {calendarView === "month" ? (
        <MonthCalendar
          visibleMonth={visibleDate}
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectDate={handleSelectDate}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : calendarView === "week" ? (
        <WeekCalendar
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectDate={handleOpenDayFromWeek}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : calendarView === "day" ? (
        <DayCalendar
          selectedDate={selectedDate}
          events={visibleEvents}
          members={members}
          conflictEventIds={conflictEventIds}
          onSelectEvent={handleSelectEvent}
          onLongPressCreate={handleLongPressCreate}
        />
      ) : (
        <FamilyPlannerCalendar
          visibleDate={visibleDate}
          events={sourceFilteredRawEvents}
          recurrenceExceptions={recurrenceExceptions.exceptions}
          members={members}
          onSelectEvent={handleSelectEvent}
        />
      )}
    </Box>
  );
}
