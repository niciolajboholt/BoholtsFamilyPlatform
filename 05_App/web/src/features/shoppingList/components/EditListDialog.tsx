import { DeleteOutlineRounded } from "@mui/icons-material";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";

import { shoppingListTypeLabels, shoppingListTypes, type ShoppingListType } from "../shoppingListApi";

interface EditListDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  type: ShoppingListType;
  onTypeChange: (value: ShoppingListType) => void;
  isDeleteConfirmVisible: boolean;
  onRequestDeleteConfirm: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export function EditListDialog({
  open,
  onClose,
  name,
  onNameChange,
  type,
  onTypeChange,
  isDeleteConfirmVisible,
  onRequestDeleteConfirm,
  onDelete,
  onSave,
}: EditListDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rediger liste</DialogTitle>

      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Navn"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />

        <RadioGroup
          value={type}
          onChange={(event) => onTypeChange(event.target.value as ShoppingListType)}
          sx={{ mt: 1 }}
        >
          {shoppingListTypes.map((listType) => (
            <FormControlLabel
              key={listType}
              value={listType}
              control={<Radio />}
              label={shoppingListTypeLabels[listType]}
            />
          ))}
        </RadioGroup>

        <Divider sx={{ my: 2 }} />

        {isDeleteConfirmVisible ? (
          <Alert
            severity="warning"
            action={
              <Button color="error" size="small" onClick={onDelete}>
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
            onClick={onRequestDeleteConfirm}
          >
            Slet liste
          </Button>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annuller</Button>
        <Button variant="contained" onClick={onSave} disabled={!name.trim()}>
          Gem
        </Button>
      </DialogActions>
    </Dialog>
  );
}
