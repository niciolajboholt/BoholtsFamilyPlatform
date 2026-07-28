import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
import {
  createAllDayDate,
  createDateTime,
  ensureEndDateOnOrAfterStartDate,
  isSameCalendarDate,
  subtractOneCalendarDay,
  toDateInputValue,
  toTimeInputValue,
} from "../form/eventFormDateUtils";
import type { EventFormState } from "../form/eventFormTypes";
import { useEventFormState } from "../form/useEventFormState";
import {
  type EventFormValidationMessages,
  validateEventForm,
} from "../form/eventFormValidation";
import type {
  CalendarEvent,
} from "../models/calendarEvent";
import { findEventConflicts } from "../utils/findEventConflicts";

interface EditEventDialogProps {
  open: boolean;
  event: CalendarEvent | null;
  events: CalendarEvent[];
  isSaving: boolean;
  onClose: () => void;
  onUpdate: (
    event: CalendarEvent,
  ) => Promise<void>;
  onDelete: (
    eventId: string,
  ) => Promise<void>;
}

const validationMessages: EventFormValidationMessages = {
  titleRequired: "Skriv en titel til aftalen.",
  startDateRequired: "Vælg en startdato.",
  endDateRequired: "Vælg en slutdato.",
  endDateBeforeStartDate:
    "Slutdatoen må ikke ligge før startdatoen.",
  ownerRequired: "Vælg mindst én kalender.",
  endTimeBeforeStartTime:
    "Sluttidspunktet skal ligge efter starttidspunktet.",
};

function createInitialFormState(
  event: CalendarEvent | null,
): EventFormState {
  if (!event) {
    return {
      title: "",
      startDate: "",
      endDate: "",
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      ownerIds: [],
      description: "",
      location: "",
    };
  }

  const startDate = new Date(
    event.start,
  );

  const storedEndDate = new Date(
    event.end,
  );

  const visibleEndDate =
    event.allDay
      ? subtractOneCalendarDay(
          storedEndDate,
        )
      : storedEndDate;

  return {
    title: event.title,
    startDate:
      toDateInputValue(
        startDate,
      ),
    endDate:
      toDateInputValue(
        visibleEndDate,
      ),
    startTime:
      toTimeInputValue(
        startDate,
      ),
    endTime:
      toTimeInputValue(
        storedEndDate,
      ),
    allDay: event.allDay,
    ownerIds: [
      ...event.ownerIds,
    ],
    description:
      event.description ?? "",
    location:
      event.location ?? "",
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

  const startDate = new Date(
    event.start,
  );

  const endDate = new Date(
    event.end,
  );

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

function EditEventDialog({
  open,
  event,
  events,
  isSaving,
  onClose,
  onUpdate,
  onDelete,
}: EditEventDialogProps) {
  const initialFormState =
    useMemo(
      () => createInitialFormState(event),
      [event],
    );

  const {
    values: formState,
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

  const [
    isDeleteConfirmationVisible,
    setIsDeleteConfirmationVisible,
  ] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    reset();

    setSubmitError(null);

    setIsDeleteConfirmationVisible(
      false,
    );
  }, [event, open, reset]);

  const validationError =
    useMemo(() => {
      const validationErrorCode =
        validateEventForm(formState);

      return validationErrorCode
        ? validationMessages[
            validationErrorCode
          ]
        : null;
    }, [formState]);

  const candidateEvent =
    useMemo(() => {
      if (
        !formState.startDate ||
        !formState.endDate ||
        formState.ownerIds
          .length === 0 ||
        validationError
      ) {
        return null;
      }

      return {
        start: formState.allDay
          ? createAllDayDate(
              formState.startDate,
              false,
            )
          : createDateTime(
              formState.startDate,
              formState.startTime,
            ),

        end: formState.allDay
          ? createAllDayDate(
              formState.endDate,
              true,
            )
          : createDateTime(
              formState.endDate,
              formState.endTime,
            ),

        ownerIds:
          formState.ownerIds,
      };
    }, [
      formState,
      validationError,
    ]);

  const conflictingEvents =
    useMemo(() => {
      if (
        !candidateEvent ||
        !event
      ) {
        return [];
      }

      return findEventConflicts(
        candidateEvent,
        events,
        event.id,
      );
    }, [
      candidateEvent,
      event,
      events,
    ]);

  function handleStartDateChange(
    value: string,
  ) {
    setField("startDate", value);

    setField(
      "endDate",
      ensureEndDateOnOrAfterStartDate(
        value,
        formState.endDate,
      ),
    );
  }

  async function handleSubmit() {
    if (
      !event ||
      validationError
    ) {
      return;
    }

    setSubmitError(null);

    const start =
      formState.allDay
        ? createAllDayDate(
            formState.startDate,
            false,
          )
        : createDateTime(
            formState.startDate,
            formState.startTime,
          );

    const end =
      formState.allDay
        ? createAllDayDate(
            formState.endDate,
            true,
          )
        : createDateTime(
            formState.endDate,
            formState.endTime,
          );

    const updatedEvent: CalendarEvent =
      {
        ...event,

        title:
          formState.title.trim(),

        start,
        end,

        allDay:
          formState.allDay,

        ownerIds: [
          ...formState.ownerIds,
        ],

        description:
          formState.description.trim() ||
          undefined,

        location:
          formState.location.trim() ||
          undefined,
      };

    try {
      await onUpdate(
        updatedEvent,
      );

      onClose();
    } catch (
      caughtError: unknown
    ) {
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
      await onDelete(
        event.id,
      );

      onClose();
    } catch (
      caughtError: unknown
    ) {
      setSubmitError(
        caughtError instanceof Error
          ? caughtError.message
          : "Aftalen kunne ikke slettes.",
      );
    }
  }

  const isInternalEvent =
    event?.source ===
    "internal";

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
        Rediger aftale
      </DialogTitle>

      <DialogContent>
        <Box
          sx={{
            display: "flex",
            flexDirection:
              "column",
            gap: 2,
            pt: 1,
          }}
        >
          {!isInternalEvent && (
            <Alert severity="info">
              Kun interne aftaler kan
              redigeres eller slettes.
            </Alert>
          )}

          {submitError && (
            <Alert severity="error">
              {submitError}
            </Alert>
          )}

          <TextField
            label="Titel"
            value={
              formState.title
            }
            disabled={
              !isInternalEvent ||
              isSaving
            }
            required
            autoFocus
            onChange={(changeEvent) =>
              setField(
                "title",
                changeEvent.target.value,
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
                formState.startDate
              }
              disabled={
                !isInternalEvent ||
                isSaving
              }
              required
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
              onChange={(changeEvent) =>
                handleStartDateChange(
                  changeEvent.target
                    .value,
                )
              }
            />

            <TextField
              label="Slutdato"
              type="date"
              value={
                formState.endDate
              }
              disabled={
                !isInternalEvent ||
                isSaving
              }
              required
              slotProps={{
                inputLabel: {
                  shrink: true,
                },

                htmlInput: {
                  min:
                    formState.startDate ||
                    undefined,
                },
              }}
              onChange={(changeEvent) =>
                setField(
                  "endDate",
                  changeEvent.target.value,
                )
              }
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={
                  formState.allDay
                }
                disabled={
                  !isInternalEvent ||
                  isSaving
                }
                onChange={(changeEvent) =>
                  setField(
                    "allDay",
                    changeEvent.target.checked,
                  )
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
                label="Starttid"
                type="time"
                value={
                  formState.startTime
                }
                disabled={
                  !isInternalEvent ||
                  isSaving
                }
                required
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(changeEvent) =>
                  setField(
                    "startTime",
                    changeEvent.target.value,
                  )
                }
              />

              <TextField
                label="Sluttid"
                type="time"
                value={
                  formState.endTime
                }
                disabled={
                  !isInternalEvent ||
                  isSaving
                }
                required
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                onChange={(changeEvent) =>
                  setField(
                    "endTime",
                    changeEvent.target.value,
                  )
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

            {Object.values(
              calendarOwners,
            ).map((owner) => (
              <FormControlLabel
                key={owner.id}
                control={
                  <Checkbox
                    checked={
                      formState.ownerIds.includes(
                        owner.id,
                      )
                    }
                    disabled={
                      !isInternalEvent ||
                      isSaving
                    }
                    onChange={() =>
                      toggleParticipant(
                        owner.id,
                      )
                    }
                  />
                }
                label={owner.name}
              />
            ))}
          </Box>

          {conflictingEvents.length >
            0 &&
            isInternalEvent && (
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
                  Aftalen overlapper
                  med:
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
                    display:
                      "block",
                    mt: 1,
                  }}
                >
                  Du kan stadig gemme
                  ændringerne.
                </Typography>
              </Alert>
            )}

          <TextField
            label="Sted"
            value={
              formState.location
            }
            disabled={
              !isInternalEvent ||
              isSaving
            }
            onChange={(changeEvent) =>
              setField(
                "location",
                changeEvent.target.value,
              )
            }
          />

          <TextField
            label="Beskrivelse"
            value={
              formState.description
            }
            disabled={
              !isInternalEvent ||
              isSaving
            }
            multiline
            minRows={3}
            onChange={(changeEvent) =>
              setField(
                "description",
                changeEvent.target.value,
              )
            }
          />

          {validationError &&
            isInternalEvent && (
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
                  onClick={() =>
                    void handleDelete()
                  }
                >
                  Bekræft sletning
                </Button>
              }
            >
              Aftalen slettes fra denne
              browser. Den kan
              efterfølgende gendannes
              via Fortryd.
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 2,

          justifyContent:
            "space-between",
        }}
      >
        <Button
          color="error"
          startIcon={
            <DeleteOutlineIcon />
          }
          disabled={
            !isInternalEvent ||
            isSaving
          }
          onClick={() =>
            setIsDeleteConfirmationVisible(
              true,
            )
          }
        >
          Slet
        </Button>

        <Box
          sx={{
            display: "flex",
            gap: 1,
          }}
        >
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
              Boolean(
                validationError,
              )
            }
            onClick={() =>
              void handleSubmit()
            }
          >
            {isSaving
              ? "Gemmer..."
              : "Gem ændringer"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default EditEventDialog;
