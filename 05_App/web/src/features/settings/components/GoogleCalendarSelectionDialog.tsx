import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

import { listAllGoogleCalendars } from "../../calendar/providers/calendarProviderFactory";
import {
  getExcludedGoogleCalendarIds,
  setExcludedGoogleCalendars,
} from "../../calendar/preferences/googleCalendarExclusionStorage";
import { CalendarSelectionPanel } from "./CalendarSelectionPanel";

interface GoogleCalendarSelectionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GoogleCalendarSelectionDialog({ open, onClose }: GoogleCalendarSelectionDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Vælg Google-kalendere</DialogTitle>

      <DialogContent>
        <CalendarSelectionPanel
          isOpen={open}
          listCalendars={listAllGoogleCalendars}
          getExcludedIds={getExcludedGoogleCalendarIds}
          setExcludedIds={setExcludedGoogleCalendars}
          loadErrorMessage="Kunne ikke hente Google-kalendere."
          emptyStateMessage="Ingen kalendere fundet på denne konto."
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
