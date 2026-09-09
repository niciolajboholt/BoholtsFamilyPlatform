import { Box, Button, CircularProgress, Divider, Typography } from "@mui/material";

import { ItemRow } from "./ItemRow";
import type { ShoppingCategory, ShoppingListItemDto } from "../shoppingListApi";
import { groupItemsByCategory } from "../utils/shoppingListPageHelpers";

interface ShoppingListItemsProps {
  isLoading: boolean;
  items: ShoppingListItemDto[];
  isFlatList: boolean;
  categories: readonly ShoppingCategory[];
  onToggleChecked: (itemId: string, isChecked: boolean) => void;
  onChangeCategory: (itemId: string, category: ShoppingCategory) => void;
  onRename: (itemId: string, name: string) => void;
  onDelete: (itemId: string) => void;
  onClearChecked: () => void;
}

export function ShoppingListItems({
  isLoading,
  items,
  isFlatList,
  categories,
  onToggleChecked,
  onChangeCategory,
  onRename,
  onDelete,
  onClearChecked,
}: ShoppingListItemsProps) {
  const hasCheckedItems = items.some((item) => item.isChecked);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
        Listen er tom — tilføj den første vare ovenfor.
      </Typography>
    );
  }

  if (isFlatList) {
    return (
      <Box>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            categories={[]}
            onToggleChecked={onToggleChecked}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}

        {hasCheckedItems && (
          <Box sx={{ mt: 2, textAlign: "right" }}>
            <Button size="small" onClick={onClearChecked}>
              Ryd afkrydsede
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  const groupedItems = groupItemsByCategory(items);

  return (
    <Box>
      {Array.from(groupedItems.entries()).map(([category, categoryItems], groupIndex) => (
        <Box key={category}>
          {groupIndex > 0 && <Divider sx={{ my: 1 }} />}

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", fontWeight: 600, mt: groupIndex > 0 ? 1 : 0 }}
          >
            {category.toUpperCase()}
          </Typography>

          {categoryItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              categories={categories}
              onToggleChecked={onToggleChecked}
              onChangeCategory={onChangeCategory}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </Box>
      ))}

      {hasCheckedItems && (
        <Box sx={{ mt: 2, textAlign: "right" }}>
          <Button size="small" onClick={onClearChecked}>
            Ryd afkrydsede
          </Button>
        </Box>
      )}
    </Box>
  );
}
