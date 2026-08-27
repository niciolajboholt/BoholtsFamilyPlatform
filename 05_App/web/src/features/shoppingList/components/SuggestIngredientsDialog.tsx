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
  TextField,
  Typography,
} from "@mui/material";

import type { IngredientDraftItem } from "../shoppingListApi";

interface SuggestIngredientsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuggest: (dish: string) => Promise<IngredientDraftItem[]>;
  onAddSelected: (itemNames: string[]) => Promise<void>;
}

export function SuggestIngredientsDialog({
  open,
  onClose,
  onSuggest,
  onAddSelected,
}: SuggestIngredientsDialogProps) {
  const [dish, setDish] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientDraftItem[] | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setDish("");
    setSuggestions(null);
    setSelectedNames(new Set());
    setError(null);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function handleSuggest(): void {
    if (!dish.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    onSuggest(dish)
      .then((items) => {
        setSuggestions(items);
        setSelectedNames(new Set(items.map((item) => item.name)));
      })
      .catch((suggestError: unknown) => {
        const message =
          suggestError instanceof Error ? suggestError.message : "Kunne ikke generere et forslag.";
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

    onAddSelected(Array.from(selectedNames))
      .then(() => {
        reset();
        onClose();
      })
      .finally(() => setIsAdding(false));
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Foreslå varer ud fra en ret</DialogTitle>

      <DialogContent sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Fx spaghetti bolognese"
            value={dish}
            onChange={(event) => setDish(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSuggest();
              }
            }}
          />
          <Button variant="outlined" onClick={handleSuggest} disabled={!dish.trim() || isLoading}>
            Foreslå
          </Button>
        </Box>

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

        {suggestions && suggestions.length === 0 && (
          <Typography color="text.secondary">Intet forslag denne gang — prøv at omformulere.</Typography>
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
