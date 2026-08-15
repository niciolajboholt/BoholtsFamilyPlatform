import { useState } from "react";
import type { FormEvent } from "react";

import {
  DeleteOutlineRounded,
  IosShareRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import { useShoppingList } from "../features/shoppingList/hooks/useShoppingList";
import type { ShoppingListItemDto } from "../features/shoppingList/shoppingListApi";

function groupItemsByCategory(
  items: ShoppingListItemDto[],
): Map<string, ShoppingListItemDto[]> {
  const groups = new Map<string, ShoppingListItemDto[]>();

  for (const item of items) {
    const existing = groups.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.category, [item]);
    }
  }

  return groups;
}

// Web Share API er ikke understøttet overalt (fx desktop Firefox) — falder
// tilbage til udklipsholderen, så knappen altid gør noget brugbart.
async function shareItemsAsText(items: ShoppingListItemDto[]): Promise<void> {
  const text = items
    .filter((item) => !item.isChecked)
    .map((item) => `- ${item.name}`)
    .join("\n");

  const shareText = `Indkøbsliste:\n${text}`;

  if (navigator.share) {
    await navigator.share({ text: shareText });
    return;
  }

  await navigator.clipboard.writeText(shareText);
}

function ShoppingListPage() {
  const { isLoading, error, items, addItem, toggleChecked, deleteItem, clearChecked } =
    useShoppingList();
  const [newItemName, setNewItemName] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);

  const hasCheckedItems = items.some((item) => item.isChecked);
  const groupedItems = groupItemsByCategory(items);

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

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Indkøbsliste</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Delt med hele familien — alle kan tilføje og krydse af.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mb: 2.5,
            }}
          >
            <Avatar sx={{ bgcolor: "secondary.main" }}>
              <ShoppingCartOutlined />
            </Avatar>

            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Varer</Typography>
            </Box>

            <IconButton
              aria-label="Del liste som tekst"
              onClick={handleShare}
              disabled={items.length === 0}
            >
              <IosShareRounded />
            </IconButton>
          </Box>

          <Box component="form" onSubmit={handleAddItem} sx={{ display: "flex", gap: 1, mb: 2.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Tilføj en vare…"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
            />
            <Button type="submit" variant="contained" disabled={!newItemName.trim()}>
              Tilføj
            </Button>
          </Box>

          {(error || shareError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error ?? shareError}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : items.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
              Listen er tom — tilføj den første vare ovenfor.
            </Typography>
          ) : (
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
                    <Box
                      key={item.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        opacity: item.isChecked ? 0.5 : 1,
                      }}
                    >
                      <Checkbox
                        checked={Boolean(item.isChecked)}
                        onChange={(event) => toggleChecked(item.id, event.target.checked)}
                      />

                      <Typography
                        sx={{
                          flexGrow: 1,
                          textDecoration: item.isChecked ? "line-through" : "none",
                        }}
                      >
                        {item.name}
                      </Typography>

                      <IconButton
                        aria-label={`Fjern ${item.name}`}
                        size="small"
                        onClick={() => deleteItem(item.id)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              ))}

              {hasCheckedItems && (
                <Box sx={{ mt: 2, textAlign: "right" }}>
                  <Button size="small" onClick={clearChecked}>
                    Ryd afkrydsede
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default ShoppingListPage;
