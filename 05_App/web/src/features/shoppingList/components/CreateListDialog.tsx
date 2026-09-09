import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from "@mui/material";

import { shoppingListTypeLabels, shoppingListTypes, type ShoppingListType } from "../shoppingListApi";

interface CreateListDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  type: ShoppingListType;
  onTypeChange: (value: ShoppingListType) => void;
  onCreate: () => void;
}

export function CreateListDialog({
  open,
  onClose,
  name,
  onNameChange,
  type,
  onTypeChange,
  onCreate,
}: CreateListDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Opret ny liste</DialogTitle>

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
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Annuller</Button>
        <Button variant="contained" onClick={onCreate} disabled={!name.trim()}>
          Opret
        </Button>
      </DialogActions>
    </Dialog>
  );
}
