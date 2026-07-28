import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

interface ConfirmDiscardDialogProps {
  open: boolean;
  onContinueEditing: () => void;
  onDiscard: () => void;
}

export function ConfirmDiscardDialog({
  open,
  onContinueEditing,
  onDiscard,
}: ConfirmDiscardDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onContinueEditing}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>
        Forkast ændringer?
      </DialogTitle>

      <DialogContent>
        <DialogContentText>
          Dine ikke-gemte ændringer går tabt,
          hvis du lukker nu.
        </DialogContentText>
      </DialogContent>

      <DialogActions>
        <Button onClick={onContinueEditing}>
          Fortsæt redigering
        </Button>

        <Button
          color="error"
          variant="contained"
          onClick={onDiscard}
        >
          Forkast ændringer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
