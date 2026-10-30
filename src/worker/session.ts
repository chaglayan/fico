import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

// Until sign-in exists (slice 1), each browser gets an anonymous session: a
// random secret in an HttpOnly cookie. The user ID is a hash of it, so the ID
// can go to Yapily and PostHog without giving anyone the key to the session.

const COOKIE = "fico_session";
const MAX_AGE = 400 * 24 * 60 * 60;

export type SessionVars = { userId: string };

export const session = createMiddleware<{ Variables: SessionVars }>(async (c, next) => {
  let secret = getCookie(c, COOKIE);
  if (!secret || !/^[0-9a-f]{64}$/.test(secret)) {
    secret = hex(crypto.getRandomValues(new Uint8Array(32)));
    setCookie(c, COOKIE, secret, {
      path: "/",
      httpOnly: true,
      // Lax, so the cookie comes along when the bank sends the customer back.
      sameSite: "Lax",
      secure: new URL(c.req.url).protocol === "https:",
      maxAge: MAX_AGE,
    });
  }
  c.set("userId", await userIdFor(secret));
  await next();
});

export async function userIdFor(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return `u_${hex(new Uint8Array(digest)).slice(0, 32)}`;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
