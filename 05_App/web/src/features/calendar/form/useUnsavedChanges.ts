import { useMemo } from "react";

import type { EventFormState } from "./eventFormTypes";

function haveSameOwnerIds(
  firstOwnerIds: EventFormState["ownerIds"],
  secondOwnerIds: EventFormState["ownerIds"],
): boolean {
  if (
    firstOwnerIds.length !==
    secondOwnerIds.length
  ) {
    return false;
  }

  const sortedFirstOwnerIds = [
    ...firstOwnerIds,
  ].sort();
  const sortedSecondOwnerIds = [
    ...secondOwnerIds,
  ].sort();

  return sortedFirstOwnerIds.every(
    (ownerId, index) =>
      ownerId === sortedSecondOwnerIds[index],
  );
}

function areEventFormStatesEqual(
  initialValues: EventFormState,
  currentValues: EventFormState,
): boolean {
  return (
    initialValues.title === currentValues.title &&
    initialValues.startDate ===
      currentValues.startDate &&
    initialValues.endDate === currentValues.endDate &&
    initialValues.startTime ===
      currentValues.startTime &&
    initialValues.endTime === currentValues.endTime &&
    initialValues.allDay === currentValues.allDay &&
    initialValues.description ===
      currentValues.description &&
    initialValues.location === currentValues.location &&
    haveSameOwnerIds(
      initialValues.ownerIds,
      currentValues.ownerIds,
    )
  );
}

export interface UseUnsavedChangesResult {
  isDirty: boolean;
}

export function useUnsavedChanges(
  initialValues: EventFormState,
  currentValues: EventFormState,
): UseUnsavedChangesResult {
  const isDirty = useMemo(
    () =>
      !areEventFormStatesEqual(
        initialValues,
        currentValues,
      ),
    [initialValues, currentValues],
  );

  return { isDirty };
}
