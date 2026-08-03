/**
 * Cross-runtime smoke test against the *built* output.
 *
 * The unit tests run on Node against source. This one imports `dist` the way a
 * consumer would and drives a complete login, so "runs everywhere" is verified
 * rather than claimed. Run it under every runtime we support.
 *
 *   node scripts/smoke.mjs
 *   bun scripts/smoke.mjs
 */
import { createFlow, accountKey } from "../packages/oathly/dist/index.js";
import { completeLogin, createMockAuthServer } from "../packages/testing/dist/index.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const runtime = globalThis.Deno
  ? `Deno ${globalThis.Deno.version.deno}`
  : globalThis.Bun
    ? `Bun ${globalThis.Bun.version}`
    : `Node ${process.version}`;

const server = await createMockAuthServer();
const flow = createFlow({ provider: server.provider });
const { tokens, profile, claims } = await completeLogin(flow, server);

assert(tokens.accessToken.startsWith("access-"), "access token was not issued");
assert(tokens.refreshToken !== null, "refresh token was not issued");
assert(profile.id === "mock-user-1", `unexpected profile id: ${profile.id}`);
assert(profile.emailVerified === true, "email should be verified");
assert(claims?.sub === "mock-user-1", "ID token claims were not verified");
assert(accountKey(profile, "mock") === "mock:mock-user-1", "account key mismatch");

// PKCE, state, nonce, and JWKS verification all ran to get here.
console.log(`ok — full login verified on ${runtime}`);
