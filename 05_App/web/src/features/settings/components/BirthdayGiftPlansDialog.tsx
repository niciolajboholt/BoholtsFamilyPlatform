import { useEffect, useState } from "react";

import { DeleteOutlineRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

import type { BirthdayGiftPlanDto } from "../../family/familyApi";
import {
  createBirthdayGiftPlan,
  deleteBirthdayGiftPlan,
  getBirthdayGiftPlans,
  updateBirthdayGiftPlan,
} from "../../family/familyApi";

interface BirthdayGiftPlansDialogProps {
  open: boolean;
  onClose: () => void;
  familyId: string;
  memberId: string;
  memberName: string;
}

const currentYear = new Date().getFullYear();

export function BirthdayGiftPlansDialog({
  open,
  onClose,
  familyId,
  memberId,
  memberName,
}: BirthdayGiftPlansDialogProps) {
  const [plans, setPlans] = useState<BirthdayGiftPlanDto[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [newBudget, setNewBudget] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    getBirthdayGiftPlans(familyId).then((result) => {
      if (result.ok && result.data.plans) {
        setPlans(result.data.plans);
      }
    });
  }, [open, familyId]);

  const plansForMember = plans
    .filter((plan) => plan.familyMemberId === memberId)
    .sort((a, b) => b.year - a.year);

  function handleAdd(): void {
    if (!newIdea.trim()) {
      return;
    }

    const budgetAmount = newBudget.trim() ? Number(newBudget) : undefined;

    createBirthdayGiftPlan(familyId, {
      familyMemberId: memberId,
      year: currentYear,
      giftIdea: newIdea.trim(),
      budgetAmount,
    }).then((result) => {
      if (result.ok && result.data.plans) {
        setPlans(result.data.plans);
        setNewIdea("");
        setNewBudget("");
      }
    });
  }

  function handleTogglePurchased(plan: BirthdayGiftPlanDto): void {
    updateBirthdayGiftPlan(familyId, plan.id, { isPurchased: !plan.isPurchased }).then((result) => {
      if (result.ok && result.data.plans) {
        setPlans(result.data.plans);
      }
    });
  }

  function handleDelete(planId: string): void {
    deleteBirthdayGiftPlan(familyId, planId).then((result) => {
      if (result.ok && result.data.plans) {
        setPlans(result.data.plans);
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Gaveideer til {memberName}</DialogTitle>

      <DialogContent sx={{ display: "grid", gap: 2 }}>
        {plansForMember.length === 0 ? (
          <Typography color="text.secondary">Ingen gaveideer endnu.</Typography>
        ) : (
          <Box>
            {plansForMember.map((plan) => (
              <Box
                key={plan.id}
                sx={{ display: "flex", alignItems: "center", gap: 1, opacity: plan.isPurchased ? 0.5 : 1 }}
              >
                <Checkbox checked={Boolean(plan.isPurchased)} onChange={() => handleTogglePurchased(plan)} />

                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography>{plan.giftIdea}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {plan.year}
                    {plan.budgetAmount !== null ? ` · ${plan.budgetAmount} kr.` : ""}
                  </Typography>
                </Box>

                <IconButton
                  aria-label={`Slet ${plan.giftIdea}`}
                  size="small"
                  onClick={() => handleDelete(plan.id)}
                >
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Ny gaveide"
            value={newIdea}
            onChange={(event) => setNewIdea(event.target.value)}
          />
          <TextField
            size="small"
            type="number"
            label="Budget (kr.)"
            value={newBudget}
            onChange={(event) => setNewBudget(event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            sx={{ width: 130 }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Luk</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!newIdea.trim()}>
          Tilføj
        </Button>
      </DialogActions>
    </Dialog>
  );
}
