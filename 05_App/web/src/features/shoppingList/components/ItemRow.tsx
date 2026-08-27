import { useState } from "react";

import { DeleteOutlineRounded, LabelOutlined } from "@mui/icons-material";
import { Box, Checkbox, IconButton, Menu, MenuItem, TextField, Typography } from "@mui/material";

import type { ShoppingListItemDto } from "../shoppingListApi";

interface ItemRowProps {
  item: ShoppingListItemDto;
  categories: readonly string[];
  onToggleChecked: (itemId: string, isChecked: boolean) => void;
  onChangeCategory?: (itemId: string, category: string) => void;
  onRename: (itemId: string, name: string) => void;
  onDelete: (itemId: string) => void;
}

export function ItemRow({
  item,
  categories,
  onToggleChecked,
  onChangeCategory,
  onRename,
  onDelete,
}: ItemRowProps) {
  const [categoryMenuAnchor, setCategoryMenuAnchor] = useState<HTMLElement | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);

  function startEditingName(): void {
    setNameDraft(item.name);
    setIsEditingName(true);
  }

  function commitNameEdit(): void {
    setIsEditingName(false);

    if (!nameDraft.trim() || nameDraft.trim() === item.name) {
      return;
    }

    onRename(item.id, nameDraft);
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        opacity: item.isChecked ? 0.5 : 1,
      }}
    >
      <Checkbox
        checked={Boolean(item.isChecked)}
        onChange={(event) => onToggleChecked(item.id, event.target.checked)}
      />

      {isEditingName ? (
        <TextField
          autoFocus
          size="small"
          fullWidth
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitNameEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setIsEditingName(false);
            }
          }}
          sx={{ flexGrow: 1 }}
        />
      ) : (
        <Typography
          onClick={startEditingName}
          sx={{
            flexGrow: 1,
            cursor: "pointer",
            textDecoration: item.isChecked ? "line-through" : "none",
          }}
        >
          {item.name}
        </Typography>
      )}

      {onChangeCategory && categories.length > 0 && (
        <>
          <IconButton
            aria-label={`Skift kategori for ${item.name}`}
            size="small"
            onClick={(event) => setCategoryMenuAnchor(event.currentTarget)}
          >
            <LabelOutlined fontSize="small" />
          </IconButton>

          <Menu
            anchorEl={categoryMenuAnchor}
            open={Boolean(categoryMenuAnchor)}
            onClose={() => setCategoryMenuAnchor(null)}
          >
            {categories.map((category) => (
              <MenuItem
                key={category}
                selected={category === item.category}
                onClick={() => {
                  setCategoryMenuAnchor(null);
                  onChangeCategory(item.id, category);
                }}
              >
                {category}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      <IconButton aria-label={`Fjern ${item.name}`} size="small" onClick={() => onDelete(item.id)}>
        <DeleteOutlineRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}
