import {
  AutoAwesomeOutlined,
  BookmarksOutlined,
  EditRounded,
  IosShareRounded,
  MoreVertRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import { Avatar, Box, IconButton, Menu, MenuItem, Typography } from "@mui/material";

import type { ShoppingListDto } from "../shoppingListApi";
import { shoppingListTypeLabels } from "../shoppingListApi";

interface ShoppingListToolbarProps {
  selectedList: ShoppingListDto | undefined;
  hasItems: boolean;
  moreActionsAnchor: HTMLElement | null;
  onOpenMoreActions: (anchor: HTMLElement) => void;
  onCloseMoreActions: () => void;
  onEditList: () => void;
  onSuggestIngredients: () => void;
  onOpenTemplates: () => void;
  onShare: () => void;
}

export function ShoppingListToolbar({
  selectedList,
  hasItems,
  moreActionsAnchor,
  onOpenMoreActions,
  onCloseMoreActions,
  onEditList,
  onSuggestIngredients,
  onOpenTemplates,
  onShare,
}: ShoppingListToolbarProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
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
        onClick={(event) => onOpenMoreActions(event.currentTarget)}
      >
        <MoreVertRounded />
      </IconButton>

      <Menu anchorEl={moreActionsAnchor} open={Boolean(moreActionsAnchor)} onClose={onCloseMoreActions}>
        <MenuItem
          disabled={!selectedList}
          onClick={() => {
            onCloseMoreActions();
            onEditList();
          }}
        >
          <EditRounded fontSize="small" sx={{ mr: 1.5 }} />
          Rediger liste
        </MenuItem>

        {selectedList?.type !== "andet" && (
          <MenuItem
            onClick={() => {
              onCloseMoreActions();
              onSuggestIngredients();
            }}
          >
            <AutoAwesomeOutlined fontSize="small" sx={{ mr: 1.5 }} />
            Foreslå varer ud fra en ret
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            onCloseMoreActions();
            onOpenTemplates();
          }}
        >
          <BookmarksOutlined fontSize="small" sx={{ mr: 1.5 }} />
          Skabeloner
        </MenuItem>

        <MenuItem
          disabled={!hasItems}
          onClick={() => {
            onCloseMoreActions();
            onShare();
          }}
        >
          <IosShareRounded fontSize="small" sx={{ mr: 1.5 }} />
          Del liste som tekst
        </MenuItem>
      </Menu>
    </Box>
  );
}
