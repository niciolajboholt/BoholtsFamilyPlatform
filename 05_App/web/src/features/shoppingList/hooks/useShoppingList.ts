import { useCallback, useEffect, useState } from "react";

import { getMyFamily } from "../../family/familyApi";
import {
  enqueueShoppingOperation,
  listQueuedShoppingOperations,
  removeQueuedShoppingOperation,
} from "../preferences/offlineShoppingQueueStorage";
import {
  addShoppingListItem,
  addShoppingListTemplateItem,
  clearCheckedShoppingListItems,
  createShoppingList,
  deleteShoppingList,
  deleteShoppingListItem,
  deleteShoppingListTemplate,
  deleteShoppingListTemplateItem,
  generateIngredientsDraft,
  getShoppingListItems,
  getShoppingListTemplates,
  getShoppingLists,
  renameShoppingListItem,
  renameShoppingListTemplate,
  saveShoppingListAsTemplate,
  setShoppingListItemCategory,
  setShoppingListItemChecked,
  updateShoppingList,
  type IngredientDraftItem,
  type ShoppingCategory,
  type ShoppingListDto,
  type ShoppingListItemDto,
  type ShoppingListTemplateDto,
  type ShoppingListType,
} from "../shoppingListApi";

interface UseShoppingListResult {
  isLoading: boolean;
  error: string | null;
  lists: ShoppingListDto[];
  selectedListId: string | null;
  selectList: (listId: string) => void;
  createList: (name: string, type: ShoppingListType) => void;
  updateList: (updates: { name?: string; type?: ShoppingListType }) => Promise<void>;
  deleteList: () => Promise<void>;
  items: ShoppingListItemDto[];
  addItem: (name: string) => void;
  toggleChecked: (itemId: string, isChecked: boolean) => void;
  setCategory: (itemId: string, category: ShoppingCategory) => void;
  renameItem: (itemId: string, name: string) => void;
  deleteItem: (itemId: string) => void;
  clearChecked: () => void;
  suggestIngredients: (dish: string) => Promise<IngredientDraftItem[]>;
  addSuggestedItems: (itemNames: string[]) => Promise<void>;
  templates: ShoppingListTemplateDto[];
  saveAsTemplate: (name: string) => Promise<void>;
  applyTemplate: (templateId: string) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  renameTemplate: (templateId: string, name: string) => Promise<void>;
  addTemplateItem: (templateId: string, name: string) => Promise<void>;
  deleteTemplateItem: (templateId: string, itemId: string) => Promise<void>;
  // Fase 8: antal endnu ikke-synkroniserede offline-ændringer (tilføj/
  // afkryds vare) for den valgte liste — se 31_Offline_Data_Policy.md.
  pendingOfflineChangeCount: number;
}

/**
 * Sprint 21, Del B (udvidet i Sprint 22): appens ene sted for
 * indkøbsliste-tilstand. Familien kan have flere navngivne lister
 * (hver med en fast type, der styrer kategoriseringen) — hooket henter dem
 * alle, vælger den første som udgangspunkt, og lader UI'et skifte mellem
 * dem eller oprette nye.
 */
export function useShoppingList(): UseShoppingListResult {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [lists, setLists] = useState<ShoppingListDto[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingListItemDto[]>([]);
  const [templates, setTemplates] = useState<ShoppingListTemplateDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingOfflineChangeCount, setPendingOfflineChangeCount] = useState(0);

  // Henter familien og dens lister ved mount.
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
      const listsResult = await getShoppingLists(resolvedFamilyId);

      if (isCancelled) {
        return;
      }

      const firstList = listsResult.data.lists?.[0];

      if (!listsResult.ok || !firstList) {
        setError("Kunne ikke hente indkøbslisterne.");
        setIsLoading(false);
        return;
      }

      setFamilyId(resolvedFamilyId);
      setLists(listsResult.data.lists ?? []);
      setSelectedListId(firstList.id);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Henter varerne for den valgte liste — kører igen, hver gang
  // selectedListId skifter (inkl. første gang, når mount-effekten ovenfor
  // har sat den).
  useEffect(() => {
    if (!familyId || !selectedListId) {
      return;
    }

    let isCancelled = false;

    getShoppingListItems(familyId, selectedListId).then((itemsResult) => {
      if (isCancelled) {
        return;
      }

      if (!itemsResult.ok) {
        setError("Kunne ikke hente varerne.");
      } else {
        setItems(itemsResult.data.items ?? []);
      }

      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [familyId, selectedListId]);

  // Skabeloner er scopet til den valgte listes type (server-side) — hentes
  // derfor på samme betingelse og ved samme skift som varerne ovenfor, men i
  // sin egen effekt, da de to ikke afhænger af hinandens svar.
  useEffect(() => {
    if (!familyId || !selectedListId) {
      return;
    }

    let isCancelled = false;

    getShoppingListTemplates(familyId, selectedListId).then((templatesResult) => {
      if (isCancelled) {
        return;
      }

      if (templatesResult.ok) {
        setTemplates(templatesResult.data.templates ?? []);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [familyId, selectedListId]);

  // Fase 8: afspiller ventende offline-ændringer for den VALGTE liste, én ad
  // gangen (FIFO) — kun poster for netop denne liste, andre listers ventende
  // ændringer rører vi ikke her (de afspilles, når/hvis brugeren vælger dem).
  // Et "ikke fundet" (404) betyder målet (vare/liste) er slettet i
  // mellemtiden — den ene ændring droppes med en synlig besked, og resten af
  // køen fortsætter (jf. 31_Offline_Data_Policy.md's konfliktprincip). Enhver
  // anden fejl betyder formentlig stadig ingen forbindelse — afspilningen
  // stoppes uden at fjerne de resterende ventende ændringer, som forsøges
  // igen ved næste mulighed.
  const flushQueuedOperations = useCallback(async (): Promise<void> => {
    if (!familyId || !selectedListId) {
      return;
    }

    const queue = listQueuedShoppingOperations().filter(
      (operation) => operation.familyId === familyId && operation.listId === selectedListId,
    );

    setPendingOfflineChangeCount(queue.length);

    if (!navigator.onLine || queue.length === 0) {
      return;
    }

    for (const operation of queue) {
      let result: { ok: boolean; status: number; data: { items?: ShoppingListItemDto[] } };

      if (operation.type === "add-item") {
        result = await addShoppingListItem(familyId, selectedListId, operation.name);
      } else {
        result = await setShoppingListItemChecked(
          familyId,
          selectedListId,
          operation.itemId,
          operation.isChecked,
        );
      }

      if (result.ok && result.data.items) {
        removeQueuedShoppingOperation(operation.id);
        setItems(result.data.items);
        setPendingOfflineChangeCount((count) => Math.max(0, count - 1));
        continue;
      }

      if (result.status === 404) {
        removeQueuedShoppingOperation(operation.id);
        setPendingOfflineChangeCount((count) => Math.max(0, count - 1));
        setError(
          operation.type === "add-item"
            ? `Kunne ikke tilføje "${operation.name}" — listen findes ikke længere.`
            : "Kunne ikke synkronisere en afkrydsning — varen er allerede slettet.",
        );
        continue;
      }

      // Formentlig stadig offline — stop og prøv resten igen senere.
      return;
    }
  }, [familyId, selectedListId]);

  useEffect(() => {
    // flushQueuedOperations synchronously sets pendingOfflineChangeCount
    // from localStorage before its first await — that's the point (it must
    // reflect the newly selected list right away, not after a network
    // round-trip) — same accepted pattern as useCalendarEvents.ts's
    // refreshEvents() call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void flushQueuedOperations();
  }, [familyId, selectedListId, flushQueuedOperations]);

  useEffect(() => {
    function handleOnline() {
      void flushQueuedOperations();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushQueuedOperations]);

  const selectList = useCallback((listId: string): void => {
    setIsLoading(true);
    setSelectedListId(listId);
  }, []);

  const createList = useCallback(
    (name: string, type: ShoppingListType): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId) {
        return;
      }

      setError(null);

      createShoppingList(familyId, trimmed, type)
        .then((result) => {
          if (result.ok && result.data.list) {
            const newList = result.data.list;
            setLists((previousLists) => [...previousLists, newList]);
            setIsLoading(true);
            setSelectedListId(newList.id);
          } else {
            setError("Listen kunne ikke oprettes.");
          }
        })
        .catch(() => setError("Listen kunne ikke oprettes."));
    },
    [familyId],
  );

  const updateList = useCallback(
    async (updates: { name?: string; type?: ShoppingListType }): Promise<void> => {
      if (!familyId || !selectedListId) {
        return;
      }

      const trimmedUpdates = updates.name !== undefined ? { ...updates, name: updates.name.trim() } : updates;
      if (trimmedUpdates.name !== undefined && !trimmedUpdates.name) {
        return;
      }

      setError(null);

      const result = await updateShoppingList(familyId, selectedListId, trimmedUpdates);

      if (result.ok && result.data.list) {
        const updatedList = result.data.list;
        setLists((previousLists) =>
          previousLists.map((list) => (list.id === updatedList.id ? updatedList : list)),
        );
      } else {
        setError("Listen kunne ikke opdateres.");
      }
    },
    [familyId, selectedListId],
  );

  // Efter sletning af den valgte liste vælges den første resterende — er
  // familien nu helt uden lister, hentes de igen, hvilket automatisk
  // opretter en ny, tom standardliste (samme logik som ved allerførste
  // besøg, se getShoppingLists' server-side "auto-creates a default list").
  const deleteList = useCallback(async (): Promise<void> => {
    if (!familyId || !selectedListId) {
      return;
    }

    setError(null);

    const result = await deleteShoppingList(familyId, selectedListId);

    if (!result.ok || !result.data.lists) {
      setError("Listen kunne ikke slettes.");
      return;
    }

    if (result.data.lists.length > 0) {
      setLists(result.data.lists);
      setIsLoading(true);
      setSelectedListId(result.data.lists[0]!.id);
      return;
    }

    const refetched = await getShoppingLists(familyId);
    if (refetched.ok && refetched.data.lists && refetched.data.lists.length > 0) {
      setLists(refetched.data.lists);
      setIsLoading(true);
      setSelectedListId(refetched.data.lists[0]!.id);
    } else {
      setLists([]);
      setSelectedListId(null);
    }
  }, [familyId, selectedListId]);

  const withMutation = useCallback(
    (action: () => Promise<{ ok: boolean; data: { items?: ShoppingListItemDto[] } }>) => {
      setError(null);

      action()
        .then((result) => {
          if (result.ok && result.data.items) {
            setItems(result.data.items);
          } else {
            setError("Handlingen kunne ikke gennemføres. Prøv igen.");
          }
        })
        .catch(() => setError("Handlingen kunne ikke gennemføres. Prøv igen."));
    },
    [],
  );

  // Fase 8: kun tilføj og af-/tilkryds vare er i første omgang tilladt at
  // køe offline, jf. 31_Offline_Data_Policy.md — enhver anden mutation
  // bruger fortsat withMutation ovenfor uændret. Et THROWN fetch-svar (ikke
  // et opløst { ok: false }) er reelt set altid et netværksproblem
  // (shoppingListApi.ts's request() fanger aldrig selve fetch-fejlen), så
  // det er sikkert at behandle det som "vi er nok offline" og køe ændringen
  // i stedet for at vise en generisk fejl, brugeren ikke selv kan rette.
  const withQueueableMutation = useCallback(
    (
      action: () => Promise<{ ok: boolean; data: { items?: ShoppingListItemDto[] } }>,
      onNetworkFailure: () => void,
    ) => {
      setError(null);

      action()
        .then((result) => {
          if (result.ok && result.data.items) {
            setItems(result.data.items);
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

  const addItem = useCallback(
    (name: string): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || !selectedListId) {
        return;
      }

      withQueueableMutation(
        () => addShoppingListItem(familyId, selectedListId, trimmed),
        () =>
          enqueueShoppingOperation({
            type: "add-item",
            familyId,
            listId: selectedListId,
            name: trimmed,
          }),
      );
    },
    [familyId, selectedListId, withQueueableMutation],
  );

  const toggleChecked = useCallback(
    (itemId: string, isChecked: boolean): void => {
      if (!familyId || !selectedListId) {
        return;
      }

      // Optimistisk: brugeren ser afkrydsningen med det samme, uanset om
      // forbindelsen er der eller ej — trygt her, da varen allerede findes
      // lokalt (i modsætning til en ny vare, som ikke optimistisk indsættes
      // i denne første iteration, for at undgå at skulle forene et
      // midlertidigt lokalt id med serverens rigtige id bagefter).
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? { ...item, isChecked: isChecked ? 1 : 0 } : item,
        ),
      );

      withQueueableMutation(
        () => setShoppingListItemChecked(familyId, selectedListId, itemId, isChecked),
        () =>
          enqueueShoppingOperation({
            type: "toggle-item",
            familyId,
            listId: selectedListId,
            itemId,
            isChecked,
          }),
      );
    },
    [familyId, selectedListId, withQueueableMutation],
  );

  const setCategory = useCallback(
    (itemId: string, category: ShoppingCategory): void => {
      if (!familyId || !selectedListId) {
        return;
      }

      withMutation(() => setShoppingListItemCategory(familyId, selectedListId, itemId, category));
    },
    [familyId, selectedListId, withMutation],
  );

  const renameItem = useCallback(
    (itemId: string, name: string): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || !selectedListId) {
        return;
      }

      withMutation(() => renameShoppingListItem(familyId, selectedListId, itemId, trimmed));
    },
    [familyId, selectedListId, withMutation],
  );

  const deleteItem = useCallback(
    (itemId: string): void => {
      if (!familyId || !selectedListId) {
        return;
      }

      withMutation(() => deleteShoppingListItem(familyId, selectedListId, itemId));
    },
    [familyId, selectedListId, withMutation],
  );

  const clearChecked = useCallback((): void => {
    if (!familyId || !selectedListId) {
      return;
    }

    withMutation(() => clearCheckedShoppingListItems(familyId, selectedListId));
  }, [familyId, selectedListId, withMutation]);

  // Returnerer AI'ens forslag, uden at gemme noget — kalderen (UI'et) viser
  // dem som afkrydsningsbare forslag og beslutter selv, hvilke der reelt
  // skal tilføjes via addSuggestedItems.
  const suggestIngredients = useCallback(
    async (dish: string): Promise<IngredientDraftItem[]> => {
      if (!familyId || !selectedListId || !dish.trim()) {
        return [];
      }

      const result = await generateIngredientsDraft(familyId, selectedListId, dish.trim());

      if (!result.ok || !result.data.items) {
        throw new Error(result.data.error ?? "Kunne ikke generere et forslag.");
      }

      return result.data.items;
    },
    [familyId, selectedListId],
  );

  // Tilføjes ét ad gangen (afventet, ikke parallelt) — undgår at flere
  // samtidige POST-svar med hver deres "fulde liste på det tidspunkt"
  // kapløber om at være det sidste, der sætter tilstanden.
  const addSuggestedItems = useCallback(
    async (itemNames: string[]): Promise<void> => {
      if (!familyId || !selectedListId) {
        return;
      }

      setError(null);

      try {
        for (const name of itemNames) {
          const result = await addShoppingListItem(familyId, selectedListId, name);

          if (result.ok && result.data.items) {
            setItems(result.data.items);
          }
        }
      } catch {
        setError("Varerne kunne ikke tilføjes. Prøv igen.");
      }
    },
    [familyId, selectedListId],
  );

  // Gemmer den nuværende listes varenavne som en ny, genanvendelig skabelon
  // — serveren snapshotter selv de faktiske varer, kaldet sender kun navnet.
  const saveAsTemplate = useCallback(
    async (name: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || !selectedListId) {
        return;
      }

      setError(null);

      const result = await saveShoppingListAsTemplate(familyId, selectedListId, trimmed);

      if (result.ok && result.data.templates) {
        setTemplates(result.data.templates);
      } else {
        setError(result.data.error ?? "Skabelonen kunne ikke gemmes.");
      }
    },
    [familyId, selectedListId],
  );

  // Genbruger addSuggestedItems' samme sekventielle tilføjelses-mønster
  // (afventet, ikke parallelt) — samme begrundelse: undgår at flere
  // samtidige svar kapløber om at være det sidste, der sætter tilstanden.
  const applyTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      const template = templates.find((candidate) => candidate.id === templateId);
      if (!template) {
        return;
      }

      await addSuggestedItems(template.items.map((item) => item.name));
    },
    [templates, addSuggestedItems],
  );

  const deleteTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      if (!familyId || !selectedListId) {
        return;
      }

      setError(null);

      const result = await deleteShoppingListTemplate(familyId, selectedListId, templateId);

      if (result.ok && result.data.templates) {
        setTemplates(result.data.templates);
      } else {
        setError(result.data.error ?? "Skabelonen kunne ikke slettes.");
      }
    },
    [familyId, selectedListId],
  );

  const renameTemplate = useCallback(
    async (templateId: string, name: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || !selectedListId) {
        return;
      }

      setError(null);

      const result = await renameShoppingListTemplate(familyId, selectedListId, templateId, trimmed);

      if (result.ok && result.data.templates) {
        setTemplates(result.data.templates);
      } else {
        setError(result.data.error ?? "Skabelonen kunne ikke omdøbes.");
      }
    },
    [familyId, selectedListId],
  );

  const addTemplateItem = useCallback(
    async (templateId: string, name: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || !selectedListId) {
        return;
      }

      setError(null);

      const result = await addShoppingListTemplateItem(familyId, selectedListId, templateId, trimmed);

      if (result.ok && result.data.templates) {
        setTemplates(result.data.templates);
      } else {
        setError(result.data.error ?? "Varen kunne ikke tilføjes til skabelonen.");
      }
    },
    [familyId, selectedListId],
  );

  const deleteTemplateItem = useCallback(
    async (templateId: string, itemId: string): Promise<void> => {
      if (!familyId || !selectedListId) {
        return;
      }

      setError(null);

      const result = await deleteShoppingListTemplateItem(familyId, selectedListId, templateId, itemId);

      if (result.ok && result.data.templates) {
        setTemplates(result.data.templates);
      } else {
        setError(result.data.error ?? "Varen kunne ikke fjernes fra skabelonen.");
      }
    },
    [familyId, selectedListId],
  );

  return {
    isLoading,
    error,
    lists,
    selectedListId,
    selectList,
    createList,
    updateList,
    deleteList,
    items,
    addItem,
    toggleChecked,
    setCategory,
    renameItem,
    deleteItem,
    clearChecked,
    suggestIngredients,
    addSuggestedItems,
    templates,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate,
    renameTemplate,
    addTemplateItem,
    deleteTemplateItem,
    pendingOfflineChangeCount,
  };
}
