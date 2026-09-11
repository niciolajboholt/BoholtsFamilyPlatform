// Sprint 41 (se
// 01_Project_Documentation/Development/41_Sprint41_Deleoekonomi_Foraeldre_Plan.md):
// et simpelt "hvem betalte/hvem skylder"-overblik mellem forældre for
// fælles udgifter — bevidst IKKE fuld bogføring. Kun familiemedlemmer med
// en tilknyttet konto (linked_user_id) kan indgå som betaler eller
// deltager i en udgift — reelt forældre/voksne, ikke børneprofiler.
//
// Saldoen beregnes ved forespørgsel (samme princip som allowance_ledger,
// Sprint 39), ikke et cachet felt. "Marker som afregnet" indsætter en
// modsvarende (omvendt rettet) række i shared_expense_settlements, der
// nulstiller den beregnede saldo mellem de to medlemmer — se addDebt()
// og settleBalance() nedenfor for selve regnestykket.

import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { parseJsonBody, type Variables } from "./familyQueries";

const sharedExpenses = new Hono<{ Bindings: Env; Variables: Variables }>();

interface SharedExpenseRow {
  id: string;
  familyId: string;
  description: string;
  amount: number;
  paidByMemberId: string;
  splitBetween: string;
  expenseDate: string;
  createdByUserId: string;
  createdAt: string;
}

interface SettlementRow {
  debtorMemberId: string;
  creditorMemberId: string;
  amount: number;
}

async function listExpenses(db: D1Database, familyId: string): Promise<SharedExpenseRow[]> {
  const result = await db
    .prepare(
      `SELECT id, family_id AS familyId, description, amount,
              paid_by_member_id AS paidByMemberId, split_between AS splitBetween,
              expense_date AS expenseDate, created_by_user_id AS createdByUserId, created_at AS createdAt
       FROM shared_expenses
       WHERE family_id = ?
       ORDER BY expense_date DESC, created_at DESC`,
    )
    .bind(familyId)
    .all<SharedExpenseRow>();

  return result.results;
}

// Nettosaldo pr. par af medlemmer, nøglet på de to id'er i sorteret
// rækkefølge, så "A skylder B 50" og "B skylder A -50" altid ender i samme
// nøgle. Positiv værdi betyder den lexikografisk mindste id skylder den
// anden; negativ betyder omvendt.
function addDebt(net: Map<string, number>, debtorId: string, creditorId: string, amount: number): void {
  if (debtorId === creditorId || amount === 0) {
    return;
  }

  const [a, b] = [debtorId, creditorId].sort();
  const key = `${a}|${b}`;
  const signedAmount = debtorId === a ? amount : -amount;

  net.set(key, (net.get(key) ?? 0) + signedAmount);
}

async function computeNetBalances(db: D1Database, familyId: string): Promise<Map<string, number>> {
  const net = new Map<string, number>();
  const expenses = await listExpenses(db, familyId);

  for (const expense of expenses) {
    const splitBetween = JSON.parse(expense.splitBetween) as string[];

    if (splitBetween.length === 0) {
      continue;
    }

    const shareAmount = Math.round(expense.amount / splitBetween.length);

    for (const memberId of splitBetween) {
      if (memberId !== expense.paidByMemberId) {
        addDebt(net, memberId, expense.paidByMemberId, shareAmount);
      }
    }
  }

  const { results: settlements } = await db
    .prepare(
      `SELECT debtor_member_id AS debtorMemberId, creditor_member_id AS creditorMemberId, amount
       FROM shared_expense_settlements WHERE family_id = ?`,
    )
    .bind(familyId)
    .all<SettlementRow>();

  for (const settlement of settlements) {
    addDebt(net, settlement.debtorMemberId, settlement.creditorMemberId, settlement.amount);
  }

  return net;
}

interface BalanceDto {
  debtorMemberId: string;
  creditorMemberId: string;
  amount: number;
}

function toBalanceDtos(net: Map<string, number>): BalanceDto[] {
  const balances: BalanceDto[] = [];

  for (const [key, value] of net) {
    if (value === 0) {
      continue;
    }

    const [a, b] = key.split("|");
    balances.push(value > 0 ? { debtorMemberId: a, creditorMemberId: b, amount: value } : { debtorMemberId: b, creditorMemberId: a, amount: -value });
  }

  return balances;
}

async function isLinkedMember(db: D1Database, familyId: string, memberId: string): Promise<boolean> {
  const member = await db
    .prepare("SELECT id FROM family_members WHERE id = ? AND family_id = ? AND linked_user_id IS NOT NULL")
    .bind(memberId, familyId)
    .first();

  return Boolean(member);
}

sharedExpenses.get("/:id/shared-expenses", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const expenses = await listExpenses(c.env.DB, familyId);

  return c.json({ expenses: expenses.map((expense) => ({ ...expense, splitBetween: JSON.parse(expense.splitBetween) })) });
});

sharedExpenses.get("/:id/shared-expense-balances", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const net = await computeNetBalances(c.env.DB, familyId);

  return c.json({ balances: toBalanceDtos(net) });
});

sharedExpenses.post("/:id/shared-expenses", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    description: string;
    amount: number;
    paidByMemberId: string;
    splitBetween: string[];
    expenseDate: string;
  }>(c);

  const description = body.description?.trim();

  if (!description) {
    return c.json({ error: "Skriv en beskrivelse." }, 400);
  }

  if (typeof body.amount !== "number" || !Number.isInteger(body.amount) || body.amount <= 0) {
    return c.json({ error: "Ugyldigt beløb." }, 400);
  }

  if (!body.expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.expenseDate)) {
    return c.json({ error: "Ugyldig dato." }, 400);
  }

  if (!body.paidByMemberId || !(await isLinkedMember(c.env.DB, familyId, body.paidByMemberId))) {
    return c.json({ error: "Ukendt eller ikke-tilkoblet betaler." }, 400);
  }

  const splitBetween = Array.isArray(body.splitBetween) ? [...new Set(body.splitBetween)] : [];

  if (splitBetween.length === 0) {
    return c.json({ error: "Vælg mindst én til at dele udgiften med." }, 400);
  }

  for (const memberId of splitBetween) {
    if (!(await isLinkedMember(c.env.DB, familyId, memberId))) {
      return c.json({ error: "Ukendt eller ikke-tilkoblet deltager." }, 400);
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO shared_expenses
       (id, family_id, description, amount, paid_by_member_id, split_between, expense_date, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      familyId,
      description,
      body.amount,
      body.paidByMemberId,
      JSON.stringify(splitBetween),
      body.expenseDate,
      user.id,
      new Date().toISOString(),
    )
    .run();

  const expenses = await listExpenses(c.env.DB, familyId);

  return c.json({ expenses: expenses.map((expense) => ({ ...expense, splitBetween: JSON.parse(expense.splitBetween) })) });
});

sharedExpenses.delete("/:id/shared-expenses/:expenseId", async (c) => {
  const familyId = c.req.param("id");
  const expenseId = c.req.param("expenseId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const expense = await c.env.DB.prepare("SELECT id FROM shared_expenses WHERE id = ? AND family_id = ?")
    .bind(expenseId, familyId)
    .first();

  if (!expense) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shared_expenses WHERE id = ?").bind(expenseId).run();

  const expenses = await listExpenses(c.env.DB, familyId);

  return c.json({ expenses: expenses.map((row) => ({ ...row, splitBetween: JSON.parse(row.splitBetween) })) });
});

sharedExpenses.post("/:id/shared-expense-settlements", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ memberIdA: string; memberIdB: string }>(c);

  if (!body.memberIdA || !body.memberIdB || body.memberIdA === body.memberIdB) {
    return c.json({ error: "Vælg to forskellige medlemmer." }, 400);
  }

  const net = await computeNetBalances(c.env.DB, familyId);
  const [a, b] = [body.memberIdA, body.memberIdB].sort();
  const value = net.get(`${a}|${b}`) ?? 0;

  if (value === 0) {
    return c.json({ error: "Ingen saldo at afregne mellem disse to." }, 400);
  }

  // Indsætter en modsvarende (omvendt rettet) række: den, der aktuelt
  // skylder, bliver crediterMemberId her, og omvendt — se addDebt()'s
  // fortegnskonvention. Det er dette, der får den beregnede saldo til at
  // falde tilbage til 0, uden at røre de oprindelige udgiftsrækker.
  const currentDebtorId = value > 0 ? a : b;
  const currentCreditorId = value > 0 ? b : a;
  const amount = Math.abs(value);

  await c.env.DB.prepare(
    `INSERT INTO shared_expense_settlements
       (id, family_id, debtor_member_id, creditor_member_id, amount, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), familyId, currentCreditorId, currentDebtorId, amount, user.id, new Date().toISOString())
    .run();

  const updatedNet = await computeNetBalances(c.env.DB, familyId);

  return c.json({ balances: toBalanceDtos(updatedNet) });
});

export default sharedExpenses;
