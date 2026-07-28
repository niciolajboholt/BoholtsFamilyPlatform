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
import {
  createAllDayDate,
  createDateTime,
  ensureEndDateOnOrAfterStartDate,
  isSameCalendarDate,
  toDateInputValue,
} from "../form/eventFormDateUtils";
import type { EventFormState } from "../form/eventFormTypes";
import { useEventConflicts } from "../form/useEventConflicts";
import { useEventFormState } from "../form/useEventFormState";
import { useEventValidation } from "../form/useEventValidation";
import {
  type EventFormValidationMessages,
} from "../form/eventFormValidation";
import type {
  CalendarEvent,
} from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../services/CalendarService";

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

const validationMessages: EventFormValidationMessages = {
  titleRequired: "Skriv en titel på aftalen.",
  startDateRequired: "Vælg en startdato.",
  endDateRequired: "Vælg en slutdato.",
  endDateBeforeStartDate:
    "Slutdatoen må ikke ligge før startdatoen.",
  ownerRequired: "Vælg mindst én kalender.",
  endTimeBeforeStartTime:
    "Sluttidspunktet skal ligge efter starttidspunktet.",
};

function createInitialState(
  initialDate: Date,
): EventFormState {
  const date =
    toDateInputValue(initialDate);

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
  const initialFormState =
    useMemo(
      () => createInitialState(initialDate),
      [initialDate],
    );

  const {
    values: form,
    setField,
    reset,
    toggleParticipant,
  } = useEventFormState(
    initialFormState,
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

    reset();

    setSubmitError(null);
  }, [
    open,
    initialDate,
    reset,
  ]);

  const { validationErrorCode } =
    useEventValidation(form);

  const validationError =
    validationErrorCode
      ? validationMessages[
          validationErrorCode
        ]
      : null;

  const {
    conflicts: conflictingEvents,
  } = useEventConflicts({
    form,
    events,
    validationError,
  });

  function handleStartDateChange(
    startDate: string,
  ) {
    setField("startDate", startDate);

    setField(
      "endDate",
      ensureEndDateOnOrAfterStartDate(
        startDate,
        form.endDate,
      ),
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
              setField(
                "title",
                event.target.value,
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
                setField(
                  "endDate",
                  event.target.value,
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
                  setField(
                    "allDay",
                    event.target.checked,
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
                  setField(
                    "startTime",
                    event.target.value,
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
                  setField(
                    "endTime",
                    event.target.value,
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
                      toggleParticipant(
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
              setField(
                "location",
                event.target.value,
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
              setField(
                "description",
                event.target.value,
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
