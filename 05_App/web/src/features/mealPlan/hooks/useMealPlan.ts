import { useCallback, useEffect, useMemo, useState } from "react";

import { getStartOfWeek, getWeekDays } from "../../calendar/utils/getWeekDays";
import { toDateInputValue } from "../../calendar/form/eventFormDateUtils";
import { useFamilyId } from "../../calendar/hooks/useFamilyId";
import {
  generateMealPlanIngredientsDraft,
  getMealPlanEntries,
  setMealPlanEntry,
  type MealPlanIngredientDraftItem,
} from "../mealPlanApi";

export interface MealPlanDay {
  date: string;
  dishName: string;
}

export function useMealPlan() {
  const familyId = useFamilyId();
  const [weekStart, setWeekStart] = useState<Date>(() => getStartOfWeek(new Date()));
  const [dishesByDate, setDishesByDate] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekDates = useMemo(() => getWeekDays(weekStart).map(toDateInputValue), [weekStart]);
  const startDate = weekDates[0]!;
  const endDate = weekDates[6]!;

  // isLoading dækker bevidst kun det allerførste opslag (spinner ved
  // mount) — et uge-skifte genindlæser i baggrunden uden at rydde/skjule
  // den allerede viste uge, så et klik på "næste uge" ikke flimrer med en
  // spinner for en normalt hurtig D1-forespørgsel.
  useEffect(() => {
    if (!familyId) {
      return;
    }

    let isCancelled = false;

    getMealPlanEntries(familyId, startDate, endDate).then((result) => {
      if (isCancelled) {
        return;
      }

      if (result.ok && result.data.entries) {
        setDishesByDate(new Map(result.data.entries.map((entry) => [entry.date, entry.dishName])));
        setError(null);
      } else {
        setError(result.data.error ?? "Kunne ikke hente måltidsplanen.");
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [familyId, startDate, endDate]);

  const days: MealPlanDay[] = weekDates.map((date) => ({
    date,
    dishName: dishesByDate.get(date) ?? "",
  }));

  const setDish = useCallback(
    async (date: string, dishName: string): Promise<void> => {
      if (!familyId) {
        return;
      }

      // Optimistisk — samme mønster som resten af appens småredigeringer
      // (fx opgavens navn), så et tastet felt ikke springer tilbage, mens
      // svaret afventes.
      setDishesByDate((previous) => {
        const next = new Map(previous);
        if (dishName.trim()) {
          next.set(date, dishName.trim());
        } else {
          next.delete(date);
        }
        return next;
      });

      const result = await setMealPlanEntry(familyId, date, dishName);

      if (!result.ok) {
        setError(result.data.error ?? "Kunne ikke gemme retten.");
      }
    },
    [familyId],
  );

  const generateIngredientsDraft = useCallback(
    async (listId: string): Promise<MealPlanIngredientDraftItem[]> => {
      if (!familyId) {
        return [];
      }

      const result = await generateMealPlanIngredientsDraft(familyId, listId, startDate, endDate);

      if (!result.ok || !result.data.items) {
        throw new Error(result.data.error ?? "Kunne ikke generere et forslag.");
      }

      return result.data.items;
    },
    [familyId, startDate, endDate],
  );

  return {
    weekStart,
    days,
    isLoading,
    error,
    goToPreviousWeek: () => {
      const previous = new Date(weekStart);
      previous.setDate(previous.getDate() - 7);
      setWeekStart(previous);
    },
    goToNextWeek: () => {
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      setWeekStart(next);
    },
    goToThisWeek: () => setWeekStart(getStartOfWeek(new Date())),
    setDish,
    generateIngredientsDraft,
    hasAnyDish: days.some((day) => day.dishName.trim().length > 0),
  };
}
