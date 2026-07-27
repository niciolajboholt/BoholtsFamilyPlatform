import { useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";

import { calendarOwners } from "../data/calendarOwners";
import type { CalendarOwnerId } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../services/CalendarService";

interface NewEventDialogProps {
  open: boolean;
  initialDate: Date;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (
    input: CreateCalendarEventInput,
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

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialState(
  initialDate: Date,
): EventFormState {
  return {
    title: "",
    date: formatDateInput(initialDate),
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
    ownerIds: ["family"],
    description: "",
    location: "",
  };
}

function createDateTime(
  date: string,
  time: string,
): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function createAllDayDate(
  date: string,
  addDay: boolean,
): string {
  const value = new Date(`${date}T00:00:00`);

  if (addDay) {
    value.setDate(value.getDate() + 1);
  }

  return value.toISOString();
}

function NewEventDialog({
  open,
  initialDate,
  isSaving,
  onClose,
  onCreate,
}: NewEventDialogProps) {
  const [form, setForm] = useState<EventFormState>(
    createInitialState(initialDate),
  );

  const [submitError, setSubmitError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (open) {
      setForm(createInitialState(initialDate));
      setSubmitError(null);
    }
  }, [open, initialDate]);

  const validationError = useMemo(() => {
    if (!form.title.trim()) {
      return "Skriv en titel på aftalen.";
    }

    if (form.ownerIds.length === 0) {
      return "Vælg mindst én kalender.";
    }

    if (
      !form.allDay &&
      form.endTime <= form.startTime
    ) {
      return "Sluttidspunktet skal ligge efter starttidspunktet.";
    }

    return null;
  }, [form]);

  function toggleOwner(ownerId: CalendarOwnerId) {
    setForm((currentForm) => {
      const isSelected =
        currentForm.ownerIds.includes(ownerId);

      return {
        ...currentForm,
        ownerIds: isSelected
          ? currentForm.ownerIds.filter(
              (id) => id !== ownerId,
            )
          : [...currentForm.ownerIds, ownerId],
      };
    });
  }

  async function handleSubmit() {
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    const input: CreateCalendarEventInput = {
      title: form.title.trim(),
      allDay: form.allDay,
      ownerIds: form.ownerIds,
      start: form.allDay
        ? createAllDayDate(form.date, false)
        : createDateTime(form.date, form.startTime),
      end: form.allDay
        ? createAllDayDate(form.date, true)
        : createDateTime(form.date, form.endTime),
      description:
        form.description.trim() || undefined,
      location: form.location.trim() || undefined,
    };

    try {
      setSubmitError(null);
      await onCreate(input);
      onClose();
    } catch {
      setSubmitError(
        "Aftalen kunne ikke gemmes. Prøv igen.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={isSaving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Ny aftale</DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            pt: 1,
          }}
        >
          {submitError && (
            <Alert severity="error">
              {submitError}
            </Alert>
          )}

          <TextField
            label="Titel"
            value={form.title}
            autoFocus
            required
            fullWidth
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                title: event.target.value,
              }))
            }
          />

          <TextField
            label="Dato"
            type="date"
            value={form.date}
            fullWidth
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                date: event.target.value,
              }))
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={form.allDay}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    allDay: event.target.checked,
                  }))
                }
              />
            }
            label="Hele dagen"
          />

          {!form.allDay && (
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
                value={form.startTime}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    startTime: event.target.value,
                  }))
                }
              />

              <TextField
                label="Slut"
                type="time"
                value={form.endTime}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(event) =>
                  setForm((currentForm) => ({
                    ...currentForm,
                    endTime: event.target.value,
                  }))
                }
              />
            </Box>
          )}

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1 }}
            >
              Kalender og deltagere
            </Typography>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {Object.values(calendarOwners).map(
                (owner) => {
                  const isSelected =
                    form.ownerIds.includes(owner.id);

                  return (
                    <Chip
                      key={owner.id}
                      label={owner.name}
                      clickable
                      onClick={() =>
                        toggleOwner(owner.id)
                      }
                      variant={
                        isSelected
                          ? "filled"
                          : "outlined"
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
          </Box>

          <TextField
            label="Sted"
            value={form.location}
            fullWidth
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                location: event.target.value,
              }))
            }
          />

          <TextField
            label="Beskrivelse"
            value={form.description}
            fullWidth
            multiline
            minRows={3}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                description: event.target.value,
              }))
            }
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={isSaving}
        >
          Annuller
        </Button>

        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={isSaving}
          startIcon={
            isSaving ? (
              <CircularProgress
                size={18}
                color="inherit"
              />
            ) : undefined
          }
        >
          {isSaving ? "Gemmer..." : "Opret aftale"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewEventDialog;