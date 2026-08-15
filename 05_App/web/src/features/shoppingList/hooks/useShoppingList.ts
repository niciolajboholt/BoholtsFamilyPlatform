import { useCallback, useEffect, useState } from "react";

import { getMyFamily } from "../../family/familyApi";
import {
  addShoppingListItem,
  clearCheckedShoppingListItems,
  deleteShoppingListItem,
  getShoppingListItems,
  getShoppingLists,
  setShoppingListItemCategory,
  setShoppingListItemChecked,
  type ShoppingCategory,
  type ShoppingListItemDto,
} from "../shoppingListApi";

interface UseShoppingListResult {
  isLoading: boolean;
  error: string | null;
  items: ShoppingListItemDto[];
  addItem: (name: string) => void;
  toggleChecked: (itemId: string, isChecked: boolean) => void;
  setCategory: (itemId: string, category: ShoppingCategory) => void;
  deleteItem: (itemId: string) => void;
  clearChecked: () => void;
}

/**
 * Sprint 21, Del B: appens ene sted for indkøbsliste-tilstand. Første
 * version viser kun familiens ene (auto-oprettede) liste — API'et
 * understøtter allerede flere, men UI'et for at vælge mellem dem er ikke
 * bygget endnu.
 */
export function useShoppingList(): UseShoppingListResult {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError("Kunne ikke hente indkøbslisten.");
        setIsLoading(false);
        return;
      }

      const itemsResult = await getShoppingListItems(resolvedFamilyId, firstList.id);

      if (isCancelled) {
        return;
      }

      setFamilyId(resolvedFamilyId);
      setListId(firstList.id);
      setItems(itemsResult.data.items ?? []);
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

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
      if (!trimmed || !familyId || !listId) {
        return;
      }

      withMutation(() => addShoppingListItem(familyId, listId, trimmed));
    },
    [familyId, listId, withMutation],
  );

  const toggleChecked = useCallback(
    (itemId: string, isChecked: boolean): void => {
      if (!familyId || !listId) {
        return;
      }

      withMutation(() => setShoppingListItemChecked(familyId, listId, itemId, isChecked));
    },
    [familyId, listId, withMutation],
  );

  const setCategory = useCallback(
    (itemId: string, category: ShoppingCategory): void => {
      if (!familyId || !listId) {
        return;
      }

      withMutation(() => setShoppingListItemCategory(familyId, listId, itemId, category));
    },
    [familyId, listId, withMutation],
  );

  const deleteItem = useCallback(
    (itemId: string): void => {
      if (!familyId || !listId) {
        return;
      }

      withMutation(() => deleteShoppingListItem(familyId, listId, itemId));
    },
    [familyId, listId, withMutation],
  );

  const clearChecked = useCallback((): void => {
    if (!familyId || !listId) {
      return;
    }

    withMutation(() => clearCheckedShoppingListItems(familyId, listId));
  }, [familyId, listId, withMutation]);

  return { isLoading, error, items, addItem, toggleChecked, setCategory, deleteItem, clearChecked };
}
