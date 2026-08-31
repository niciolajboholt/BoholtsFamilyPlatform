import { ArrowBackRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";

import type { ActiveActivitySummary } from "../../family/familyApi";
import { buildActivityRows, type ActivityRowIcon } from "../buildActivityRows";

const sectionOrder: ActivityRowIcon[] = ["calendar", "check", "cart", "family"];

const sectionLabels: Record<ActivityRowIcon, string> = {
  calendar: "Kalender",
  check: "Opgaver",
  cart: "Indkøb",
  family: "Familie",
};

interface ActivityFullListDialogProps {
  open: boolean;
  summary: ActiveActivitySummary;
  onBack: () => void;
  onClose: () => void;
}

export function ActivityFullListDialog({ open, summary, onBack, onClose }: ActivityFullListDialogProps) {
  const rows = buildActivityRows(summary);
  const sections = sectionOrder
    .map((icon) => ({ icon, rows: rows.filter((row) => row.icon === icon) }))
    .filter((section) => section.rows.length > 0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton aria-label="Tilbage" onClick={onBack} size="small">
          <ArrowBackRounded fontSize="small" />
        </IconButton>

        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            Alle ændringer
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.totalCount} {summary.totalCount === 1 ? "ting" : "ting"} siden sidst
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {sections.map((section) => (
          <Box key={section.icon}>
            <Typography
              variant="overline"
              sx={{ fontWeight: 700, letterSpacing: 0.5, color: "secondary.main" }}
            >
              {sectionLabels[section.icon]}
            </Typography>

            {section.rows.map((row) => (
              <Box key={row.id} sx={{ py: 0.75 }}>
                <Typography sx={{ fontWeight: 600 }}>{row.title}</Typography>

                {row.detail && (
                  <Typography variant="caption" color="text.secondary">
                    {row.detail}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Luk</Button>
      </DialogActions>
    </Dialog>
  );
}
