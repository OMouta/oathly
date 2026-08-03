import { describe, expect, it } from "vitest";
import { OAuthProtocolError, OAuthTokenError } from "../src/errors.js";
import {
  createAuthorizationURL,
  exchangeCode,
  refreshTokens,
} from "../src/protocol.js";
import { github } from "../src/providers/github.js";
import { google } from "../src/providers/google.js";
import { spotify } from "../src/providers/spotify.js";
import { json, mockFetch } from "./helpers.js";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectURI: "https://app.test/callback",
};

describe("createAuthorizationURL", () => {
  it("always sends PKCE when the provider supports it", async () => {
    const request = await createAuthorizationURL(google(credentials));
    expect(request.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(request.url.searchParams.get("code_challenge")).toBeTruthy();
    expect(request.codeVerifier).toBeTruthy();
  });

  it("omits PKCE for providers that reject it", async () => {
    const request = await createAuthorizationURL(github(credentials));
    expect(request.url.searchParams.get("code_challenge")).toBeNull();
    expect(request.codeVerifier).toBeNull();
  });

  it("sends a nonce to OIDC providers and none to plain OAuth2 ones", async () => {
    await expect(
      createAuthorizationURL(google(credentials)).then((r) => r.nonce),
    ).resolves.toBeTruthy();
    await expect(
      createAuthorizationURL(github(credentials)).then((r) => r.nonce),
    ).resolves.toBeNull();
  });

  it("applies provider quirks: Google needs access_type and prompt for a refresh token", async () => {
    const request = await createAuthorizationURL(
      google({ ...credentials, offlineAccess: true }),
    );
    expect(request.url.searchParams.get("access_type")).toBe("offline");
    expect(request.url.searchParams.get("prompt")).toBe("consent");
  });

  it("lets caller params override everything, so nothing is ever blocked", async () => {
    const request = await createAuthorizationURL(google(credentials), {
      params: { prompt: "select_account", login_hint: "a@b.test" },
    });
    expect(request.url.searchParams.get("prompt")).toBe("select_account");
    expect(request.url.searchParams.get("login_hint")).toBe("a@b.test");
  });
});

describe("exchangeCode", () => {
  it("sends the verifier and returns parsed tokens", async () => {
    const mock = mockFetch({
      "oauth2.googleapis.com/token": () =>
        json({
          access_token: "at",
          refresh_token: "rt",
          token_type: "Bearer",
          expires_in: 3599,
          scope: "openid email",
        }),
    });

    const tokens = await exchangeCode(google({ ...credentials, fetch: mock.fetch }), {
      code: "the-code",
      codeVerifier: "the-verifier",
    });

    const sent = mock.find("/token")!;
    expect(sent.body?.get("grant_type")).toBe("authorization_code");
    expect(sent.body?.get("code_verifier")).toBe("the-verifier");
    expect(sent.body?.get("redirect_uri")).toBe(credentials.redirectURI);

    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.scopes).toEqual(["openid", "email"]);
    expect(tokens.expiresAt).toBeInstanceOf(Date);
    expect(tokens.expired).toBe(false);
  });

  it("uses HTTP Basic for providers that require it", async () => {
    const mock = mockFetch({
      "accounts.spotify.com/api/token": () => json({ access_token: "at" }),
    });

    await exchangeCode(spotify({ ...credentials, fetch: mock.fetch }), { code: "c" });

    const sent = mock.find("/api/token")!;
    expect(sent.headers["authorization"]).toBe(
      `Basic ${btoa("client-id:client-secret")}`,
    );
    // The secret must not be duplicated into the body.
    expect(sent.body?.get("client_secret")).toBeNull();
  });

  it("treats GitHub's HTTP 200 error body as an error", async () => {
    // GitHub returns 200 OK with an error payload for a reused code.
    const mock = mockFetch({
      "github.com/login/oauth/access_token": () =>
        json({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or expired.",
        }),
    });

    await expect(
      exchangeCode(github({ ...credentials, fetch: mock.fetch }), { code: "used" }),
    ).rejects.toBeInstanceOf(OAuthTokenError);
  });

  it("reports a spec error response with its code intact", async () => {
    const mock = mockFetch({
      "/token": () => json({ error: "invalid_grant" }, 400),
    });

    const error = await exchangeCode(
      google({ ...credentials, fetch: mock.fetch }),
      { code: "expired" },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthTokenError);
    expect((error as OAuthTokenError).error).toBe("invalid_grant");
    expect((error as OAuthTokenError).provider).toBe("google");
    expect((error as OAuthTokenError).docs).toBe("https://oathly.dev/errors/token_error");
  });

  it("rejects a non-JSON body instead of guessing", async () => {
    const mock = mockFetch({
      "/token": () => new Response("<html>502</html>", { status: 502 }),
    });

    await expect(
      exchangeCode(google({ ...credentials, fetch: mock.fetch }), { code: "c" }),
    ).rejects.toBeInstanceOf(OAuthProtocolError);
  });

  it("rejects a 200 response with no access_token", async () => {
    const mock = mockFetch({ "/token": () => json({ token_type: "Bearer" }) });

    await expect(
      exchangeCode(google({ ...credentials, fetch: mock.fetch }), { code: "c" }),
    ).rejects.toBeInstanceOf(OAuthProtocolError);
  });
});

describe("refreshTokens", () => {
  it("returns null when the provider does not rotate the refresh token", async () => {
    const mock = mockFetch({
      "/token": () => json({ access_token: "new", expires_in: 3600 }),
    });

    const tokens = await refreshTokens(
      google({ ...credentials, fetch: mock.fetch }),
      "old-refresh",
    );

    expect(mock.find("/token")?.body?.get("grant_type")).toBe("refresh_token");
    expect(tokens.accessToken).toBe("new");
    // Callers persist `new ?? old`, so this must be null rather than throwing.
    expect(tokens.refreshToken).toBeNull();
  });
});
