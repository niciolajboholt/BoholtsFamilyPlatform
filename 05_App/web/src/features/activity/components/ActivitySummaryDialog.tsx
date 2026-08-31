import {
  CalendarMonthRounded,
  CheckCircleOutlineRounded,
  CloseRounded,
  FamilyRestroomRounded,
  HistoryRounded,
  ShoppingCartOutlined,
} from "@mui/icons-material";
import {
  Avatar,
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

const iconByType: Record<ActivityRowIcon, typeof CalendarMonthRounded> = {
  calendar: CalendarMonthRounded,
  check: CheckCircleOutlineRounded,
  cart: ShoppingCartOutlined,
  family: FamilyRestroomRounded,
};

// Kun de vigtigste vises her — resten (hvis nogen) ligger bag "Vis alt".
const maxRowsInSummary = 6;

interface ActivitySummaryDialogProps {
  open: boolean;
  summary: ActiveActivitySummary;
  onClose: () => void;
  onShowAll: () => void;
}

export function ActivitySummaryDialog({ open, summary, onClose, onShowAll }: ActivitySummaryDialogProps) {
  const rows = buildActivityRows(summary).slice(0, maxRowsInSummary);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, pr: 1.5 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>
          <HistoryRounded fontSize="small" />
        </Avatar>

        <Box sx={{ flexGrow: 1, minWidth: 0, pt: 0.25 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            Siden sidst du var her
          </Typography>
        </Box>

        <IconButton aria-label="Luk" onClick={onClose} size="small" sx={{ mt: 0.25 }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 0.5, pt: 0 }}>
        {rows.map((row) => {
          const Icon = iconByType[row.icon];

          return (
            <Box key={row.id} sx={{ display: "flex", gap: 1.5, py: 1 }}>
              <Avatar
                variant="rounded"
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: row.attention ? "secondary.main" : "primary.main",
                  opacity: row.attention ? 1 : 0.85,
                }}
              >
                <Icon fontSize="small" />
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{row.title}</Typography>

                {row.detail && (
                  <Typography variant="caption" color="text.secondary">
                    {row.detail}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </DialogContent>

      <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
        <Button onClick={onShowAll}>Vis alt ({summary.totalCount})</Button>
        <Button onClick={onClose} color="inherit">
          Luk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
