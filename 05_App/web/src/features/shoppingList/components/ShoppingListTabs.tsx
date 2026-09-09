import type { SyntheticEvent } from "react";

import { AddRounded } from "@mui/icons-material";
import { Tab, Tabs } from "@mui/material";

import type { ShoppingListDto } from "../shoppingListApi";
import { newListTabValue } from "../hooks/useShoppingListPageController";

interface ShoppingListTabsProps {
  lists: ShoppingListDto[];
  selectedListId: string | null;
  onChange: (event: SyntheticEvent, value: string) => void;
}

export function ShoppingListTabs({ lists, selectedListId, onChange }: ShoppingListTabsProps) {
  if (lists.length === 0) {
    return null;
  }

  return (
    <Tabs
      value={selectedListId ?? false}
      onChange={onChange}
      variant="scrollable"
      scrollButtons="auto"
      sx={{ mb: 2 }}
    >
      {lists.map((list) => (
        <Tab key={list.id} value={list.id} label={list.name} />
      ))}
      <Tab value={newListTabValue} icon={<AddRounded />} aria-label="Opret ny liste" />
    </Tabs>
  );
}
