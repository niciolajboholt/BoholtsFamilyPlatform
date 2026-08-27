import { useState } from "react";

import { DeleteOutlineRounded, EditRounded } from "@mui/icons-material";
import { Box, Button, Divider, IconButton, TextField, Typography } from "@mui/material";

import type { ShoppingListTemplateDto } from "../shoppingListApi";

interface TemplateRowProps {
  template: ShoppingListTemplateDto;
  isEditing: boolean;
  isApplying: boolean;
  onToggleEditing: () => void;
  onApply: () => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
  onAddItem: (name: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

// Udtrukket til sin egen komponent, så navne-udkastet og
// "tilføj vare"-feltet kan have deres egen lokale tilstand pr. skabelon,
// uden at det lækker til søskende-rækkerne (samme begrundelse som fx
// WeekDayCard i kalenderen — hooks kan ikke ligge direkte i et .map()).
export function TemplateRow({
  template,
  isEditing,
  isApplying,
  onToggleEditing,
  onApply,
  onDelete,
  onRename,
  onAddItem,
  onDeleteItem,
}: TemplateRowProps) {
  const [nameDraft, setNameDraft] = useState(template.name);
  const [newItemName, setNewItemName] = useState("");

  function commitRename(): void {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== template.name) {
      void onRename(trimmed);
    } else {
      setNameDraft(template.name);
    }
  }

  function handleAddItem(): void {
    if (!newItemName.trim()) {
      return;
    }

    void onAddItem(newItemName);
    setNewItemName("");
  }

  return (
    <Box sx={{ py: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography noWrap>{template.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {template.items.length} {template.items.length === 1 ? "vare" : "varer"}
          </Typography>
        </Box>

        <Button size="small" onClick={onApply} disabled={isApplying}>
          Tilføj
        </Button>

        <IconButton
          aria-label={`Rediger skabelonen ${template.name}`}
          size="small"
          onClick={onToggleEditing}
        >
          <EditRounded fontSize="small" />
        </IconButton>

        <IconButton aria-label={`Slet skabelonen ${template.name}`} size="small" onClick={onDelete}>
          <DeleteOutlineRounded fontSize="small" />
        </IconButton>
      </Box>

      {isEditing && (
        <Box sx={{ pl: 1, pt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField
            size="small"
            label="Navn"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />

          {template.items.map((item) => (
            <Box key={item.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography sx={{ flexGrow: 1 }}>{item.name}</Typography>
              <IconButton
                aria-label={`Fjern ${item.name} fra skabelonen`}
                size="small"
                onClick={() => void onDeleteItem(item.id)}
              >
                <DeleteOutlineRounded fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Tilføj en vare til skabelonen…"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleAddItem();
                }
              }}
            />
            <Button size="small" variant="outlined" onClick={handleAddItem} disabled={!newItemName.trim()}>
              Tilføj
            </Button>
          </Box>
        </Box>
      )}

      <Divider sx={{ mt: 1 }} />
    </Box>
  );
}
