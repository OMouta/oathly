import { createCodeChallenge } from "oathly";
import { describe, expect, it } from "vitest";
import * as arctic from "../src/index.js";
import { codeChallengeS256, sha256 } from "../src/sha256.js";

const CLIENT_ID = "client-id";
const CLIENT_SECRET = "client-secret";
const REDIRECT_URI = "https://app.test/callback";

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("synchronous sha256", () => {
  it("matches the known digest of an empty input", () => {
    expect(hex(sha256(new Uint8Array()))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it('matches the known digest of "abc"', () => {
    expect(hex(sha256(new TextEncoder().encode("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches the RFC 7636 PKCE test vector", () => {
    expect(codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("agrees with WebCrypto across a multi-block message", async () => {
    // Longer than 64 bytes, so padding and multi-block handling are exercised.
    const verifier = "a".repeat(200);
    expect(codeChallengeS256(verifier)).toBe(await createCodeChallenge(verifier));
  });

  it("agrees with WebCrypto on inputs that straddle the padding boundary", async () => {
    for (const length of [54, 55, 56, 57, 63, 64, 65, 119, 120]) {
      const verifier = "x".repeat(length);
      expect(codeChallengeS256(verifier), `length ${length}`).toBe(
        await createCodeChallenge(verifier),
      );
    }
  });
});

describe("Arctic API surface", () => {
  it("builds a GitHub authorization URL synchronously", () => {
    const client = new arctic.GitHub(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const url = client.createAuthorizationURL("the-state", ["user:email"]);

    // No await: the whole point of the sync sha256.
    expect(url).toBeInstanceOf(URL);
    expect(url.searchParams.get("state")).toBe("the-state");
    expect(url.searchParams.get("scope")).toBe("user:email");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
  });

  it("builds a PKCE authorization URL with the verifier as the second argument", () => {
    const client = new arctic.Google(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const url = client.createAuthorizationURL("the-state", "the-verifier", [
      "openid",
      "email",
    ]);

    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      codeChallengeS256("the-verifier"),
    );
    expect(url.searchParams.get("scope")).toBe("openid email");
  });

  it("exposes the generators Arctic did", () => {
    expect(arctic.generateState()).toHaveLength(43);
    expect(arctic.generateCodeVerifier()).toHaveLength(43);
  });

  it("explains the one behaviour change instead of failing obscurely", () => {
    // Arctic allowed a null redirect URI; oathly always sends an exact match.
    expect(() => new arctic.GitHub(CLIENT_ID, CLIENT_SECRET, null)).toThrow(
      /explicit redirect URI/,
    );
  });
});

describe("OAuth2Tokens", () => {
  it("keeps Arctic's accessor methods", () => {
    const tokens = new arctic.OAuth2Tokens({
      access_token: "at",
      token_type: "bearer",
      refresh_token: "rt",
      expires_in: 3600,
      scope: "read write",
    });

    expect(tokens.accessToken()).toBe("at");
    expect(tokens.tokenType()).toBe("bearer");
    expect(tokens.hasRefreshToken()).toBe(true);
    expect(tokens.refreshToken()).toBe("rt");
    expect(tokens.scopes()).toEqual(["read", "write"]);
    expect(tokens.accessTokenExpiresAt().getTime()).toBeGreaterThan(Date.now());
    expect(tokens.data["access_token"]).toBe("at");
  });

  it("throws on a missing field, as Arctic did", () => {
    const tokens = new arctic.OAuth2Tokens({ access_token: "at" });

    expect(tokens.hasRefreshToken()).toBe(false);
    expect(() => tokens.refreshToken()).toThrow(/refresh_token/);
  });
});

describe("token exchange", () => {
  const fetchReturning = (body: unknown, status = 200) => async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  it("returns Arctic-shaped tokens", async () => {
    const client = new arctic.Google(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    // The compat classes wrap real oathly providers, so patch the transport.
    (client as unknown as { provider: { fetch: unknown } }).provider.fetch =
      fetchReturning({ access_token: "at", token_type: "Bearer", expires_in: 3600 });

    const tokens = await client.validateAuthorizationCode("code", "verifier");

    expect(tokens).toBeInstanceOf(arctic.OAuth2Tokens);
    expect(tokens.accessToken()).toBe("at");
  });

  it("translates oathly errors into Arctic errors", async () => {
    const client = new arctic.Google(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    (client as unknown as { provider: { fetch: unknown } }).provider.fetch =
      fetchReturning(
        { error: "invalid_grant", error_description: "Code expired" },
        400,
      );

    const error = await client
      .validateAuthorizationCode("code", "verifier")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(arctic.OAuth2RequestError);
    expect((error as arctic.OAuth2RequestError).code).toBe("invalid_grant");
    expect((error as arctic.OAuth2RequestError).description).toBe("Code expired");
  });

  it("translates a transport failure into ArcticFetchError", async () => {
    const client = new arctic.Google(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    (client as unknown as { provider: { fetch: unknown } }).provider.fetch = () => {
      throw new TypeError("connection refused");
    };

    await expect(
      client.validateAuthorizationCode("code", "verifier"),
    ).rejects.toBeInstanceOf(arctic.ArcticFetchError);
  });
});

describe("provider coverage", () => {
  it("exports a class for every provider in the catalog", () => {
    for (const name of [
      "Apple",
      "Bitbucket",
      "Discord",
      "Dropbox",
      "Facebook",
      "GitHub",
      "GitLab",
      "Google",
      "LinkedIn",
      "MicrosoftEntraId",
      "Notion",
      "Reddit",
      "Slack",
      "Spotify",
      "Twitch",
      "Twitter",
    ] as const) {
      expect(arctic[name], name).toBeTypeOf("function");
    }
  });
});
