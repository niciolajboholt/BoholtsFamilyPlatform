import { useEffect, useMemo, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";

interface EditEventDialogProps {
  open: boolean;
  event: CalendarEvent | null;
  isSaving: boolean;
  onClose: () => void;
  onUpdate: (
    event: CalendarEvent,
  ) => Promise<void>;
  onDelete: (
    eventId: string,
  ) => Promise<void>;
}

interface EventFormState {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  description: string;
  location: string;
}

function padNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

function toDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join("-");
}

function toTimeInputValue(date: Date): string {
  return [
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
  ].join(":");
}

function createInitialFormState(
  event: CalendarEvent | null,
): EventFormState {
  if (!event) {
    return {
      title: "",
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      ownerIds: [],
      description: "",
      location: "",
    };
  }

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  return {
    title: event.title,
    date: toDateInputValue(startDate),
    startTime: toTimeInputValue(startDate),
    endTime: toTimeInputValue(endDate),
    allDay: event.allDay,
    ownerIds: event.ownerIds,
    description: event.description ?? "",
    location: event.location ?? "",
  };
}

function createDateTime(
  date: string,
  time: string,
): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function EditEventDialog({
  open,
  event,
  isSaving,
  onClose,
  onUpdate,
  onDelete,
}: EditEventDialogProps) {
  const [formState, setFormState] =
    useState<EventFormState>(() =>
      createInitialFormState(event),
    );

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] =
    useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(createInitialFormState(event));
    setSubmitError(null);
    setIsDeleteConfirmationVisible(false);
  }, [event, open]);

  const validationError = useMemo(() => {
    if (!formState.title.trim()) {
      return "Skriv en titel til aftalen.";
    }

    if (!formState.date) {
      return "Vælg en dato.";
    }

    if (formState.ownerIds.length === 0) {
      return "Vælg mindst én kalender.";
    }

    if (
      !formState.allDay &&
      formState.endTime <= formState.startTime
    ) {
      return "Sluttidspunktet skal ligge efter starttidspunktet.";
    }

    return null;
  }, [formState]);

  function handleToggleOwner(
    ownerId: CalendarOwnerId,
  ) {
    setFormState((currentState) => {
      const isSelected =
        currentState.ownerIds.includes(ownerId);

      return {
        ...currentState,
        ownerIds: isSelected
          ? currentState.ownerIds.filter(
              (currentOwnerId) =>
                currentOwnerId !== ownerId,
            )
          : [...currentState.ownerIds, ownerId],
      };
    });
  }

  async function handleSubmit() {
    if (!event || validationError) {
      return;
    }

    setSubmitError(null);

    const start = formState.allDay
      ? createDateTime(formState.date, "00:00")
      : createDateTime(
          formState.date,
          formState.startTime,
        );

    const end = formState.allDay
      ? createDateTime(formState.date, "23:59")
      : createDateTime(
          formState.date,
          formState.endTime,
        );

    const updatedEvent: CalendarEvent = {
      ...event,
      title: formState.title.trim(),
      start,
      end,
      allDay: formState.allDay,
      ownerIds: formState.ownerIds,
      description:
        formState.description.trim() || undefined,
      location:
        formState.location.trim() || undefined,
    };

    try {
      await onUpdate(updatedEvent);
      onClose();
    } catch (caughtError: unknown) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke gemmes.",
      );
    }
  }

  async function handleDelete() {
    if (!event) {
      return;
    }

    setSubmitError(null);

    try {
      await onDelete(event.id);
      onClose();
    } catch (caughtError: unknown) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke slettes.",
      );
    }
  }

  const isInternalEvent =
    event?.source === "internal";

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Rediger aftale
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: 1,
          }}
        >
          {!isInternalEvent && (
            <Alert severity="info">
              Kun interne aftaler kan redigeres eller
              slettes.
            </Alert>
          )}

          {submitError && (
            <Alert severity="error">
              {submitError}
            </Alert>
          )}

          <TextField
            label="Titel"
            value={formState.title}
            disabled={!isInternalEvent || isSaving}
            required
            autoFocus
            onChange={(event) =>
              setFormState((currentState) => ({
                ...currentState,
                title: event.target.value,
              }))
            }
          />

          <TextField
            label="Dato"
            type="date"
            value={formState.date}
            disabled={!isInternalEvent || isSaving}
            required
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            onChange={(event) =>
              setFormState((currentState) => ({
                ...currentState,
                date: event.target.value,
              }))
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formState.allDay}
                disabled={!isInternalEvent || isSaving}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    allDay: event.target.checked,
                  }))
                }
              />
            }
            label="Heldagsaftale"
          />

          {!formState.allDay && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "1fr 1fr",
                },
                gap: 2,
              }}
            >
              <TextField
                label="Start"
                type="time"
                value={formState.startTime}
                disabled={!isInternalEvent || isSaving}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    startTime: event.target.value,
                  }))
                }
              />

              <TextField
                label="Slut"
                type="time"
                value={formState.endTime}
                disabled={!isInternalEvent || isSaving}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    endTime: event.target.value,
                  }))
                }
              />
            </Box>
          )}

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 0.5 }}
            >
              Kalender
            </Typography>

            {Object.values(calendarOwners).map(
              (owner) => (
                <FormControlLabel
                  key={owner.id}
                  control={
                    <Checkbox
                      checked={formState.ownerIds.includes(
                        owner.id,
                      )}
                      disabled={
                        !isInternalEvent || isSaving
                      }
                      onChange={() =>
                        handleToggleOwner(owner.id)
                      }
                    />
                  }
                  label={owner.name}
                />
              ),
            )}
          </Box>

          <TextField
            label="Sted"
            value={formState.location}
            disabled={!isInternalEvent || isSaving}
            onChange={(event) =>
              setFormState((currentState) => ({
                ...currentState,
                location: event.target.value,
              }))
            }
          />

          <TextField
            label="Beskrivelse"
            value={formState.description}
            disabled={!isInternalEvent || isSaving}
            multiline
            minRows={3}
            onChange={(event) =>
              setFormState((currentState) => ({
                ...currentState,
                description: event.target.value,
              }))
            }
          />

          {validationError && isInternalEvent && (
            <Alert severity="warning">
              {validationError}
            </Alert>
          )}

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
              Aftalen slettes permanent fra denne
              browser.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          justifyContent: "space-between",
        }}
      >
        <Button
          color="error"
          startIcon={<DeleteOutlineIcon />}
          disabled={!isInternalEvent || isSaving}
          onClick={() =>
            setIsDeleteConfirmationVisible(true)
          }
        >
          Slet
        </Button>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            disabled={isSaving}
            onClick={onClose}
          >
            Annuller
          </Button>

          <Button
            variant="contained"
            disabled={
              !isInternalEvent ||
              isSaving ||
              Boolean(validationError)
            }
            onClick={() => void handleSubmit()}
          >
            {isSaving ? "Gemmer..." : "Gem ændringer"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default EditEventDialog;