import {
  useCallback,
  useState,
} from "react";

import type { CalendarOwnerId } from "../models/calendarEvent";
import type { EventFormState } from "./eventFormTypes";

interface UseEventFormStateResult {
  values: EventFormState;
  setField: <FieldName extends keyof EventFormState>(
    name: FieldName,
    value: EventFormState[FieldName],
  ) => void;
  reset: (
    nextInitialValues?: EventFormState,
  ) => void;
  toggleParticipant: (
    participantId: CalendarOwnerId,
  ) => void;
}

export function useEventFormState(
  initialValues: EventFormState,
): UseEventFormStateResult {
  const [values, setValues] =
    useState<EventFormState>(initialValues);

  const setField = useCallback(
    <FieldName extends keyof EventFormState>(
      name: FieldName,
      value: EventFormState[FieldName],
    ): void => {
      setValues((currentValues) => ({
        ...currentValues,
        [name]: value,
      }));
    },
    [],
  );

  const reset = useCallback(
    (
      nextInitialValues?: EventFormState,
    ): void => {
      setValues(
        nextInitialValues ??
          initialValues,
      );
    },
    [initialValues],
  );

  const toggleParticipant = useCallback(
    (
      participantId: CalendarOwnerId,
    ): void => {
      setValues((currentValues) => {
        const isSelected =
          currentValues.ownerIds.includes(
            participantId,
          );

        return {
          ...currentValues,
          ownerIds: isSelected
            ? currentValues.ownerIds.filter(
                (ownerId) =>
                  ownerId !== participantId,
              )
            : [
                ...currentValues.ownerIds,
                participantId,
              ],
        };
      });
    },
    [],
  );

  return {
    values,
    setField,
    reset,
    toggleParticipant,
  };
}
