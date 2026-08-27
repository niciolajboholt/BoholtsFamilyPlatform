// Fase 8: lokal, forkastelig kø til udvalgte indkøbslisteændringer, foretaget
// mens enheden er offline — jf. 31_Offline_Data_Policy.md, som bevidst
// afgrænser første iteration til tilføj vare og af-/tilkryds vare (ikke ryd
// afkrydsede eller opgaver — de kommer i en senere PR). Samme
// localStorage-mønster som resten af appens klient-tilstand (fx
// googleCalendarSyncCacheStorage.ts), ikke en ny persistens-teknologi.

const STORAGE_KEY = "boholts-family-offline-shopping-queue";

export interface QueuedAddShoppingItem {
  type: "add-item";
  id: string;
  familyId: string;
  listId: string;
  name: string;
  createdAt: string;
}

export interface QueuedToggleShoppingItem {
  type: "toggle-item";
  id: string;
  familyId: string;
  listId: string;
  itemId: string;
  isChecked: boolean;
  createdAt: string;
}

export type QueuedShoppingOperation = QueuedAddShoppingItem | QueuedToggleShoppingItem;

// Omit<Union, K> collapses to the union members' COMMON keys only (keyof of
// a union is an intersection) — this distributes it over each member first,
// so add-item keeps `name` and toggle-item keeps `itemId`/`isChecked`.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function isQueuedShoppingOperation(value: unknown): value is QueuedShoppingOperation {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<QueuedShoppingOperation>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.familyId !== "string" ||
    typeof candidate.listId !== "string" ||
    typeof candidate.createdAt !== "string"
  ) {
    return false;
  }

  if (candidate.type === "add-item") {
    return typeof (candidate as QueuedAddShoppingItem).name === "string";
  }

  if (candidate.type === "toggle-item") {
    const toggle = candidate as QueuedToggleShoppingItem;
    return typeof toggle.itemId === "string" && typeof toggle.isChecked === "boolean";
  }

  return false;
}

export function listQueuedShoppingOperations(): QueuedShoppingOperation[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isQueuedShoppingOperation);
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedShoppingOperation[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueShoppingOperation(
  operation: DistributiveOmit<QueuedShoppingOperation, "id" | "createdAt">,
): void {
  const queue = listQueuedShoppingOperations();

  queue.push({
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });

  saveQueue(queue);
}

export function removeQueuedShoppingOperation(operationId: string): void {
  saveQueue(listQueuedShoppingOperations().filter((operation) => operation.id !== operationId));
}
