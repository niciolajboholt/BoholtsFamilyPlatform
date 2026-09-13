import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

import { IcloudConnectionsPanel } from "./IcloudConnectionsPanel";

interface IcloudConnectionsDialogProps {
  open: boolean;
  onClose: () => void;
}

// Sprint 47: samme mønster som IcsSubscriptionsDialog — sin egen dialog fra
// en række i "Kalenderforbindelser", ikke indlejret indhold, så listen af
// forbundne iCloud-konti ikke fylder den fælles dialog ud.
export function IcloudConnectionsDialog({ open, onClose }: IcloudConnectionsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>iCloud-kalender</DialogTitle>

      <DialogContent>
        <IcloudConnectionsPanel isOpen={open} />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
