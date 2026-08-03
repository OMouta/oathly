/**
 * Random value and PKCE generation. WebCrypto only — no `node:crypto`, so this
 * runs unchanged on Node, Bun, Deno, Workers, and every edge runtime.
 */

import { base64UrlEncode } from "./encoding.js";

function webcrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.getRandomValues || !c.subtle) {
    throw new Error(
      "oathly requires the WebCrypto API (globalThis.crypto.subtle). " +
        "Node 20+, Bun, Deno, and all edge runtimes provide it.",
    );
  }
  return c;
}

/** 256 bits of entropy, base64url encoded. */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  webcrypto().getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** CSRF token binding the authorization request to the callback. */
export const generateState = randomToken;

/** Replay guard for OIDC ID tokens. */
export const generateNonce = randomToken;

/**
 * RFC 7636 code verifier. 43 characters of base64url, which is the spec minimum
 * and 256 bits of entropy — there is no reason to go longer.
 */
export const generateCodeVerifier = randomToken;

/** RFC 7636 S256 challenge. `plain` is never supported; it defeats the point of PKCE. */
export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await webcrypto().subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Length-independent constant-time comparison, used for state.
 *
 * Timing attacks on state are largely theoretical, but this costs nothing and
 * removes the need to think about it.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  // Compare lengths without early return, then fold the length check into the result.
  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}
