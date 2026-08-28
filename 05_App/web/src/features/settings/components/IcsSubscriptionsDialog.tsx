import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

import { IcsSubscriptionsPanel } from "./IcsSubscriptionsPanel";

interface IcsSubscriptionsDialogProps {
  open: boolean;
  onClose: () => void;
}

// Åbnes fra sin egen række i "Kalenderforbindelser"-dialogen (ligesom
// Google/Outlook-rækkerne), ikke som indlejret indhold i selve dialogen —
// efter ønske fra Nicolaj, så listen af delte kalendere ikke fylder
// Kalenderforbindelser-dialogen ud, men i stedet får sin egen dialog, samme
// niveau som Google/Outlook-forbindelserne.
export function IcsSubscriptionsDialog({ open, onClose }: IcsSubscriptionsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delte kalendere</DialogTitle>

      <DialogContent>
        <IcsSubscriptionsPanel isOpen={open} />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
