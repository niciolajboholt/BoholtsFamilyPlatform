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
import type {
  CalendarEvent,
  CalendarOwnerId,
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

function padNumber(
  value: number,
): string {
  return value
    .toString()
    .padStart(2, "0");
}

function toDateInputValue(
  date: Date,
): string {
  return [
    date.getFullYear(),
    padNumber(
      date.getMonth() + 1,
    ),
    padNumber(date.getDate()),
  ].join("-");
}

function toTimeInputValue(
  date: Date,
): string {
  return [
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
  ].join(":");
}

function subtractOneDay(
  date: Date,
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() - 1,
  );

  return result;
}

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
      ? subtractOneDay(
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

  const isSameDay =
    startDate.getFullYear() ===
      endDate.getFullYear() &&
    startDate.getMonth() ===
      endDate.getMonth() &&
    startDate.getDate() ===
      endDate.getDate();

  if (isSameDay) {
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
  const [
    formState,
    setFormState,
  ] = useState<EventFormState>(
    () =>
      createInitialFormState(
        event,
      ),
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

    setFormState(
      createInitialFormState(
        event,
      ),
    );

    setSubmitError(null);

    setIsDeleteConfirmationVisible(
      false,
    );
  }, [event, open]);

  const validationError =
    useMemo(() => {
      if (
        !formState.title.trim()
      ) {
        return "Skriv en titel til aftalen.";
      }

      if (
        !formState.startDate
      ) {
        return "Vælg en startdato.";
      }

      if (
        !formState.endDate
      ) {
        return "Vælg en slutdato.";
      }

      if (
        formState.endDate <
        formState.startDate
      ) {
        return "Slutdatoen må ikke ligge før startdatoen.";
      }

      if (
        formState.ownerIds
          .length === 0
      ) {
        return "Vælg mindst én kalender.";
      }

      if (
        !formState.allDay &&
        formState.startDate ===
          formState.endDate &&
        formState.endTime <=
          formState.startTime
      ) {
        return "Sluttidspunktet skal ligge efter starttidspunktet.";
      }

      return null;
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

  function handleToggleOwner(
    ownerId: CalendarOwnerId,
  ) {
    setFormState(
      (currentState) => {
        const isSelected =
          currentState.ownerIds.includes(
            ownerId,
          );

        return {
          ...currentState,

          ownerIds: isSelected
            ? currentState.ownerIds.filter(
                (
                  currentOwnerId,
                ) =>
                  currentOwnerId !==
                  ownerId,
              )
            : [
                ...currentState.ownerIds,
                ownerId,
              ],
        };
      },
    );
  }

  function handleStartDateChange(
    value: string,
  ) {
    setFormState(
      (currentState) => ({
        ...currentState,
        startDate: value,

        endDate:
          !currentState.endDate ||
          currentState.endDate <
            value
            ? value
            : currentState.endDate,
      }),
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
              setFormState(
                (currentState) => ({
                  ...currentState,

                  title:
                    changeEvent.target
                      .value,
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
                setFormState(
                  (currentState) => ({
                    ...currentState,

                    endDate:
                      changeEvent.target
                        .value,
                  }),
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
                  setFormState(
                    (
                      currentState,
                    ) => ({
                      ...currentState,

                      allDay:
                        changeEvent.target
                          .checked,
                    }),
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
                  setFormState(
                    (
                      currentState,
                    ) => ({
                      ...currentState,

                      startTime:
                        changeEvent.target
                          .value,
                    }),
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
                  setFormState(
                    (
                      currentState,
                    ) => ({
                      ...currentState,

                      endTime:
                        changeEvent.target
                          .value,
                    }),
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
                      handleToggleOwner(
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
              setFormState(
                (currentState) => ({
                  ...currentState,

                  location:
                    changeEvent.target
                      .value,
                }),
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
              setFormState(
                (currentState) => ({
                  ...currentState,

                  description:
                    changeEvent.target
                      .value,
                }),
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