import { useCallback, useEffect, useState } from "react";

import { getMyFamily } from "../../family/familyApi";
import {
  addShoppingListItem,
  clearCheckedShoppingListItems,
  createShoppingList,
  deleteShoppingListItem,
  getShoppingListItems,
  getShoppingLists,
  setShoppingListItemCategory,
  setShoppingListItemChecked,
  type ShoppingCategory,
  type ShoppingListDto,
  type ShoppingListItemDto,
  type ShoppingListType,
} from "../shoppingListApi";

interface UseShoppingListResult {
  isLoading: boolean;
  error: string | null;
  lists: ShoppingListDto[];
  selectedListId: string | null;
  selectList: (listId: string) => void;
  createList: (name: string, type: ShoppingListType) => void;
  items: ShoppingListItemDto[];
  addItem: (name: string) => void;
  toggleChecked: (itemId: string, isChecked: boolean) => void;
  setCategory: (itemId: string, category: ShoppingCategory) => void;
  deleteItem: (itemId: string) => void;
  clearChecked: () => void;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const addItem = useCallback(
    (name: string): void => {
      const trimmed = name.trim();
      if (!trimmed || !familyId || !selectedListId) {
        return;
      }

      withMutation(() => addShoppingListItem(familyId, selectedListId, trimmed));
    },
    [familyId, selectedListId, withMutation],
  );

  const toggleChecked = useCallback(
    (itemId: string, isChecked: boolean): void => {
      if (!familyId || !selectedListId) {
        return;
      }

      withMutation(() => setShoppingListItemChecked(familyId, selectedListId, itemId, isChecked));
    },
    [familyId, selectedListId, withMutation],
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

  return {
    isLoading,
    error,
    lists,
    selectedListId,
    selectList,
    createList,
    items,
    addItem,
    toggleChecked,
    setCategory,
    deleteItem,
    clearChecked,
  };
}
