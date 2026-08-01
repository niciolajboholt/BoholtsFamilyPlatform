import { Hono } from "hono";

import type { Env } from "../env";
import { getSessionUser } from "../lib/session";

const api = new Hono<{ Bindings: Env }>();

api.get("/me", async (c) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  return c.json({ user });
});

export default api;
