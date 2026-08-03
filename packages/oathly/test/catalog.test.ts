import { describe, expect, it } from "vitest";
import { catalogEntries } from "../src/catalog.js";
import { createAuthorizationURL } from "../src/protocol.js";

/**
 * Contract tests every provider must pass. A new provider is one data file plus
 * a fixture; these run against it automatically, so the catalog can grow
 * without each addition needing bespoke review.
 */
describe.each(catalogEntries)("provider contract: %s", (name, provider) => {
  it("has documentation metadata", () => {
    expect(provider.meta?.name, `${name} is missing meta.name`).toBeTruthy();
    expect(["asserted", "unverified", "none"]).toContain(provider.meta?.emailTrust);
  });

  it("uses https for every endpoint", () => {
    const endpoints = [
      provider.authorizationEndpoint,
      provider.tokenEndpoint,
      provider.revocationEndpoint,
      provider.jwksUri,
      provider.profile?.endpoint,
    ].filter(Boolean) as string[];

    expect(endpoints.length).toBeGreaterThan(0);
    for (const endpoint of endpoints) {
      expect(endpoint, `${name}: ${endpoint}`).toMatch(/^https:\/\//);
    }
  });

  it("pairs issuer with jwksUri, so ID tokens are either verifiable or unused", () => {
    // Half a configuration would mean silently skipping verification.
    expect(Boolean(provider.issuer)).toBe(Boolean(provider.jwksUri));
  });

  it("can produce a profile", () => {
    expect(provider.profile).toBeDefined();
    // Either it fetches from somewhere, or it reads verified ID token claims.
    expect(
      Boolean(
        provider.profile?.endpoint ??
          provider.profile?.fetchRaw ??
          provider.profile?.fromIdToken,
      ),
    ).toBe(true);
  });

  it("only reads claims from ID tokens it can verify", () => {
    if (provider.profile?.fromIdToken) {
      expect(provider.issuer, `${name} reads ID token claims`).toBeTruthy();
      expect(provider.jwksUri, `${name} reads ID token claims`).toBeTruthy();
    }
  });

  it("builds a valid authorization URL", async () => {
    const request = await createAuthorizationURL(provider);
    const params = request.url.searchParams;

    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe("client-id");
    expect(params.get("redirect_uri")).toBe("https://example.com/auth/callback");
    expect(params.get("state")).toBe(request.state);

    // PKCE is applied wherever it is supported, with no way to opt out.
    if (provider.pkce === "unsupported") {
      expect(request.codeVerifier).toBeNull();
      expect(params.get("code_challenge")).toBeNull();
    } else {
      expect(request.codeVerifier).toBeTruthy();
      expect(params.get("code_challenge_method")).toBe("S256");
    }
  });

  it("requests a nonce whenever it issues ID tokens", async () => {
    const request = await createAuthorizationURL(provider);
    if (provider.issuer) {
      expect(request.nonce, `${name} issues ID tokens`).toBeTruthy();
      expect(request.url.searchParams.get("nonce")).toBe(request.nonce);
    }
  });
});

describe("catalog", () => {
  it("has no duplicate provider ids", () => {
    const ids = catalogEntries.map(([, provider]) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the providers the README promises", () => {
    const ids = catalogEntries.map(([name]) => name);
    expect(ids).toEqual(expect.arrayContaining(["github", "google", "apple", "discord"]));
    expect(ids.length).toBeGreaterThanOrEqual(16);
  });
});
