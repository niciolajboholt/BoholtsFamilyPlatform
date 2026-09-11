import { Alert, Button, Snackbar } from "@mui/material";

import EditEventDialog from "./EditEventDialog";
import NewEventDialog from "./NewEventDialog";
import type { useCalendarPageController } from "../hooks/useCalendarPageController";

type Controller = ReturnType<typeof useCalendarPageController>;

type CalendarDialogsProps = Pick<
  Controller,
  | "isNewEventDialogOpen"
  | "setIsNewEventDialogOpen"
  | "longPressCreateDate"
  | "setLongPressCreateDate"
  | "selectedDate"
  | "selectedEvent"
  | "viewerEvents"
  | "calendarSources"
  | "members"
  | "isSaving"
  | "handleCreateEvent"
  | "handleCloseEditDialog"
  | "handleUpdateEvent"
  | "handleDeleteEvent"
  | "recurrenceExceptions"
  | "snackbar"
  | "handleCloseSnackbar"
  | "handleUndoDelete"
>;

export function CalendarDialogs({
  isNewEventDialogOpen,
  setIsNewEventDialogOpen,
  longPressCreateDate,
  setLongPressCreateDate,
  selectedDate,
  selectedEvent,
  viewerEvents,
  calendarSources,
  members,
  isSaving,
  handleCreateEvent,
  handleCloseEditDialog,
  handleUpdateEvent,
  handleDeleteEvent,
  recurrenceExceptions,
  snackbar,
  handleCloseSnackbar,
  handleUndoDelete,
}: CalendarDialogsProps) {
  return (
    <>
      <NewEventDialog
        open={isNewEventDialogOpen}
        initialDate={longPressCreateDate ?? selectedDate}
        events={viewerEvents}
        calendarSources={calendarSources}
        members={members}
        isSaving={isSaving}
        onClose={() => {
          setIsNewEventDialogOpen(false);
          setLongPressCreateDate(null);
        }}
        onCreate={handleCreateEvent}
      />

      <EditEventDialog
        open={selectedEvent !== null}
        event={selectedEvent}
        events={viewerEvents}
        calendarSources={calendarSources}
        members={members}
        isSaving={isSaving}
        onClose={handleCloseEditDialog}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        onUpdateOccurrence={recurrenceExceptions.modifyOccurrence}
        onDeleteOccurrence={recurrenceExceptions.cancelOccurrence}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.showUndo ? 6000 : 3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={handleCloseSnackbar}
          action={
            snackbar.showUndo ? (
              <Button
                color="inherit"
                size="small"
                disabled={isSaving}
                onClick={() => {
                  void handleUndoDelete();
                }}
              >
                Fortryd
              </Button>
            ) : undefined
          }
          sx={{ width: "100%", alignItems: "center" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
