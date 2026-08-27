import { useState } from "react";
import type { FormEvent, SyntheticEvent } from "react";

import {
  AddRounded,
  AutoAwesomeOutlined,
  BookmarksOutlined,
  DeleteOutlineRounded,
  EditRounded,
  IosShareRounded,
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

import { ItemRow } from "../features/shoppingList/components/ItemRow";
import { SuggestIngredientsDialog } from "../features/shoppingList/components/SuggestIngredientsDialog";
import { TemplatesDialog } from "../features/shoppingList/components/TemplatesDialog";
import { useShoppingList } from "../features/shoppingList/hooks/useShoppingList";
import {
  shoppingCategoriesByListType,
  shoppingListTypeLabels,
  shoppingListTypes,
  type ShoppingListType,
} from "../features/shoppingList/shoppingListApi";
import { groupItemsByCategory, shareItemsAsText } from "../features/shoppingList/utils/shoppingListPageHelpers";

const newListTabValue = "__new__";

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
    renameTemplate,
    addTemplateItem,
    deleteTemplateItem,
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
        onRename={renameTemplate}
        onAddItem={addTemplateItem}
        onDeleteItem={deleteTemplateItem}
      />
    </Box>
  );
}

export default ShoppingListPage;
