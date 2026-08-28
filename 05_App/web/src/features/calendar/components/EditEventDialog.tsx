import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { ExpandMoreRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  FormControlLabel,
  Switch,
  TextField,
  type DialogProps,
} from "@mui/material";

import { ConfirmDiscardDialog } from "./ConfirmDiscardDialog";
import { EventConflictAlert } from "./EventConflictAlert";
import { EventDateTimeSection } from "./EventDateTimeSection";
import { EventParticipantsSection } from "./EventParticipantsSection";
import { EventRecurrenceSection } from "./EventRecurrenceSection";
import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import { isExternalCalendarProviderType } from "../models/calendarProvider";
import type { RecurrenceExceptionOverride } from "../preferences/recurrenceExceptionsStorage";
import type { CalendarOwner } from "../data/calendarOwners";
import { eventReminderOffsetOptions } from "../eventReminders/eventReminderApi";
import { useEditEventDialogController } from "../hooks/useEditEventDialogController";

interface EditEventDialogProps {
  open: boolean;
  event: CalendarEvent | null;
  events: CalendarEvent[];
  calendarSources: readonly CalendarSource[];
  members: readonly CalendarOwner[];
  isSaving: boolean;
  onClose: () => void;
  onUpdate: (event: CalendarEvent) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  onUpdateOccurrence: (
    masterEventId: string,
    occurrenceStart: string,
    override: RecurrenceExceptionOverride,
  ) => void;
  onDeleteOccurrence: (masterEventId: string, occurrenceStart: string) => void;
}

function EditEventDialog({
  open,
  event,
  events,
  calendarSources,
  members,
  isSaving,
  onClose,
  onUpdate,
  onDelete,
  onUpdateOccurrence,
  onDeleteOccurrence,
}: EditEventDialogProps) {
  const {
    isRecurringLocalOccurrence,
    editScope,
    setEditScope,
    effectiveEvent,
    canEditRecurrenceRule,
    formState,
    setField,
    toggleParticipant,
    submitError,
    isDeleteConfirmationVisible,
    setIsDeleteConfirmationVisible,
    isDiscardConfirmationVisible,
    isMoreOptionsOpen,
    setIsMoreOptionsOpen,
    eventSource,
    isInternalEvent,
    canChangeCalendar,
    requestedSourceId,
    setRequestedSourceId,
    recurrence,
    setRecurrence,
    recurrenceError,
    canSetReminder,
    reminderOffsetMinutes,
    setReminder,
    getVisibleErrorMessage,
    markFieldFocused,
    markFieldTouched,
    fieldRefs,
    conflictingEvents,
    handleStartDateChange,
    handleAllDayChange,
    handleCloseRequest,
    handleContinueEditing,
    handleDiscardChanges,
    handleSubmit,
    handleDelete,
  } = useEditEventDialogController({
    open,
    event,
    events,
    calendarSources,
    isSaving,
    onClose,
    onUpdate,
    onDelete,
    onUpdateOccurrence,
    onDeleteOccurrence,
  });

  const handleDialogClose: DialogProps["onClose"] = () => {
    handleCloseRequest();
  };

  return (
    <>
      <Dialog open={open} onClose={isSaving ? undefined : handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Rediger aftale</DialogTitle>

        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {!isInternalEvent && (
              <Alert severity="info">
                {effectiveEvent?.privacyRedacted
                  ? "Dette er en privat aftale. Kun det tilknyttede familiemedlem kan se eller redigere detaljerne."
                  : isExternalCalendarProviderType(eventSource?.providerType)
                    ? "Denne kalender er skrivebeskyttet."
                    : "Kun interne aftaler kan redigeres eller slettes."}
              </Alert>
            )}

            {isRecurringLocalOccurrence && (
              <TextField
                select
                label="Gælder for"
                value={editScope}
                disabled={!isInternalEvent || isSaving}
                fullWidth
                onChange={(changeEvent) =>
                  setEditScope(changeEvent.target.value as typeof editScope)
                }
              >
                <MenuItem value="occurrence">Kun denne forekomst</MenuItem>
                <MenuItem value="series">Hele rækken</MenuItem>
              </TextField>
            )}

            {canChangeCalendar && (
              <TextField
                select
                label="Hvem gælder aftalen for?"
                value={requestedSourceId}
                disabled={isSaving}
                fullWidth
                onChange={(changeEvent) => setRequestedSourceId(changeEvent.target.value)}
              >
                {calendarSources
                  .filter((source) => source.providerType === "google")
                  .map((source) => (
                    <MenuItem key={source.id} value={source.id} disabled={source.isReadOnly}>
                      <Box
                        component="span"
                        sx={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: source.color,
                          mr: 1.25,
                          flexShrink: 0,
                        }}
                      />
                      {source.name}
                      {source.isReadOnly ? " (skrivebeskyttet)" : ""}
                    </MenuItem>
                  ))}
              </TextField>
            )}

            {submitError && <Alert severity="error">{submitError}</Alert>}

            <TextField
              label="Titel"
              value={formState.title}
              disabled={!isInternalEvent || isSaving}
              required
              autoFocus={isInternalEvent}
              error={Boolean(getVisibleErrorMessage("title"))}
              helperText={getVisibleErrorMessage("title")}
              inputRef={fieldRefs.title}
              onChange={(changeEvent) => setField("title", changeEvent.target.value)}
              onBlur={() => markFieldTouched("title")}
              onFocus={() => markFieldFocused("title")}
            />

            <EventDateTimeSection
              form={formState}
              disabled={!isInternalEvent || isSaving}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={(value) => setField("endDate", value)}
              onAllDayChange={handleAllDayChange}
              onStartTimeChange={(value) => setField("startTime", value)}
              onEndTimeChange={(value) => setField("endTime", value)}
              onStartDateBlur={() => markFieldTouched("startDate")}
              onStartDateFocus={() => markFieldFocused("startDate")}
              onEndDateBlur={() => markFieldTouched("endDate")}
              onEndDateFocus={() => markFieldFocused("endDate")}
              onStartTimeBlur={() => markFieldTouched("startTime")}
              onStartTimeFocus={() => markFieldFocused("startTime")}
              onEndTimeBlur={() => markFieldTouched("endTime")}
              onEndTimeFocus={() => markFieldFocused("endTime")}
              startDateError={getVisibleErrorMessage("startDate")}
              endDateError={getVisibleErrorMessage("endDate")}
              startTimeError={getVisibleErrorMessage("startTime")}
              endTimeError={getVisibleErrorMessage("endTime")}
              inputRefs={fieldRefs}
              allDayLabel="Heldagsaftale"
              dateFieldsFullWidth={false}
            />

            {conflictingEvents.length > 0 && isInternalEvent && (
              <EventConflictAlert
                conflicts={conflictingEvents}
                continuationText="Du kan stadig gemme ændringerne."
              />
            )}

            <Button
              size="small"
              onClick={() => setIsMoreOptionsOpen((current) => !current)}
              endIcon={
                <ExpandMoreRounded
                  sx={{
                    transition: "transform 150ms",
                    transform: isMoreOptionsOpen ? "rotate(180deg)" : "none",
                  }}
                />
              }
              sx={{ justifySelf: "flex-start", px: 0 }}
            >
              Flere muligheder
            </Button>

            <Collapse in={isMoreOptionsOpen} timeout="auto">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {!isExternalCalendarProviderType(eventSource?.providerType) && canEditRecurrenceRule && (
                  <EventRecurrenceSection
                    value={recurrence}
                    eventStartDate={formState.startDate}
                    disabled={!isInternalEvent || isSaving}
                    errorMessage={recurrenceError}
                    onChange={setRecurrence}
                  />
                )}

                {!isExternalCalendarProviderType(eventSource?.providerType) && (
                  <EventParticipantsSection
                    ownerIds={formState.ownerIds}
                    members={members}
                    disabled={!isInternalEvent || isSaving}
                    onToggleOwner={(ownerId) => {
                      toggleParticipant(ownerId);
                      markFieldTouched("ownerIds");
                    }}
                    title="Hvem gælder aftalen for?"
                    variant="checkboxes"
                    errorText={getVisibleErrorMessage("ownerIds")}
                  />
                )}

                {canSetReminder && (
                  <TextField
                    select
                    label="Påmindelse"
                    value={reminderOffsetMinutes ?? ""}
                    disabled={isSaving}
                    fullWidth
                    onChange={(changeEvent) =>
                      setReminder(
                        changeEvent.target.value === "" ? null : Number(changeEvent.target.value),
                      )
                    }
                  >
                    <MenuItem value="">Ingen</MenuItem>
                    {eventReminderOffsetOptions.map((option) => (
                      <MenuItem key={option.minutes} value={option.minutes}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={formState.privacy === "busy"}
                      disabled={!isInternalEvent || isSaving}
                      onChange={(changeEvent) =>
                        setField("privacy", changeEvent.target.checked ? "busy" : "details")
                      }
                    />
                  }
                  label="Privat aftale – familien ser kun Optaget"
                />

                <TextField
                  label="Sted (valgfrit)"
                  value={formState.location}
                  disabled={!isInternalEvent || isSaving}
                  onChange={(changeEvent) => setField("location", changeEvent.target.value)}
                />

                <TextField
                  label="Beskrivelse (valgfrit)"
                  value={formState.description}
                  disabled={!isInternalEvent || isSaving}
                  multiline
                  minRows={3}
                  onChange={(changeEvent) => setField("description", changeEvent.target.value)}
                />
              </Box>
            </Collapse>

            {isDeleteConfirmationVisible && (
              <Alert
                severity="warning"
                action={
                  <Button
                    color="error"
                    size="small"
                    disabled={isSaving}
                    onClick={() => void handleDelete()}
                  >
                    Bekræft sletning
                  </Button>
                }
              >
                Aftalen slettes fra denne browser. Den kan efterfølgende gendannes via Fortryd.
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
          <Button
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={!isInternalEvent || isSaving}
            onClick={() => setIsDeleteConfirmationVisible(true)}
          >
            Slet
          </Button>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button disabled={isSaving} onClick={handleCloseRequest} autoFocus={!isInternalEvent}>
              Annuller
            </Button>

            <Button
              variant="contained"
              disabled={!isInternalEvent || isSaving}
              onClick={() => void handleSubmit()}
            >
              {isSaving ? "Gemmer..." : "Gem ændringer"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <ConfirmDiscardDialog
        open={isDiscardConfirmationVisible}
        onContinueEditing={handleContinueEditing}
        onDiscard={handleDiscardChanges}
      />
    </>
  );
}

export default EditEventDialog;
