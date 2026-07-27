import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../services/CalendarService";
import { findEventConflicts } from "../utils/findEventConflicts";

interface NewEventDialogProps {
  open: boolean;
  initialDate: Date;
  events: CalendarEvent[];
  isSaving: boolean;
  onClose: () => void;
  onCreate: (
    input: CreateCalendarEventInput,
  ) => Promise<void>;
}

interface EventFormState {
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  description: string;
  location: string;
}

function formatDateInput(
  date: Date,
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialState(
  initialDate: Date,
): EventFormState {
  const date =
    formatDateInput(initialDate);

  return {
    title: "",
    startDate: date,
    endDate: date,
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
  return new Date(
    `${date}T${time}:00`,
  ).toISOString();
}

function createAllDayDate(
  date: string,
  addDay: boolean,
): string {
  const value = new Date(
    `${date}T00:00:00`,
  );

  if (addDay) {
    value.setDate(
      value.getDate() + 1,
    );
  }

  return value.toISOString();
}

function isSameCalendarDate(
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

function formatConflictTime(
  event: CalendarEvent,
): string {
  if (event.allDay) {
    return "Hele dagen";
  }

  const dateFormatter =
    new Intl.DateTimeFormat(
      "da-DK",
      {
        day: "numeric",
        month: "short",
      },
    );

  const timeFormatter =
    new Intl.DateTimeFormat(
      "da-DK",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );

  const startDate =
    new Date(event.start);

  const endDate =
    new Date(event.end);

  if (
    isSameCalendarDate(
      startDate,
      endDate,
    )
  ) {
    return `${timeFormatter.format(
      startDate,
    )}–${timeFormatter.format(
      endDate,
    )}`;
  }

  return `${dateFormatter.format(
    startDate,
  )} ${timeFormatter.format(
    startDate,
  )} – ${dateFormatter.format(
    endDate,
  )} ${timeFormatter.format(
    endDate,
  )}`;
}

function NewEventDialog({
  open,
  initialDate,
  events,
  isSaving,
  onClose,
  onCreate,
}: NewEventDialogProps) {
  const [
    form,
    setForm,
  ] = useState<EventFormState>(
    createInitialState(initialDate),
  );

  const [
    submitError,
    setSubmitError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(
      createInitialState(
        initialDate,
      ),
    );

    setSubmitError(null);
  }, [
    open,
    initialDate,
  ]);

  const validationError =
    useMemo(() => {
      if (!form.title.trim()) {
        return "Skriv en titel på aftalen.";
      }

      if (!form.startDate) {
        return "Vælg en startdato.";
      }

      if (!form.endDate) {
        return "Vælg en slutdato.";
      }

      if (
        form.endDate <
        form.startDate
      ) {
        return "Slutdatoen må ikke ligge før startdatoen.";
      }

      if (
        form.ownerIds.length === 0
      ) {
        return "Vælg mindst én kalender.";
      }

      if (
        !form.allDay &&
        form.startDate ===
          form.endDate &&
        form.endTime <=
          form.startTime
      ) {
        return "Sluttidspunktet skal ligge efter starttidspunktet.";
      }

      return null;
    }, [form]);

  const candidateEvent =
    useMemo(() => {
      if (
        !form.startDate ||
        !form.endDate ||
        form.ownerIds.length === 0 ||
        validationError
      ) {
        return null;
      }

      return {
        start: form.allDay
          ? createAllDayDate(
              form.startDate,
              false,
            )
          : createDateTime(
              form.startDate,
              form.startTime,
            ),

        end: form.allDay
          ? createAllDayDate(
              form.endDate,
              true,
            )
          : createDateTime(
              form.endDate,
              form.endTime,
            ),

        ownerIds:
          form.ownerIds,
      };
    }, [
      form,
      validationError,
    ]);

  const conflictingEvents =
    useMemo(() => {
      if (!candidateEvent) {
        return [];
      }

      return findEventConflicts(
        candidateEvent,
        events,
      );
    }, [
      candidateEvent,
      events,
    ]);

  function toggleOwner(
    ownerId: CalendarOwnerId,
  ) {
    setForm(
      (currentForm) => {
        const isSelected =
          currentForm.ownerIds.includes(
            ownerId,
          );

        return {
          ...currentForm,

          ownerIds: isSelected
            ? currentForm.ownerIds.filter(
                (id) =>
                  id !== ownerId,
              )
            : [
                ...currentForm.ownerIds,
                ownerId,
              ],
        };
      },
    );
  }

  function handleStartDateChange(
    startDate: string,
  ) {
    setForm(
      (currentForm) => ({
        ...currentForm,

        startDate,

        endDate:
          !currentForm.endDate ||
          currentForm.endDate <
            startDate
            ? startDate
            : currentForm.endDate,
      }),
    );
  }

  async function handleSubmit() {
    if (validationError) {
      setSubmitError(
        validationError,
      );

      return;
    }

    const input: CreateCalendarEventInput =
      {
        title:
          form.title.trim(),

        allDay:
          form.allDay,

        ownerIds: [
          ...form.ownerIds,
        ],

        start: form.allDay
          ? createAllDayDate(
              form.startDate,
              false,
            )
          : createDateTime(
              form.startDate,
              form.startTime,
            ),

        end: form.allDay
          ? createAllDayDate(
              form.endDate,
              true,
            )
          : createDateTime(
              form.endDate,
              form.endTime,
            ),

        description:
          form.description.trim() ||
          undefined,

        location:
          form.location.trim() ||
          undefined,
      };

    try {
      setSubmitError(null);

      await onCreate(input);

      onClose();
    } catch (
      caughtError: unknown
    ) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke gemmes. Prøv igen.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={
        isSaving
          ? undefined
          : onClose
      }
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Ny aftale
      </DialogTitle>

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
            disabled={isSaving}
            onChange={(event) =>
              setForm(
                (currentForm) => ({
                  ...currentForm,

                  title:
                    event.target.value,
                }),
              )
            }
          />

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
              label="Startdato"
              type="date"
              value={
                form.startDate
              }
              required
              fullWidth
              disabled={isSaving}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
              onChange={(event) =>
                handleStartDateChange(
                  event.target.value,
                )
              }
            />

            <TextField
              label="Slutdato"
              type="date"
              value={
                form.endDate
              }
              required
              fullWidth
              disabled={isSaving}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },

                htmlInput: {
                  min:
                    form.startDate ||
                    undefined,
                },
              }}
              onChange={(event) =>
                setForm(
                  (currentForm) => ({
                    ...currentForm,

                    endDate:
                      event.target.value,
                  }),
                )
              }
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={form.allDay}
                disabled={isSaving}
                onChange={(event) =>
                  setForm(
                    (currentForm) => ({
                      ...currentForm,

                      allDay:
                        event.target
                          .checked,
                    }),
                  )
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
                label="Starttid"
                type="time"
                value={
                  form.startTime
                }
                required
                disabled={isSaving}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(event) =>
                  setForm(
                    (currentForm) => ({
                      ...currentForm,

                      startTime:
                        event.target.value,
                    }),
                  )
                }
              />

              <TextField
                label="Sluttid"
                type="time"
                value={
                  form.endTime
                }
                required
                disabled={isSaving}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(event) =>
                  setForm(
                    (currentForm) => ({
                      ...currentForm,

                      endTime:
                        event.target.value,
                    }),
                  )
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
              {Object.values(
                calendarOwners,
              ).map((owner) => {
                const isSelected =
                  form.ownerIds.includes(
                    owner.id,
                  );

                return (
                  <Chip
                    key={owner.id}
                    label={owner.name}
                    clickable={
                      !isSaving
                    }
                    disabled={isSaving}
                    onClick={() =>
                      toggleOwner(
                        owner.id,
                      )
                    }
                    variant={
                      isSelected
                        ? "filled"
                        : "outlined"
                    }
                    sx={{
                      borderColor:
                        owner.color,

                      backgroundColor:
                        isSelected
                          ? owner.color
                          : "transparent",

                      color: isSelected
                        ? "#ffffff"
                        : owner.color,

                      fontWeight: 600,
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          {conflictingEvents.length >
            0 && (
            <Alert severity="warning">
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                }}
              >
                Mulig kalenderkonflikt
              </Typography>

              <Typography
                variant="body2"
                sx={{ mt: 0.5 }}
              >
                Aftalen overlapper med:
              </Typography>

              <Box
                component="ul"
                sx={{
                  mt: 0.75,
                  mb: 0,
                  pl: 2.5,
                }}
              >
                {conflictingEvents.map(
                  (conflict) => (
                    <Typography
                      key={
                        conflict.id
                      }
                      component="li"
                      variant="body2"
                    >
                      {formatConflictTime(
                        conflict,
                      )}{" "}
                      –{" "}
                      {conflict.title}
                    </Typography>
                  ),
                )}
              </Box>

              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 1,
                }}
              >
                Du kan stadig oprette
                aftalen.
              </Typography>
            </Alert>
          )}

          <TextField
            label="Sted"
            value={
              form.location
            }
            fullWidth
            disabled={isSaving}
            onChange={(event) =>
              setForm(
                (currentForm) => ({
                  ...currentForm,

                  location:
                    event.target.value,
                }),
              )
            }
          />

          <TextField
            label="Beskrivelse"
            value={
              form.description
            }
            fullWidth
            multiline
            minRows={3}
            disabled={isSaving}
            onChange={(event) =>
              setForm(
                (currentForm) => ({
                  ...currentForm,

                  description:
                    event.target.value,
                }),
              )
            }
          />

          {validationError && (
            <Alert severity="warning">
              {validationError}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
        }}
      >
        <Button
          onClick={onClose}
          disabled={isSaving}
        >
          Annuller
        </Button>

        <Button
          variant="contained"
          onClick={() =>
            void handleSubmit()
          }
          disabled={
            isSaving ||
            Boolean(
              validationError,
            )
          }
          startIcon={
            isSaving ? (
              <CircularProgress
                size={18}
                color="inherit"
              />
            ) : undefined
          }
        >
          {isSaving
            ? "Gemmer..."
            : "Opret aftale"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default NewEventDialog;