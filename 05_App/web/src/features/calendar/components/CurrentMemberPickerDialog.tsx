import {
  Avatar,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material";

import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import { getInitials } from "../utils/getInitials";

interface CurrentMemberPickerDialogProps {
  open: boolean;
  members: CalendarOwner[];
  onClose: () => void;
  onSelect: (memberId: string) => void;
}

/**
 * Vælg hvilket familiemedlem "er mig" på denne enhed (Sprint 18) — bruges
 * fra "Min profil" i Indstillinger.
 */
export function CurrentMemberPickerDialog({
  open,
  members,
  onClose,
  onSelect,
}: CurrentMemberPickerDialogProps) {
  const selectableMembers = members.filter(
    (member) => member.id !== familyPseudoMemberId,
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Hvem er du?</DialogTitle>

      <DialogContent>
        <List sx={{ pt: 0 }}>
          {selectableMembers.map((member) => (
            <ListItemButton
              key={member.id}
              onClick={() => {
                onSelect(member.id);
                onClose();
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: member.color, fontWeight: 700 }}>
                  {getInitials(member.name)}
                </Avatar>
              </ListItemAvatar>

              <ListItemText
                primary={member.name}
                secondary={member.relation}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
