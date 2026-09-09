import { useState } from "react";
import type { FormEvent, SyntheticEvent } from "react";

import { useShoppingList } from "./useShoppingList";
import { shareItemsAsText } from "../utils/shoppingListPageHelpers";
import type { ShoppingListDto, ShoppingListType } from "../shoppingListApi";

export const newListTabValue = "__new__";

export interface UseShoppingListPageControllerResult
  extends ReturnType<typeof useShoppingList> {
  selectedList: ShoppingListDto | undefined;
  newItemName: string;
  setNewItemName: (value: string) => void;
  shareError: string | null;
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: (value: boolean) => void;
  newListName: string;
  setNewListName: (value: string) => void;
  newListType: ShoppingListType;
  setNewListType: (value: ShoppingListType) => void;
  isEditListDialogOpen: boolean;
  editListName: string;
  setEditListName: (value: string) => void;
  editListType: ShoppingListType;
  setEditListType: (value: ShoppingListType) => void;
  isDeleteListConfirmVisible: boolean;
  setIsDeleteListConfirmVisible: (value: boolean) => void;
  isSuggestDialogOpen: boolean;
  setIsSuggestDialogOpen: (value: boolean) => void;
  isTemplatesDialogOpen: boolean;
  setIsTemplatesDialogOpen: (value: boolean) => void;
  moreActionsAnchor: HTMLElement | null;
  setMoreActionsAnchor: (value: HTMLElement | null) => void;
  handleAddItem: (event: FormEvent) => void;
  handleShare: () => void;
  handleTabChange: (event: SyntheticEvent, value: string) => void;
  handleCreateList: () => void;
  openEditListDialog: () => void;
  closeEditListDialog: () => void;
  handleSaveListEdit: () => void;
  handleDeleteList: () => void;
}

// Holder alt UI-tilstand og alle handlers for ShoppingListPage, så selve
// siden kun består af komposition af underkomponenter (samme mønster som
// useEditEventDialogController for kalenderens redigeringsdialog, Fase 6).
export function useShoppingListPageController(): UseShoppingListPageControllerResult {
  const shoppingList = useShoppingList();
  const { lists, selectedListId, selectList, createList, updateList, deleteList, items, addItem } =
    shoppingList;

  const [newItemName, setNewItemName] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<ShoppingListType>("dagligvarer");
  const [isEditListDialogOpen, setIsEditListDialogOpen] = useState(false);
  const [editListName, setEditListName] = useState("");
  const [editListType, setEditListType] = useState<ShoppingListType>("dagligvarer");
  const [isDeleteListConfirmVisible, setIsDeleteListConfirmVisible] = useState(false);
  const [isSuggestDialogOpen, setIsSuggestDialogOpen] = useState(false);
  const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState<HTMLElement | null>(null);

  const selectedList = lists.find((list) => list.id === selectedListId);

  function handleAddItem(event: FormEvent): void {
    event.preventDefault();

    if (!newItemName.trim()) {
      return;
    }

    addItem(newItemName);
    setNewItemName("");
  }

  function handleShare(): void {
    setShareError(null);

    shareItemsAsText(items).catch((shareErrorValue: unknown) => {
      // AbortError kastes, når brugeren selv lukker del-dialogen — ikke en
      // reel fejl, der skal vises.
      if (shareErrorValue instanceof Error && shareErrorValue.name === "AbortError") {
        return;
      }

      setShareError("Listen kunne ikke deles.");
    });
  }

  function handleTabChange(_event: SyntheticEvent, value: string): void {
    if (value === newListTabValue) {
      setNewListName("");
      setNewListType("dagligvarer");
      setIsCreateDialogOpen(true);
      return;
    }

    selectList(value);
  }

  function handleCreateList(): void {
    if (!newListName.trim()) {
      return;
    }

    createList(newListName, newListType);
    setIsCreateDialogOpen(false);
  }

  function openEditListDialog(): void {
    if (!selectedList) {
      return;
    }

    setEditListName(selectedList.name);
    setEditListType(selectedList.type);
    setIsDeleteListConfirmVisible(false);
    setIsEditListDialogOpen(true);
  }

  function closeEditListDialog(): void {
    setIsEditListDialogOpen(false);
    setIsDeleteListConfirmVisible(false);
  }

  function handleSaveListEdit(): void {
    if (!selectedList || !editListName.trim()) {
      return;
    }

    const updates: { name?: string; type?: ShoppingListType } = {};
    if (editListName.trim() !== selectedList.name) {
      updates.name = editListName;
    }
    if (editListType !== selectedList.type) {
      updates.type = editListType;
    }

    if (Object.keys(updates).length > 0) {
      void updateList(updates);
    }

    closeEditListDialog();
  }

  function handleDeleteList(): void {
    closeEditListDialog();
    void deleteList();
  }

  return {
    ...shoppingList,
    selectedList,
    newItemName,
    setNewItemName,
    shareError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    newListName,
    setNewListName,
    newListType,
    setNewListType,
    isEditListDialogOpen,
    editListName,
    setEditListName,
    editListType,
    setEditListType,
    isDeleteListConfirmVisible,
    setIsDeleteListConfirmVisible,
    isSuggestDialogOpen,
    setIsSuggestDialogOpen,
    isTemplatesDialogOpen,
    setIsTemplatesDialogOpen,
    moreActionsAnchor,
    setMoreActionsAnchor,
    handleAddItem,
    handleShare,
    handleTabChange,
    handleCreateList,
    openEditListDialog,
    closeEditListDialog,
    handleSaveListEdit,
    handleDeleteList,
  };
}
