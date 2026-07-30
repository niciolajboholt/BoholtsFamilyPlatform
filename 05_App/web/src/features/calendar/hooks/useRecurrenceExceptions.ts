import { useCallback, useState } from "react";

import type {
  RecurrenceException,
  RecurrenceExceptionOverride,
} from "../preferences/recurrenceExceptionsStorage";
import {
  deleteRecurrenceExceptionsForMaster,
  getRecurrenceExceptions,
  upsertRecurrenceException,
} from "../preferences/recurrenceExceptionsStorage";

interface UseRecurrenceExceptionsResult {
  exceptions: RecurrenceException[];
  cancelOccurrence: (masterEventId: string, occurrenceStart: string) => void;
  modifyOccurrence: (
    masterEventId: string,
    occurrenceStart: string,
    override: RecurrenceExceptionOverride,
  ) => void;
  clearExceptionsForMaster: (masterEventId: string) => void;
}

export function useRecurrenceExceptions(): UseRecurrenceExceptionsResult {
  const [exceptions, setExceptions] = useState<RecurrenceException[]>(() =>
    getRecurrenceExceptions(),
  );

  const cancelOccurrence = useCallback(
    (masterEventId: string, occurrenceStart: string): void => {
      setExceptions(
        upsertRecurrenceException(masterEventId, occurrenceStart, {
          type: "cancelled",
        }),
      );
    },
    [],
  );

  const modifyOccurrence = useCallback(
    (
      masterEventId: string,
      occurrenceStart: string,
      override: RecurrenceExceptionOverride,
    ): void => {
      setExceptions(
        upsertRecurrenceException(masterEventId, occurrenceStart, {
          type: "modified",
          override,
        }),
      );
    },
    [],
  );

  const clearExceptionsForMaster = useCallback(
    (masterEventId: string): void => {
      setExceptions(deleteRecurrenceExceptionsForMaster(masterEventId));
    },
    [],
  );

  return {
    exceptions,
    cancelOccurrence,
    modifyOccurrence,
    clearExceptionsForMaster,
  };
}
