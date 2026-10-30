import { Hono } from "hono";
import { bankRoutes, type BankEnv } from "./bank/routes";
import { session, type SessionVars } from "./session";

export type Bindings = BankEnv & {
  APP_ENV?: string;
};

export function createApp(bank: Parameters<typeof bankRoutes>[0] = {}) {
  const app = new Hono<{ Bindings: Bindings; Variables: SessionVars }>().basePath("/api");

  app.get("/health", (c) => c.json({ ok: true, env: c.env?.APP_ENV ?? "development" }));

  app.use("/session", session);
  app.use("/bank/*", session);

  // The app uses the user ID only to identify the customer in analytics.
  app.get("/session", (c) => c.json({ userId: c.var.userId }));

  app.route("/bank", bankRoutes(bank));
  return app;
}

export const app = createApp();

export default app;
