import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import type { MealPlanIngredientDraftItem } from "../mealPlanApi";
import type { ShoppingListDto } from "../../shoppingList/shoppingListApi";

interface GenerateShoppingDraftDialogProps {
  open: boolean;
  onClose: () => void;
  lists: ShoppingListDto[];
  hasAnyDish: boolean;
  onGenerate: (listId: string) => Promise<MealPlanIngredientDraftItem[]>;
  onAddSelected: (listId: string, itemNames: string[]) => Promise<void>;
}

export function GenerateShoppingDraftDialog({
  open,
  onClose,
  lists,
  hasAnyDish,
  onGenerate,
  onAddSelected,
}: GenerateShoppingDraftDialogProps) {
  // Afledt, ikke synkroniseret via en effekt: dialogen forbliver monteret
  // bag Dialog's egen open-prop (ikke betinget renderet), så et
  // useState(lists[0]?.id ?? "") ved første montering ville for altid
  // fange et TOMT array, hvis MealPlanPage's egen liste-hentning endnu
  // ikke var færdig — manualListId er kun sat, når brugeren selv har
  // valgt en anden liste end standardvalget.
  const [manualListId, setManualListId] = useState<string | null>(null);
  const listId = manualListId ?? lists[0]?.id ?? "";
  const [suggestions, setSuggestions] = useState<MealPlanIngredientDraftItem[] | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setSuggestions(null);
    setSelectedNames(new Set());
    setError(null);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function handleGenerate(): void {
    if (!listId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    onGenerate(listId)
      .then((items) => {
        setSuggestions(items);
        setSelectedNames(new Set(items.map((item) => item.name)));
      })
      .catch((generateError: unknown) => {
        const message =
          generateError instanceof Error ? generateError.message : "Kunne ikke generere et forslag.";
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }

  function toggleSelected(name: string): void {
    setSelectedNames((previous) => {
      const next = new Set(previous);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleAddSelected(): void {
    setIsAdding(true);

    onAddSelected(listId, Array.from(selectedNames))
      .then(() => {
        reset();
        onClose();
      })
      .finally(() => setIsAdding(false));
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Foreslå indkøb ud fra ugens retter</DialogTitle>

      <DialogContent sx={{ display: "grid", gap: 2 }}>
        {!hasAnyDish ? (
          <Typography color="text.secondary">
            Tilføj mindst én ret til ugen, før der kan foreslås varer.
          </Typography>
        ) : (
          <>
            <TextField
              select
              fullWidth
              size="small"
              label="Tilføj til liste"
              value={listId}
              onChange={(event) => setManualListId(event.target.value)}
              disabled={suggestions !== null}
            >
              {lists.map((list) => (
                <MenuItem key={list.id} value={list.id}>
                  {list.name}
                </MenuItem>
              ))}
            </TextField>

            {suggestions === null && (
              <Button variant="outlined" onClick={handleGenerate} disabled={!listId || isLoading}>
                {isLoading ? "Genererer…" : "Generér forslag"}
              </Button>
            )}

            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            {suggestions && suggestions.length > 0 && (
              <Box>
                {suggestions.map((item) => (
                  <Box key={item.name} sx={{ display: "flex", alignItems: "center" }}>
                    <Checkbox
                      checked={selectedNames.has(item.name)}
                      onChange={() => toggleSelected(item.name)}
                    />
                    <Typography sx={{ flexGrow: 1 }}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.category}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Annuller</Button>
        <Button
          variant="contained"
          onClick={handleAddSelected}
          disabled={!suggestions || selectedNames.size === 0 || isAdding}
        >
          Tilføj valgte
        </Button>
      </DialogActions>
    </Dialog>
  );
}
