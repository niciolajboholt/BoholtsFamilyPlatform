import { useCallback, useEffect, useState } from "react";

import { getMyFamily, type FamilyMemberDto } from "../../family/familyApi";
import {
  enqueueTaskToggle,
  listQueuedTaskToggles,
  removeQueuedTaskToggle,
} from "../preferences/offlineTaskQueueStorage";
import {
  addTask,
  clearDoneTasks,
  createTaskRoutine,
  deleteTask,
  deleteTaskRoutine,
  generateRoutineDraft,
  getTaskRoutines,
  getTasks,
  updateTask,
  type NewRoutineItemInput,
  type RoutineDraft,
  type TaskDto,
  type TaskRoutineDto,
} from "../tasksApi";

function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface UseTasksResult {
  isLoading: boolean;
  error: string | null;
  members: FamilyMemberDto[];
  date: string;
  tasks: TaskDto[];
  routines: TaskRoutineDto[];
  addNewTask: (
    name: string,
    icon: string,
    assignedMemberId?: string | null,
    timeOfDay?: string | null,
  ) => void;
  toggleDone: (taskId: string, isDone: boolean) => void;
  renameTask: (taskId: string, name: string) => void;
  setTaskIcon: (taskId: string, icon: string) => void;
  setTaskTime: (taskId: string, timeOfDay: string | null) => void;
  removeTask: (taskId: string) => void;
  clearDone: () => void;
  createRoutine: (
    name: string,
    weekdays: number[],
    items: NewRoutineItemInput[],
    assignedMemberId?: string | null,
  ) => void;
  removeRoutine: (routineId: string) => void;
  suggestRoutine: (description: string) => Promise<RoutineDraft>;
  // Fase 8: antal endnu ikke-synkroniserede offline-afkrydsninger — se
  // 31_Offline_Data_Policy.md.
  pendingOfflineChangeCount: number;
}

/**
 * Sprint 23: appens ene sted for opgave-/rutine-tilstand. "date" er dagens
 * dato i brugerens egen lokale tidszone (ikke serverens/UTC) — sat én gang
 * ved mount, da opgavesiden altid viser "i dag", ikke en valgbar dato i v1.
 */
export function useTasks(): UseTasksResult {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMemberDto[]>([]);
  const [date] = useState(() => todayLocalDateString());
  const [tasksState, setTasksState] = useState<TaskDto[]>([]);
  const [routines, setRoutines] = useState<TaskRoutineDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOfflineChangeCount, setPendingOfflineChangeCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then(async (familyResult) => {
      if (isCancelled) {
        return;
      }

      if (!familyResult.ok || !familyResult.data.family) {
        setError("Kunne ikke finde din familie.");
        setIsLoading(false);
        return;
      }

      const resolvedFamilyId = familyResult.data.family.id;
      const [tasksResult, routinesResult] = await Promise.all([
        getTasks(resolvedFamilyId, date),
        getTaskRoutines(resolvedFamilyId),
      ]);

      if (isCancelled) {
        return;
      }

      if (!tasksResult.ok) {
        setError("Kunne ikke hente opgaverne.");
      } else {
        setTasksState(tasksResult.data.tasks ?? []);
      }

      if (routinesResult.ok) {
        setRoutines(routinesResult.data.routines ?? []);
      }

      setFamilyId(resolvedFamilyId);
      setMembers(familyResult.data.members ?? []);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [date]);

  // Fase 8: afspiller ventende offline-afkrydsninger, én ad gangen (FIFO).
  // Et "ikke fundet" (404) betyder opgaven er slettet i mellemtiden — den
  // ene ændring droppes med en synlig besked, og resten af køen fortsætter
  // (jf. 31_Offline_Data_Policy.md's konfliktprincip). Enhver anden fejl
  // betyder formentlig stadig ingen forbindelse — afspilningen stoppes uden
  // at fjerne de resterende ventende ændringer. Samme mønster som
  // useShoppingList.ts's flushQueuedOperations.
  const flushQueuedTaskToggles = useCallback(async (): Promise<void> => {
    if (!familyId) {
      return;
    }

    const queue = listQueuedTaskToggles().filter((operation) => operation.familyId === familyId);

    setPendingOfflineChangeCount(queue.length);

    if (!navigator.onLine || queue.length === 0) {
      return;
    }

    for (const operation of queue) {
      const result = await updateTask(familyId, operation.taskId, { isDone: operation.isDone });

      if (result.ok && result.data.tasks) {
        removeQueuedTaskToggle(operation.id);
        setTasksState(result.data.tasks);
        setPendingOfflineChangeCount((count) => Math.max(0, count - 1));
        continue;
      }

      if (result.status === 404) {
        removeQueuedTaskToggle(operation.id);
        setPendingOfflineChangeCount((count) => Math.max(0, count - 1));
        setError("Kunne ikke synkronisere en afkrydsning — opgaven er allerede slettet.");
        continue;
      }

      // Formentlig stadig offline — stop og prøv resten igen senere.
      return;
    }
  }, [familyId]);

  useEffect(() => {
    // flushQueuedTaskToggles synchronously sets pendingOfflineChangeCount
    // from localStorage before its first await — that's the point (it must
    // reflect the resolved family right away, not after a network
    // round-trip) — same accepted pattern as useShoppingList.ts's
    // flushQueuedOperations call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void flushQueuedTaskToggles();
  }, [familyId, flushQueuedTaskToggles]);

  useEffect(() => {
    function handleOnline() {
      void flushQueuedTaskToggles();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushQueuedTaskToggles]);

  const withTaskMutation = useCallback(
    (action: () => Promise<{ ok: boolean; data: { tasks?: TaskDto[] } }>) => {
      setError(null);

      action()
        .then((result) => {
          if (result.ok && result.data.tasks) {
            setTasksState(result.data.tasks);
          } else {
            setError("Handlingen kunne ikke gennemføres. Prøv igen.");
          }
        })
        .catch(() => setError("Handlingen kunne ikke gennemføres. Prøv igen."));
    },
    [],
  );

  // Fase 8: kun af-/tilkrydsning er i første omgang tilladt at køe offline,
  // jf. 31_Offline_Data_Policy.md — samme begrundelse og mønster som
  // useShoppingList.ts's withQueueableMutation.
  const withQueueableTaskMutation = useCallback(
    (
      action: () => Promise<{ ok: boolean; data: { tasks?: TaskDto[] } }>,
      onNetworkFailure: () => void,
    ) => {
      setError(null);

      action()
        .then((result) => {
          if (result.ok && result.data.tasks) {
            setTasksState(result.data.tasks);
          } else {
            setError("Handlingen kunne ikke gennemføres. Prøv igen.");
          }
        })
        .catch(() => {
          onNetworkFailure();
          setPendingOfflineChangeCount((count) => count + 1);
        });
    },
    [],
  );

  const addNewTask = useCallback(
    (
      name: string,
      icon: string,
      assignedMemberId?: string | null,
      timeOfDay?: string | null,
    ): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId) {
        return;
      }

      withTaskMutation(() => addTask(familyId, { name: trimmed, icon, date, assignedMemberId, timeOfDay }));
    },
    [familyId, date, withTaskMutation],
  );

  const toggleDone = useCallback(
    (taskId: string, isDone: boolean): void => {
      if (!familyId) {
        return;
      }

      // Optimistisk: brugeren ser afkrydsningen med det samme, uanset om
      // forbindelsen er der eller ej — opgaven findes allerede lokalt, så
      // der er ingen midlertidigt-id-forening at bekymre sig om.
      setTasksState((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? { ...task, isDone: isDone ? 1 : 0 } : task)),
      );

      withQueueableTaskMutation(
        () => updateTask(familyId, taskId, { isDone }),
        () => enqueueTaskToggle({ familyId, taskId, isDone }),
      );
    },
    [familyId, withQueueableTaskMutation],
  );

  const renameTask = useCallback(
    (taskId: string, name: string): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId) {
        return;
      }

      withTaskMutation(() => updateTask(familyId, taskId, { name: trimmed }));
    },
    [familyId, withTaskMutation],
  );

  const setTaskIcon = useCallback(
    (taskId: string, icon: string): void => {
      if (!familyId) {
        return;
      }

      withTaskMutation(() => updateTask(familyId, taskId, { icon }));
    },
    [familyId, withTaskMutation],
  );

  const setTaskTime = useCallback(
    (taskId: string, timeOfDay: string | null): void => {
      if (!familyId) {
        return;
      }

      withTaskMutation(() => updateTask(familyId, taskId, { timeOfDay }));
    },
    [familyId, withTaskMutation],
  );

  const removeTask = useCallback(
    (taskId: string): void => {
      if (!familyId) {
        return;
      }

      withTaskMutation(() => deleteTask(familyId, taskId));
    },
    [familyId, withTaskMutation],
  );

  const clearDone = useCallback((): void => {
    if (!familyId) {
      return;
    }

    withTaskMutation(() => clearDoneTasks(familyId, date));
  }, [familyId, date, withTaskMutation]);

  const createRoutine = useCallback(
    (
      name: string,
      weekdays: number[],
      items: NewRoutineItemInput[],
      assignedMemberId?: string | null,
    ): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || weekdays.length === 0 || items.length === 0) {
        return;
      }

      setError(null);

      createTaskRoutine(familyId, { name: trimmed, weekdays, items, assignedMemberId })
        .then(async (result) => {
          if (result.ok && result.data.routine) {
            const newRoutine = result.data.routine;
            setRoutines((previousRoutines) => [...previousRoutines, newRoutine]);

            // Rutinens opgaver for i dag materialiseres server-side ved
            // næste GET — kaldes eksplicit her, så de dukker op med det
            // samme i stedet for først ved en senere sideindlæsning.
            const refreshed = await getTasks(familyId, date);
            if (refreshed.ok && refreshed.data.tasks) {
              setTasksState(refreshed.data.tasks);
            }
          } else {
            setError("Rutinen kunne ikke oprettes.");
          }
        })
        .catch(() => setError("Rutinen kunne ikke oprettes."));
    },
    [familyId, date],
  );

  const removeRoutine = useCallback(
    (routineId: string): void => {
      if (!familyId) {
        return;
      }

      setError(null);

      deleteTaskRoutine(familyId, routineId)
        .then((result) => {
          if (result.ok) {
            setRoutines((previousRoutines) =>
              previousRoutines.filter((routine) => routine.id !== routineId),
            );
          } else {
            setError("Rutinen kunne ikke slettes.");
          }
        })
        .catch(() => setError("Rutinen kunne ikke slettes."));
    },
    [familyId],
  );

  // Returnerer AI'ens forslag uden at gemme noget — UI'et forudfylder
  // navn/opgaver i opret-dialogen, men brugeren vælger stadig selv ugedage
  // og tildeling, og skal aktivt trykke "Opret" (se
  // 23_Sprint23-planen, beslutning 4).
  const suggestRoutine = useCallback(
    async (description: string): Promise<RoutineDraft> => {
      if (!familyId || !description.trim()) {
        throw new Error("Beskriv rutinen først.");
      }

      const result = await generateRoutineDraft(familyId, description.trim());

      if (!result.ok || !result.data.draft) {
        throw new Error(result.data.error ?? "Kunne ikke generere et forslag.");
      }

      return result.data.draft;
    },
    [familyId],
  );

  return {
    isLoading,
    error,
    members,
    date,
    tasks: tasksState,
    routines,
    addNewTask,
    toggleDone,
    renameTask,
    setTaskIcon,
    setTaskTime,
    removeTask,
    clearDone,
    createRoutine,
    removeRoutine,
    suggestRoutine,
    pendingOfflineChangeCount,
  };
}
