import { Hono } from "hono";

export type Bindings = {
  APP_ENV?: string;
};

export const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, env: c.env?.APP_ENV ?? "development" }));

export default app;
