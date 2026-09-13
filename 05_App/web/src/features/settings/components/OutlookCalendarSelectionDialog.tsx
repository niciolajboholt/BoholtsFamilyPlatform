import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

import { listAllOutlookCalendars } from "../../calendar/providers/calendarProviderFactory";
import {
  getExcludedOutlookCalendarIds,
  setExcludedOutlookCalendars,
} from "../../calendar/providers/outlook/outlookCalendarExclusionStorage";
import { CalendarSelectionPanel } from "./CalendarSelectionPanel";

interface OutlookCalendarSelectionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OutlookCalendarSelectionDialog({ open, onClose }: OutlookCalendarSelectionDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Vælg Outlook-kalendere</DialogTitle>

      <DialogContent>
        <CalendarSelectionPanel
          isOpen={open}
          listCalendars={listAllOutlookCalendars}
          getExcludedIds={getExcludedOutlookCalendarIds}
          setExcludedIds={setExcludedOutlookCalendars}
          loadErrorMessage="Kunne ikke hente Outlook-kalendere."
          emptyStateMessage="Ingen kalendere fundet på denne konto."
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
