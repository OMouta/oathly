import { createFlow, discover, OAuthCallbackError, OAuthTokenError, refreshTokens } from "oathly";
import { beforeEach, describe, expect, it } from "vitest";
import { CookieJar, completeLogin, createMockAuthServer } from "../src/index.js";
import type { MockAuthServer } from "../src/index.js";

let server: MockAuthServer;

beforeEach(async () => {
  server = await createMockAuthServer();
});

describe("completeLogin", () => {
  it("drives a whole login in process and returns a verified user", async () => {
    const flow = createFlow({ provider: server.provider });
    const { tokens, profile, claims } = await completeLogin(flow, server);

    expect(tokens.accessToken).toMatch(/^access-/);
    expect(tokens.refreshToken).toMatch(/^refresh-/);
    expect(profile).toMatchObject({
      id: "mock-user-1",
      email: "ada@oathly.test",
      emailVerified: true,
      name: "Ada Lovelace",
      username: "ada",
    });
    // The ID token was really verified against the server's JWKS.
    expect(claims?.["sub"]).toBe("mock-user-1");
  });

  it("reflects a different signed-in user", async () => {
    server.setUser({ sub: "u2", email: "bob@oathly.test", email_verified: false });
    const flow = createFlow({ provider: server.provider });

    const { profile } = await completeLogin(flow, server);

    expect(profile?.id).toBe("u2");
    expect(profile?.emailVerified).toBe(false);
  });

  it("clears the in-flight cookie by the end of the login", async () => {
    const jar = new CookieJar();
    const flow = createFlow({ provider: server.provider });

    await completeLogin(flow, server, { jar });

    expect(jar.size).toBe(0);
  });

  it("skips the userinfo round-trip when the ID token already has the claims", async () => {
    const flow = createFlow({ provider: server.provider });
    await completeLogin(flow, server);

    expect(server.requests.map((r) => new URL(r.url).pathname)).not.toContain("/userinfo");
  });
});

describe("protocol enforcement", () => {
  it("rejects a token request whose PKCE verifier does not match", async () => {
    const flow = createFlow({ provider: server.provider });
    const start = await flow.start(new Request("https://app.oathly.test/auth/login"));
    const callbackUrl = server.authorize(start.headers.get("location")!);

    // Replay the callback with a *different* flow, so the stored verifier is wrong.
    const otherFlow = createFlow({ provider: server.provider });
    const otherStart = await otherFlow.start(
      new Request("https://app.oathly.test/auth/login"),
    );
    const url = new URL(callbackUrl);
    url.searchParams.set(
      "state",
      new URL(otherStart.headers.get("location")!).searchParams.get("state")!,
    );

    const error = await otherFlow
      .callback(
        new Request(url, {
          headers: {
            cookie: otherStart.headers
              .getSetCookie()
              .map((c) => c.split(";")[0])
              .join("; "),
          },
        }),
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthTokenError);
    expect((error as OAuthTokenError).error).toBe("invalid_grant");
  });

  it("refuses to reuse an authorization code", async () => {
    const flow = createFlow({ provider: server.provider });
    const start = await flow.start(new Request("https://app.oathly.test/auth/login"));
    const cookie = start.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const callbackUrl = server.authorize(start.headers.get("location")!);

    await flow.callback(new Request(callbackUrl, { headers: { cookie } }));

    // The cookie is gone in a real browser, but even with it the code is spent.
    await expect(
      flow.callback(new Request(callbackUrl, { headers: { cookie } })),
    ).rejects.toBeInstanceOf(OAuthTokenError);
  });

  it("rejects an unregistered redirect_uri instead of silently accepting it", async () => {
    expect(() =>
      server.authorize(
        "https://mock-idp.oathly.test/authorize?client_id=mock-client-id&redirect_uri=https://evil.test/callback",
      ),
    ).toThrow(/not registered/);
  });

  it("surfaces a cancelled consent screen as access_denied", async () => {
    const flow = createFlow({ provider: server.provider });
    const start = await flow.start(new Request("https://app.oathly.test/auth/login"));
    const deniedUrl = server.deny(start.headers.get("location")!);

    const error = await flow
      .callback(new Request(deniedUrl))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthCallbackError);
    expect((error as OAuthCallbackError).code).toBe("access_denied");
  });
});

describe("failure injection", () => {
  it("simulates a token endpoint error", async () => {
    server.failNextTokenRequest({
      error: "invalid_grant",
      error_description: "Code expired",
    });
    const flow = createFlow({ provider: server.provider });

    const error = await completeLogin(flow, server).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthTokenError);
    expect((error as OAuthTokenError).errorDescription).toBe("Code expired");
  });

  it("only fails once, so the next login succeeds", async () => {
    server.failNextTokenRequest({ error: "temporarily_unavailable" });
    const flow = createFlow({ provider: server.provider });

    await expect(completeLogin(flow, server)).rejects.toBeTruthy();
    await expect(completeLogin(flow, server)).resolves.toBeTruthy();
  });
});

describe("partial grants", () => {
  it("reports what the user actually granted", async () => {
    const flow = createFlow({ provider: server.provider });

    const { profile } = await completeLogin(flow, server, {
      grantedScopes: ["openid"],
    });

    expect(profile?.grantedScopes).toEqual(["openid"]);
  });
});

describe("refresh", () => {
  it("exchanges a refresh token for a new access token", async () => {
    const flow = createFlow({ provider: server.provider });
    const { tokens } = await completeLogin(flow, server);

    const refreshed = await refreshTokens(server.provider, tokens.refreshToken!);

    expect(refreshed.accessToken).not.toBe(tokens.accessToken);
    expect(refreshed.accessToken).toMatch(/^access-/);
  });
});

describe("discovery", () => {
  it("serves a discovery document that `discover()` accepts", async () => {
    const provider = await discover(server.issuer, {
      clientId: "mock-client-id",
      clientSecret: "mock-client-secret",
      redirectURI: "https://app.oathly.test/auth/callback",
      fetch: server.fetch,
    });

    const flow = createFlow({ provider });
    const { profile } = await completeLogin(flow, server);

    expect(profile?.id).toBe("mock-user-1");
  });
});
