import { Alert, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";

import { CreateListDialog } from "../features/shoppingList/components/CreateListDialog";
import { EditListDialog } from "../features/shoppingList/components/EditListDialog";
import { ShoppingListItems } from "../features/shoppingList/components/ShoppingListItems";
import { ShoppingListTabs } from "../features/shoppingList/components/ShoppingListTabs";
import { ShoppingListToolbar } from "../features/shoppingList/components/ShoppingListToolbar";
import { SuggestIngredientsDialog } from "../features/shoppingList/components/SuggestIngredientsDialog";
import { TemplatesDialog } from "../features/shoppingList/components/TemplatesDialog";
import { useShoppingListPageController } from "../features/shoppingList/hooks/useShoppingListPageController";
import { shoppingCategoriesByListType } from "../features/shoppingList/shoppingListApi";

function ShoppingListPage() {
  const controller = useShoppingListPageController();
  const {
    isLoading,
    error,
    lists,
    selectedListId,
    items,
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
    pendingOfflineChangeCount,
    selectedList,
    newItemName,
    setNewItemName,
    shareError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    newListName,
    setNewListName,
    newListType,
    setNewListType,
    isEditListDialogOpen,
    editListName,
    setEditListName,
    editListType,
    setEditListType,
    isDeleteListConfirmVisible,
    setIsDeleteListConfirmVisible,
    isSuggestDialogOpen,
    setIsSuggestDialogOpen,
    isTemplatesDialogOpen,
    setIsTemplatesDialogOpen,
    moreActionsAnchor,
    setMoreActionsAnchor,
    handleAddItem,
    handleShare,
    handleTabChange,
    handleCreateList,
    openEditListDialog,
    closeEditListDialog,
    handleSaveListEdit,
    handleDeleteList,
  } = controller;

  const isFlatList = selectedList?.type === "andet";

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Indkøbsliste</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Delt med hele familien — alle kan tilføje og krydse af.
        </Typography>
      </Box>

      <ShoppingListTabs lists={lists} selectedListId={selectedListId} onChange={handleTabChange} />

      <Card>
        <CardContent sx={{ p: 3 }}>
          <ShoppingListToolbar
            selectedList={selectedList}
            hasItems={items.length > 0}
            moreActionsAnchor={moreActionsAnchor}
            onOpenMoreActions={setMoreActionsAnchor}
            onCloseMoreActions={() => setMoreActionsAnchor(null)}
            onEditList={openEditListDialog}
            onSuggestIngredients={() => setIsSuggestDialogOpen(true)}
            onOpenTemplates={() => setIsTemplatesDialogOpen(true)}
            onShare={handleShare}
          />

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

          {/* Fase 8: viser at ændringer er gemt lokalt, ikke tavst — jf.
              31_Offline_Data_Policy.md's acceptkriterie om at brugeren
              tydeligt skal kunne se det. Synkroniseres automatisk igen. */}
          {pendingOfflineChangeCount > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {pendingOfflineChangeCount === 1
                ? "1 ændring er gemt lokalt og synkroniseres, når du er online igen."
                : `${pendingOfflineChangeCount} ændringer er gemt lokalt og synkroniseres, når du er online igen.`}
            </Alert>
          )}

          <ShoppingListItems
            isLoading={isLoading}
            items={items}
            isFlatList={isFlatList}
            categories={selectedList ? shoppingCategoriesByListType[selectedList.type] : []}
            onToggleChecked={toggleChecked}
            onChangeCategory={setCategory}
            onRename={renameItem}
            onDelete={deleteItem}
            onClearChecked={clearChecked}
          />
        </CardContent>
      </Card>

      <CreateListDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        name={newListName}
        onNameChange={setNewListName}
        type={newListType}
        onTypeChange={setNewListType}
        onCreate={handleCreateList}
      />

      <EditListDialog
        open={isEditListDialogOpen}
        onClose={closeEditListDialog}
        name={editListName}
        onNameChange={setEditListName}
        type={editListType}
        onTypeChange={setEditListType}
        isDeleteConfirmVisible={isDeleteListConfirmVisible}
        onRequestDeleteConfirm={() => setIsDeleteListConfirmVisible(true)}
        onDelete={handleDeleteList}
        onSave={handleSaveListEdit}
      />

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
