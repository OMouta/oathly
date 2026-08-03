import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { CryptoKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { OAuthProtocolError } from "../src/errors.js";
import { verifyIdToken } from "../src/idtoken.js";
import { google } from "../src/providers/google.js";
import type { Provider } from "../src/types.js";
import { json, mockFetch } from "./helpers.js";

const KID = "test-key";
const CLIENT_ID = "client-id";

let privateKey: CryptoKey;
let provider: Provider;
/** A second key, never published in the JWKS — stands in for a forged token. */
let attackerKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  privateKey = pair.privateKey;
  attackerKey = (await generateKeyPair("ES256", { extractable: true })).privateKey;

  const jwk = await exportJWK(pair.publicKey);
  const mock = mockFetch({
    "googleapis.com/oauth2/v3/certs": () =>
      json({ keys: [{ ...jwk, kid: KID, alg: "ES256", use: "sig" }] }),
  });

  provider = google({
    clientId: CLIENT_ID,
    clientSecret: "secret",
    redirectURI: "https://app.test/callback",
    fetch: mock.fetch,
  });
});

async function issue(
  claims: Record<string, unknown>,
  options: { issuer?: string; audience?: string; expiresIn?: string; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: KID })
    .setIssuer(options.issuer ?? "https://accounts.google.com")
    .setAudience(options.audience ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "5m")
    .sign(options.key ?? privateKey);
}

describe("verifyIdToken", () => {
  it("returns the claims of a valid token", async () => {
    const token = await issue({ sub: "user-1", email: "a@test.dev", nonce: "n1" });
    const claims = await verifyIdToken(provider, token, { nonce: "n1" });

    expect(claims["sub"]).toBe("user-1");
    expect(claims["email"]).toBe("a@test.dev");
  });

  it("rejects a token signed by a key that is not in the JWKS", async () => {
    // The whole point: an unverified ID token is attacker-controlled JSON.
    const forged = await issue({ sub: "admin" }, { key: attackerKey });
    await expect(verifyIdToken(provider, forged)).rejects.toBeInstanceOf(
      OAuthProtocolError,
    );
  });

  it("rejects a token minted for a different client", async () => {
    const token = await issue({ sub: "user-1" }, { audience: "someone-elses-app" });
    await expect(verifyIdToken(provider, token)).rejects.toBeInstanceOf(
      OAuthProtocolError,
    );
  });

  it("rejects a token from a different issuer", async () => {
    const token = await issue({ sub: "user-1" }, { issuer: "https://evil.test" });
    await expect(verifyIdToken(provider, token)).rejects.toBeInstanceOf(
      OAuthProtocolError,
    );
  });

  it("rejects an expired token", async () => {
    const token = await issue({ sub: "user-1" }, { expiresIn: "-5m" });
    await expect(verifyIdToken(provider, token)).rejects.toBeInstanceOf(
      OAuthProtocolError,
    );
  });

  it("rejects a replayed token whose nonce does not match this login", async () => {
    const token = await issue({ sub: "user-1", nonce: "from-another-login" });
    const error = await verifyIdToken(provider, token, { nonce: "this-login" }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(OAuthProtocolError);
    expect((error as Error).message).toContain("nonce");
  });

  it("rejects a token with no nonce when one was requested", async () => {
    const token = await issue({ sub: "user-1" });
    await expect(
      verifyIdToken(provider, token, { nonce: "expected" }),
    ).rejects.toBeInstanceOf(OAuthProtocolError);
  });
});
