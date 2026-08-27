import { useState } from "react";

import { BookmarkAddOutlined } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@mui/material";

import type { ShoppingListTemplateDto } from "../shoppingListApi";
import { TemplateRow } from "./TemplateRow";

interface TemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  templates: ShoppingListTemplateDto[];
  hasItems: boolean;
  onSave: (name: string) => Promise<void>;
  onApply: (templateId: string) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
  onRename: (templateId: string, name: string) => Promise<void>;
  onAddItem: (templateId: string, name: string) => Promise<void>;
  onDeleteItem: (templateId: string, itemId: string) => Promise<void>;
}

// Mønster efter SuggestIngredientsDialog — samme slags
// "vælg/handling"-dialog, blot med skabelonens FASTE varenavne i stedet for
// AI-genererede forslag, og uden en afkrydsningsbar udvælgelse (en skabelon
// tilføjes altid i sin helhed; man kan altid slette enkeltvarer bagefter).
export function TemplatesDialog({
  open,
  onClose,
  templates,
  hasItems,
  onSave,
  onApply,
  onDelete,
  onRename,
  onAddItem,
  onDeleteItem,
}: TemplatesDialogProps) {
  const [isSaveFormOpen, setIsSaveFormOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose(): void {
    setIsSaveFormOpen(false);
    setNewTemplateName("");
    setEditingTemplateId(null);
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
              <TemplateRow
                key={template.id}
                template={template}
                isEditing={editingTemplateId === template.id}
                isApplying={applyingTemplateId === template.id}
                onToggleEditing={() =>
                  setEditingTemplateId((current) => (current === template.id ? null : template.id))
                }
                onApply={() => handleApply(template.id)}
                onDelete={() => void onDelete(template.id)}
                onRename={(name) => onRename(template.id, name)}
                onAddItem={(name) => onAddItem(template.id, name)}
                onDeleteItem={(itemId) => onDeleteItem(template.id, itemId)}
              />
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
