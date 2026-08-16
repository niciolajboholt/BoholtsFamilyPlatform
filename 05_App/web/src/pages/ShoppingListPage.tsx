import { useState } from "react";
import type { FormEvent, SyntheticEvent } from "react";

import {
  AddRounded,
  DeleteOutlineRounded,
  EditRounded,
  IosShareRounded,
  LabelOutlined,
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useShoppingList } from "../features/shoppingList/hooks/useShoppingList";
import {
  shoppingCategoriesByListType,
  shoppingListTypeLabels,
  shoppingListTypes,
  type ShoppingListItemDto,
  type ShoppingListType,
} from "../features/shoppingList/shoppingListApi";

const newListTabValue = "__new__";

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
  const {
    isLoading,
    error,
    lists,
    selectedListId,
    selectList,
    createList,
    renameList,
    items,
    addItem,
    toggleChecked,
    setCategory,
    renameItem,
    deleteItem,
    clearChecked,
  } = useShoppingList();
  const [newItemName, setNewItemName] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListType, setNewListType] = useState<ShoppingListType>("dagligvarer");
  const [isEditingListName, setIsEditingListName] = useState(false);
  const [listNameDraft, setListNameDraft] = useState("");

  const selectedList = lists.find((list) => list.id === selectedListId);
  const isFlatList = selectedList?.type === "andet";
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

  function startEditingListName(): void {
    if (!selectedList) {
      return;
    }

    setListNameDraft(selectedList.name);
    setIsEditingListName(true);
  }

  function commitListNameEdit(): void {
    setIsEditingListName(false);

    if (!selectedList || !listNameDraft.trim() || listNameDraft.trim() === selectedList.name) {
      return;
    }

    renameList(listNameDraft);
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Indkøbsliste</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Delt med hele familien — alle kan tilføje og krydse af.
        </Typography>
      </Box>

      {lists.length > 0 && (
        <Tabs
          value={selectedListId ?? false}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          {lists.map((list) => (
            <Tab key={list.id} value={list.id} label={list.name} />
          ))}
          <Tab value={newListTabValue} icon={<AddRounded />} aria-label="Opret ny liste" />
        </Tabs>
      )}

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
              {isEditingListName ? (
                <TextField
                  autoFocus
                  size="small"
                  value={listNameDraft}
                  onChange={(event) => setListNameDraft(event.target.value)}
                  onBlur={commitListNameEdit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      setIsEditingListName(false);
                    }
                  }}
                />
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="h6">
                    {selectedList ? selectedList.name : "Varer"}
                  </Typography>

                  {selectedList && (
                    <IconButton
                      aria-label="Omdøb liste"
                      size="small"
                      onClick={startEditingListName}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )}

              {selectedList && (
                <Typography variant="caption" color="text.secondary">
                  {shoppingListTypeLabels[selectedList.type]}
                </Typography>
              )}
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
          ) : isFlatList ? (
            <Box>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  categories={[]}
                  onToggleChecked={toggleChecked}
                  onRename={renameItem}
                  onDelete={deleteItem}
                />
              ))}

              {hasCheckedItems && (
                <Box sx={{ mt: 2, textAlign: "right" }}>
                  <Button size="small" onClick={clearChecked}>
                    Ryd afkrydsede
                  </Button>
                </Box>
              )}
            </Box>
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
                    <ItemRow
                      key={item.id}
                      item={item}
                      categories={
                        selectedList ? shoppingCategoriesByListType[selectedList.type] : []
                      }
                      onToggleChecked={toggleChecked}
                      onChangeCategory={setCategory}
                      onRename={renameItem}
                      onDelete={deleteItem}
                    />
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

      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Opret ny liste</DialogTitle>

        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Navn"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
          />

          <RadioGroup
            value={newListType}
            onChange={(event) => setNewListType(event.target.value as ShoppingListType)}
            sx={{ mt: 1 }}
          >
            {shoppingListTypes.map((type) => (
              <FormControlLabel
                key={type}
                value={type}
                control={<Radio />}
                label={shoppingListTypeLabels[type]}
              />
            ))}
          </RadioGroup>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Annuller</Button>
          <Button variant="contained" onClick={handleCreateList} disabled={!newListName.trim()}>
            Opret
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface ItemRowProps {
  item: ShoppingListItemDto;
  categories: readonly string[];
  onToggleChecked: (itemId: string, isChecked: boolean) => void;
  onChangeCategory?: (itemId: string, category: string) => void;
  onRename: (itemId: string, name: string) => void;
  onDelete: (itemId: string) => void;
}

function ItemRow({
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

export default ShoppingListPage;
