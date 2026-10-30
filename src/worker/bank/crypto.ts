// Consent tokens are encrypted at rest with AES-GCM. The key is the TOKEN_KEY
// secret: 32 random bytes, base64. Outside production a fixed development key
// is used when the secret isn't set, so the simulated bank works with no setup.

const DEV_KEY_SEED = "fico-development-only-not-secret";

export async function tokenKey(secret: string | undefined, appEnv: string | undefined): Promise<CryptoKey> {
  let raw: Uint8Array;
  if (secret) {
    raw = Uint8Array.from(atob(secret), (ch) => ch.charCodeAt(0));
    if (raw.length !== 32) throw new Error("TOKEN_KEY must be 32 bytes, base64-encoded");
  } else if (appEnv === "production") {
    throw new Error("TOKEN_KEY is not set");
  } else {
    raw = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(DEV_KEY_SEED)));
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decrypt(key: CryptoKey, sealed: string): Promise<string> {
  const bytes = Uint8Array.from(atob(sealed), (ch) => ch.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(plain);
}
