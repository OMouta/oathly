import { describe, expect, it } from "vitest";
import { OAuthCallbackError, OAuthScopeError } from "../src/errors.js";
import { createFlow } from "../src/flow.js";
import { github } from "../src/providers/github.js";
import { cookieHeader, json, mockFetch, readSetCookie } from "./helpers.js";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectURI: "https://app.test/callback",
};

function githubRoutes(overrides: Record<string, () => Response> = {}) {
  return mockFetch({
    "github.com/login/oauth/access_token": () =>
      json({
        access_token: "gho_token",
        token_type: "bearer",
        // GitHub answers with commas even though the request used spaces.
        scope: "read:user,user:email",
      }),
    "api.github.com/user/emails": () =>
      json([
        { email: "old@test.dev", primary: false, verified: true, visibility: null },
        { email: "me@test.dev", primary: true, verified: true, visibility: "public" },
      ]),
    "api.github.com/user": () =>
      json({ id: 4242, login: "octocat", name: "Octo Cat", email: null, avatar_url: "https://avatars.test/4242" }),
    ...overrides,
  });
}

/** Drive start(), then hand the resulting cookie and state back into callback(). */
async function roundTrip(
  flow: ReturnType<typeof createFlow>,
  options: { startUrl?: string; tamperState?: string; dropCookie?: boolean } = {},
) {
  const startResponse = await flow.start(
    new Request(options.startUrl ?? "https://app.test/login"),
  );
  const location = new URL(startResponse.headers.get("location")!);
  const state = options.tamperState ?? location.searchParams.get("state")!;

  const callbackRequest = new Request(
    `https://app.test/callback?code=the-code&state=${state}`,
    options.dropCookie
      ? undefined
      : { headers: { cookie: cookieHeader(startResponse) } },
  );

  return { startResponse, location, result: await flow.callback(callbackRequest) };
}

describe("flow.start", () => {
  it("returns a 302 to the provider and stores the in-flight state", async () => {
    const flow = createFlow({ provider: github(credentials) });
    const response = await flow.start(new Request("https://app.test/login"));

    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("redirect_uri")).toBe(credentials.redirectURI);

    expect(readSetCookie(response, "__Host-oathly.github")).toBeTruthy();
  });

  it("uses the __Host- prefix over https and drops it over http", async () => {
    const flow = createFlow({ provider: github(credentials) });

    const secure = await flow.start(new Request("https://app.test/login"));
    expect(secure.headers.getSetCookie()[0]).toContain("__Host-");
    expect(secure.headers.getSetCookie()[0]).toContain("Secure");

    const local = await flow.start(new Request("http://localhost:3000/login"));
    expect(local.headers.getSetCookie()[0]).not.toContain("__Host-");
    expect(local.headers.getSetCookie()[0]).not.toContain("Secure");
  });

  it("honours x-forwarded-proto so proxied apps still get secure cookies", async () => {
    const flow = createFlow({ provider: github(credentials) });
    const response = await flow.start(
      new Request("http://internal:3000/login", {
        headers: { "x-forwarded-proto": "https,http" },
      }),
    );
    expect(response.headers.getSetCookie()[0]).toContain("Secure");
  });

  it("marks the cookie HttpOnly, SameSite=Lax, and short-lived", async () => {
    const flow = createFlow({ provider: github(credentials) });
    const cookie = (await flow.start(new Request("https://app.test/login")))
      .headers.getSetCookie()[0]!;

    expect(cookie).toContain("HttpOnly");
    // Lax survives the provider's top-level redirect back; Strict would not.
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=600");
  });
});

describe("flow.callback", () => {
  it("completes the round trip and returns a normalized profile", async () => {
    const mock = githubRoutes();
    const flow = createFlow({ provider: github({ ...credentials, fetch: mock.fetch }) });

    const { result } = await roundTrip(flow);

    expect(result.tokens.accessToken).toBe("gho_token");
    expect(result.tokens.scopes).toEqual(["read:user", "user:email"]);
    expect(result.profile).toEqual({
      id: "4242",
      email: "me@test.dev",
      emailVerified: true,
      name: "Octo Cat",
      username: "octocat",
      avatarUrl: "https://avatars.test/4242",
      grantedScopes: ["read:user", "user:email"],
      raw: expect.objectContaining({ id: 4242, login: "octocat" }),
    });
  });

  it("clears the in-flight cookie so the callback cannot be replayed", async () => {
    const mock = githubRoutes();
    const flow = createFlow({ provider: github({ ...credentials, fetch: mock.fetch }) });

    const { result } = await roundTrip(flow);
    const cleared = result.headers.getSetCookie()[0]!;

    expect(cleared).toContain("__Host-oathly.github=");
    expect(cleared).toContain("Max-Age=0");
  });

  it("rejects a state that does not match the cookie", async () => {
    const mock = githubRoutes();
    const flow = createFlow({ provider: github({ ...credentials, fetch: mock.fetch }) });

    const error = await roundTrip(flow, { tamperState: "attacker-state" }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(OAuthCallbackError);
    expect((error as OAuthCallbackError).code).toBe("state_mismatch");
    // The code must never be exchanged when state fails.
    expect(mock.find("access_token")).toBeUndefined();
  });

  it("rejects a callback with no in-flight cookie", async () => {
    const mock = githubRoutes();
    const flow = createFlow({ provider: github({ ...credentials, fetch: mock.fetch }) });

    const error = await roundTrip(flow, { dropCookie: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthCallbackError);
    expect((error as OAuthCallbackError).code).toBe("missing_flow_state");
  });

  it("surfaces a cancelled login as access_denied rather than a crash", async () => {
    const flow = createFlow({ provider: github(credentials) });
    const error = await flow
      .callback(
        new Request(
          "https://app.test/callback?error=access_denied&error_description=The+user+denied+access",
        ),
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthCallbackError);
    expect((error as OAuthCallbackError).code).toBe("access_denied");
    expect((error as OAuthCallbackError).providerError).toBe("access_denied");
  });

  it("reads form-posted callbacks, the way Apple sends them", async () => {
    const mock = githubRoutes();
    const flow = createFlow({ provider: github({ ...credentials, fetch: mock.fetch }) });

    const start = await flow.start(new Request("https://app.test/login"));
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;

    const body = new URLSearchParams({ code: "the-code", state });
    const result = await flow.callback(
      new Request("https://app.test/callback", {
        method: "POST",
        headers: {
          cookie: cookieHeader(start),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }),
    );

    expect(result.profile?.id).toBe("4242");
  });

  it("skips the profile request when asked for tokens only", async () => {
    const mock = githubRoutes();
    const flow = createFlow({
      provider: github({ ...credentials, fetch: mock.fetch }),
      profile: false,
    });

    const { result } = await roundTrip(flow);

    expect(result.profile).toBeNull();
    expect(mock.find("api.github.com")).toBeUndefined();
  });

  it("throws only for scopes the app declared essential", async () => {
    const mock = githubRoutes({
      "github.com/login/oauth/access_token": () =>
        json({ access_token: "gho_token", scope: "read:user" }),
    });

    // A partial grant alone is not an error.
    const permissive = createFlow({ provider: github({ ...credentials, fetch: mock.fetch }) });
    await expect(roundTrip(permissive)).resolves.toBeDefined();

    const strict = createFlow({
      provider: github({ ...credentials, fetch: mock.fetch }),
      requireScopes: ["user:email"],
    });
    const error = await roundTrip(strict).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OAuthScopeError);
    expect((error as OAuthScopeError).missing).toEqual(["user:email"]);
  });
});
