import { useState } from "react";
import type { FormEvent, SyntheticEvent } from "react";

import {
  AddRounded,
  AutoAwesomeOutlined,
  BookmarkAddOutlined,
  BookmarksOutlined,
  DeleteOutlineRounded,
  EditRounded,
  IosShareRounded,
  LabelOutlined,
  MoreVertRounded,
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
  type IngredientDraftItem,
  type ShoppingListItemDto,
  type ShoppingListTemplateDto,
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
    updateList,
    deleteList,
    items,
    addItem,
    toggleChecked,
    setCategory,
    renameItem,
    deleteItem,
    clearChecked,
    suggestIngredients,
    addSuggestedItems,
    templates,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate,
  } = useShoppingList();
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

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" noWrap>
                {selectedList ? selectedList.name : "Varer"}
              </Typography>

              {selectedList && (
                <Typography variant="caption" color="text.secondary">
                  {shoppingListTypeLabels[selectedList.type]}
                </Typography>
              )}
            </Box>

            <IconButton
              aria-label="Flere handlinger"
              onClick={(event) => setMoreActionsAnchor(event.currentTarget)}
            >
              <MoreVertRounded />
            </IconButton>

            <Menu
              anchorEl={moreActionsAnchor}
              open={Boolean(moreActionsAnchor)}
              onClose={() => setMoreActionsAnchor(null)}
            >
              <MenuItem
                disabled={!selectedList}
                onClick={() => {
                  setMoreActionsAnchor(null);
                  openEditListDialog();
                }}
              >
                <EditRounded fontSize="small" sx={{ mr: 1.5 }} />
                Rediger liste
              </MenuItem>

              {selectedList?.type !== "andet" && (
                <MenuItem
                  onClick={() => {
                    setMoreActionsAnchor(null);
                    setIsSuggestDialogOpen(true);
                  }}
                >
                  <AutoAwesomeOutlined fontSize="small" sx={{ mr: 1.5 }} />
                  Foreslå varer ud fra en ret
                </MenuItem>
              )}

              <MenuItem
                onClick={() => {
                  setMoreActionsAnchor(null);
                  setIsTemplatesDialogOpen(true);
                }}
              >
                <BookmarksOutlined fontSize="small" sx={{ mr: 1.5 }} />
                Skabeloner
              </MenuItem>

              <MenuItem
                disabled={items.length === 0}
                onClick={() => {
                  setMoreActionsAnchor(null);
                  handleShare();
                }}
              >
                <IosShareRounded fontSize="small" sx={{ mr: 1.5 }} />
                Del liste som tekst
              </MenuItem>
            </Menu>
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

      <Dialog open={isEditListDialogOpen} onClose={closeEditListDialog} fullWidth maxWidth="xs">
        <DialogTitle>Rediger liste</DialogTitle>

        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Navn"
            value={editListName}
            onChange={(event) => setEditListName(event.target.value)}
          />

          <RadioGroup
            value={editListType}
            onChange={(event) => setEditListType(event.target.value as ShoppingListType)}
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

          <Divider sx={{ my: 2 }} />

          {isDeleteListConfirmVisible ? (
            <Alert
              severity="warning"
              action={
                <Button color="error" size="small" onClick={handleDeleteList}>
                  Bekræft sletning
                </Button>
              }
            >
              Listen og alle dens varer slettes. Kan ikke fortrydes.
            </Alert>
          ) : (
            <Button
              color="error"
              size="small"
              startIcon={<DeleteOutlineRounded />}
              onClick={() => setIsDeleteListConfirmVisible(true)}
            >
              Slet liste
            </Button>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeEditListDialog}>Annuller</Button>
          <Button variant="contained" onClick={handleSaveListEdit} disabled={!editListName.trim()}>
            Gem
          </Button>
        </DialogActions>
      </Dialog>

      <SuggestIngredientsDialog
        open={isSuggestDialogOpen}
        onClose={() => setIsSuggestDialogOpen(false)}
        onSuggest={suggestIngredients}
        onAddSelected={addSuggestedItems}
      />

      <TemplatesDialog
        open={isTemplatesDialogOpen}
        onClose={() => setIsTemplatesDialogOpen(false)}
        templates={templates}
        hasItems={items.length > 0}
        onSave={saveAsTemplate}
        onApply={applyTemplate}
        onDelete={deleteTemplate}
      />
    </Box>
  );
}

interface TemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  templates: ShoppingListTemplateDto[];
  hasItems: boolean;
  onSave: (name: string) => Promise<void>;
  onApply: (templateId: string) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
}

// Mønster efter SuggestIngredientsDialog ovenfor — samme slags
// "vælg/handling"-dialog, blot med skabelonens FASTE varenavne i stedet for
// AI-genererede forslag, og uden en afkrydsningsbar udvælgelse (en skabelon
// tilføjes altid i sin helhed; man kan altid slette enkeltvarer bagefter).
function TemplatesDialog({
  open,
  onClose,
  templates,
  hasItems,
  onSave,
  onApply,
  onDelete,
}: TemplatesDialogProps) {
  const [isSaveFormOpen, setIsSaveFormOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose(): void {
    setIsSaveFormOpen(false);
    setNewTemplateName("");
    setError(null);
    onClose();
  }

  function handleSave(): void {
    if (!newTemplateName.trim()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    onSave(newTemplateName)
      .then(() => {
        setIsSaveFormOpen(false);
        setNewTemplateName("");
      })
      .catch(() => setError("Skabelonen kunne ikke gemmes."))
      .finally(() => setIsSaving(false));
  }

  function handleApply(templateId: string): void {
    setApplyingTemplateId(templateId);
    setError(null);

    onApply(templateId)
      .catch(() => setError("Varerne kunne ikke tilføjes."))
      .finally(() => setApplyingTemplateId(null));
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Skabeloner</DialogTitle>

      <DialogContent sx={{ display: "grid", gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {templates.length === 0 ? (
          <Typography color="text.secondary">
            Ingen skabeloner endnu — gem den nuværende liste som en, hvis du ofte handler de samme
            varer.
          </Typography>
        ) : (
          <Box>
            {templates.map((template) => (
              <Box
                key={template.id}
                sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography>{template.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {template.itemNames.length} {template.itemNames.length === 1 ? "vare" : "varer"}
                  </Typography>
                </Box>

                <Button
                  size="small"
                  onClick={() => handleApply(template.id)}
                  disabled={applyingTemplateId === template.id}
                >
                  Tilføj
                </Button>

                <IconButton
                  aria-label={`Slet skabelonen ${template.name}`}
                  size="small"
                  onClick={() => void onDelete(template.id)}
                >
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Divider />

        {isSaveFormOpen ? (
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="Navn på skabelon"
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSave();
                }
              }}
            />
            <Button
              variant="outlined"
              onClick={handleSave}
              disabled={!newTemplateName.trim() || isSaving}
            >
              Gem
            </Button>
          </Box>
        ) : (
          <Button
            startIcon={<BookmarkAddOutlined />}
            onClick={() => setIsSaveFormOpen(true)}
            disabled={!hasItems}
            sx={{ justifySelf: "flex-start" }}
          >
            Gem nuværende liste som skabelon
          </Button>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}

interface SuggestIngredientsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuggest: (dish: string) => Promise<IngredientDraftItem[]>;
  onAddSelected: (itemNames: string[]) => Promise<void>;
}

function SuggestIngredientsDialog({
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
