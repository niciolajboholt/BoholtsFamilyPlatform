// Sprint 39: saldo-overblik pr. familiemedlem — se
// 39_Sprint39_Lommepenge_Opgavebeloenning_Plan.md. Saldoen beregnes ved
// forespørgsel (SUM(amount)), ikke et cachet felt, se allowance_ledger-
// migrationens begrundelse. Selve bogføringen sker i tasksCrud.ts's
// PATCH /:id/tasks/:taskId, sammen med isDone-skiftet.

import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import type { Variables } from "./taskQueries";

const allowance = new Hono<{ Bindings: Env; Variables: Variables }>();

interface AllowanceBalanceRow {
  familyMemberId: string;
  balanceAmount: number;
}

allowance.get("/:id/allowance-balances", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  // Kun medlemmer med mindst én bogført post — et medlem uden nogen
  // belønnede opgaver endnu skal ikke vises som "0 kr." blandt reelle
  // saldi, klienten viser i stedet ingenting for dem.
  const { results } = await c.env.DB.prepare(
    `SELECT family_member_id AS familyMemberId, SUM(amount) AS balanceAmount
     FROM allowance_ledger
     WHERE family_id = ?
     GROUP BY family_member_id`,
  )
    .bind(familyId)
    .all<AllowanceBalanceRow>();

  return c.json({ balances: results });
});

export default allowance;
