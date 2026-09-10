import { useEffect, useState } from "react";

import { DeleteOutlineRounded, PaidRounded } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import type { FamilyMemberDto, SharedExpenseBalanceDto, SharedExpenseDto } from "../../family/familyApi";
import {
  createSharedExpense,
  deleteSharedExpense,
  getMyFamily,
  getSharedExpenseBalances,
  getSharedExpenses,
  settleSharedExpenseBalance,
} from "../../family/familyApi";
import { SettingsSectionHeader } from "./SettingsPrimitives";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Sprint 41: et simpelt "hvem betalte/hvem skylder"-overblik mellem
// forældre, ikke fuld bogføring (se
// 41_Sprint41_Deleoekonomi_Foraeldre_Plan.md). Kun medlemmer med en
// tilknyttet konto (linkedUserId) kan indgå — vises slet ikke for en
// familie med færre end to sådanne medlemmer, da "hvem skylder hvem" ikke
// giver mening for en enlig forælder eller en familie uden koblede konti
// endnu.
export function SharedExpensesSection() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [linkedMembers, setLinkedMembers] = useState<FamilyMemberDto[]>([]);
  const [expenses, setExpenses] = useState<SharedExpenseDto[]>([]);
  const [balances, setBalances] = useState<SharedExpenseBalanceDto[]>([]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState("");
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [expenseDate, setExpenseDate] = useState(todayIso());

  useEffect(() => {
    let isCancelled = false;

    getMyFamily().then((result) => {
      if (isCancelled || !result.ok || !result.data.family) {
        return;
      }

      const family = result.data.family;
      const members = (result.data.members ?? []).filter((member) => member.linkedUserId !== null);

      setFamilyId(family.id);
      setLinkedMembers(members);
      setPaidByMemberId(members[0]?.id ?? "");
      setSplitBetween(members.map((member) => member.id));

      Promise.all([getSharedExpenses(family.id), getSharedExpenseBalances(family.id)]).then(
        ([expensesResult, balancesResult]) => {
          if (isCancelled) {
            return;
          }
          if (expensesResult.ok && expensesResult.data.expenses) {
            setExpenses(expensesResult.data.expenses);
          }
          if (balancesResult.ok && balancesResult.data.balances) {
            setBalances(balancesResult.data.balances);
          }
        },
      );
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  function memberName(id: string): string {
    return linkedMembers.find((member) => member.id === id)?.name ?? "Ukendt";
  }

  function refreshBalances(): void {
    if (!familyId) {
      return;
    }
    getSharedExpenseBalances(familyId).then((result) => {
      if (result.ok && result.data.balances) {
        setBalances(result.data.balances);
      }
    });
  }

  function toggleSplitMember(memberId: string): void {
    setSplitBetween((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  const amountValue = Number(amount);
  const canAdd =
    Boolean(description.trim()) &&
    Boolean(paidByMemberId) &&
    splitBetween.length > 0 &&
    Number.isInteger(amountValue) &&
    amountValue > 0;

  function handleAdd(): void {
    if (!familyId || !canAdd) {
      return;
    }

    createSharedExpense(familyId, {
      description: description.trim(),
      amount: amountValue,
      paidByMemberId,
      splitBetween,
      expenseDate,
    }).then((result) => {
      if (result.ok && result.data.expenses) {
        setExpenses(result.data.expenses);
        setDescription("");
        setAmount("");
        refreshBalances();
      }
    });
  }

  function handleDelete(expenseId: string): void {
    if (!familyId) {
      return;
    }
    deleteSharedExpense(familyId, expenseId).then((result) => {
      if (result.ok && result.data.expenses) {
        setExpenses(result.data.expenses);
        refreshBalances();
      }
    });
  }

  function handleSettle(balance: SharedExpenseBalanceDto): void {
    if (!familyId) {
      return;
    }
    settleSharedExpenseBalance(familyId, balance.debtorMemberId, balance.creditorMemberId).then((result) => {
      if (result.ok && result.data.balances) {
        setBalances(result.data.balances);
      }
    });
  }

  if (!familyId || linkedMembers.length < 2) {
    return null;
  }

  return (
    <>
      <SettingsSectionHeader>Deleøkonomi</SettingsSectionHeader>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Avatar sx={{ bgcolor: "primary.main" }}>
              <PaidRounded />
            </Avatar>

            <Typography variant="body2" color="text.secondary">
              Et overblik over fælles udgifter — ikke fuld bogføring, kun hvem der lagde ud og hvem der skylder.
            </Typography>
          </Box>

          {balances.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Ingen udestående saldo.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
              {balances.map((balance) => (
                <Box
                  key={`${balance.debtorMemberId}-${balance.creditorMemberId}`}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Chip
                    label={`${memberName(balance.debtorMemberId)} skylder ${memberName(balance.creditorMemberId)} ${balance.amount} kr.`}
                  />
                  <Button size="small" onClick={() => handleSettle(balance)}>
                    Marker som afregnet
                  </Button>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ mb: 2 }} />

          {expenses.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {expenses.map((expense, index) => (
                <Box key={expense.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography>{expense.description}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {expense.expenseDate} · {memberName(expense.paidByMemberId)} lagde {expense.amount} kr. ud,
                        delt med {expense.splitBetween.map(memberName).join(", ")}
                      </Typography>
                    </Box>

                    <IconButton
                      aria-label={`Slet ${expense.description}`}
                      size="small"
                      onClick={() => handleDelete(expense.id)}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Box>
                  {index < expenses.length - 1 && <Divider />}
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ display: "grid", gap: 1.5 }}>
            <TextField
              size="small"
              label="Beskrivelse"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField
                size="small"
                type="number"
                label="Beløb (kr.)"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                sx={{ width: 140 }}
              />
              <TextField
                size="small"
                type="date"
                label="Dato"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 170 }}
              />
            </Box>

            <TextField
              select
              size="small"
              label="Betalt af"
              value={paidByMemberId}
              onChange={(event) => setPaidByMemberId(event.target.value)}
              sx={{ maxWidth: 220 }}
            >
              {linkedMembers.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </TextField>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Deles mellem:
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                {linkedMembers.map((member) => (
                  <FormControlLabel
                    key={member.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={splitBetween.includes(member.id)}
                        onChange={() => toggleSplitMember(member.id)}
                      />
                    }
                    label={member.name}
                  />
                ))}
              </Box>
            </Box>

            <Button variant="contained" onClick={handleAdd} disabled={!canAdd} sx={{ justifySelf: "start" }}>
              Tilføj udgift
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
