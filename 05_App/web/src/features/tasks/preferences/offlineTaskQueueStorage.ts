// Fase 8: lokal, forkastelig kø til udvalgte opgaveændringer, foretaget mens
// enheden er offline — jf. 31_Offline_Data_Policy.md, som bevidst afgrænser
// opgaver til kun af-/tilkrydsning (hverken tilføj, omdøb eller slet). Samme
// mønster og samme localStorage-teknologi som
// offlineShoppingQueueStorage.ts — ikke slået sammen til én delt, generisk
// kø, da de to domæner (indkøbsvarer har flere tilladte operationstyper og
// er scopet pr. liste; opgaver har kun denne ene og er scopet pr. dato) ikke
// deler nok struktur til at gøre en fælles abstraktion enklere end to små,
// selvstændige moduler.

const STORAGE_KEY = "boholts-family-offline-task-queue";

export interface QueuedTaskToggle {
  id: string;
  familyId: string;
  taskId: string;
  isDone: boolean;
  createdAt: string;
}

function isQueuedTaskToggle(value: unknown): value is QueuedTaskToggle {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<QueuedTaskToggle>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.familyId === "string" &&
    typeof candidate.taskId === "string" &&
    typeof candidate.isDone === "boolean" &&
    typeof candidate.createdAt === "string"
  );
}

export function listQueuedTaskToggles(): QueuedTaskToggle[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isQueuedTaskToggle);
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedTaskToggle[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueTaskToggle(operation: Omit<QueuedTaskToggle, "id" | "createdAt">): void {
  const queue = listQueuedTaskToggles();

  queue.push({
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });

  saveQueue(queue);
}

export function removeQueuedTaskToggle(operationId: string): void {
  saveQueue(listQueuedTaskToggles().filter((operation) => operation.id !== operationId));
}
