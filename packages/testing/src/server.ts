import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { CryptoKey } from "jose";
import { createCodeChallenge, createProvider } from "oathly";
import type { FetchLike, MappedProfile, Provider } from "oathly";

/** The user the mock server will hand back. Standard OIDC claims. */
export interface MockUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  [claim: string]: unknown;
}

export interface MockAuthServerOptions {
  /** Defaults to `https://mock-idp.oathly.test`. */
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  redirectURI?: string;
  /** The signed-in user. Defaults to a complete, verified account. */
  user?: MockUser;
  /** Scopes the provider requests by default. */
  scopes?: string[];
  /** Seconds until access tokens expire. Defaults to 3600. */
  expiresIn?: number;
}

export interface RecordedRequest {
  url: string;
  method: string;
  body: Record<string, string> | null;
}

export interface MockAuthServer {
  issuer: string;
  /** A provider wired to this server. Hand it straight to `createFlow`. */
  provider: Provider<MockUser>;
  /** The transport, if you want to build your own provider against it. */
  fetch: FetchLike;
  /** Every request the server received. */
  requests: RecordedRequest[];

  /**
   * Simulate the user approving the consent screen.
   * Returns the URL the provider would redirect the browser to.
   */
  authorize(
    authorizationUrl: string | URL,
    options?: { grantedScopes?: string[] },
  ): string;
  /** Simulate the user pressing cancel. */
  deny(authorizationUrl: string | URL, error?: string): string;

  /** Change who is signed in. */
  setUser(user: MockUser): void;
  /** Make the next token request fail with a spec error response. */
  failNextTokenRequest(error: {
    error: string;
    error_description?: string;
    status?: number;
  }): void;
  /** Forget issued codes, recorded requests, and queued failures. */
  reset(): void;
}

const DEFAULT_USER: MockUser = {
  sub: "mock-user-1",
  email: "ada@oathly.test",
  email_verified: true,
  name: "Ada Lovelace",
  preferred_username: "ada",
  picture: "https://oathly.test/ada.png",
};

interface PendingCode {
  codeChallenge: string | null;
  nonce: string | null;
  redirectUri: string;
  scopes: string[];
}

/**
 * An in-process OAuth 2.0 / OpenID Connect authorization server.
 *
 * It implements the parts that matter for testing a login route — PKCE, state,
 * nonce, client authentication, and a properly signed ID token backed by a
 * local JWKS — with no network and no listening socket.
 *
 * ```ts
 * const server = await createMockAuthServer();
 * const flow = createFlow({ provider: server.provider });
 * const { profile } = await completeLogin(flow, server);
 * ```
 */
export async function createMockAuthServer(
  options: MockAuthServerOptions = {},
): Promise<MockAuthServer> {
  const issuer = options.issuer ?? "https://mock-idp.oathly.test";
  const clientId = options.clientId ?? "mock-client-id";
  const clientSecret = options.clientSecret ?? "mock-client-secret";
  const redirectURI = options.redirectURI ?? "https://app.oathly.test/auth/callback";
  const defaultScopes = options.scopes ?? ["openid", "email", "profile"];
  const expiresIn = options.expiresIn ?? 3600;
  const kid = "mock-key-1";

  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };

  let user: MockUser = options.user ?? DEFAULT_USER;
  let queuedFailure: { error: string; error_description?: string; status?: number } | null =
    null;
  const codes = new Map<string, PendingCode>();
  const accessTokens = new Map<string, { scopes: string[] }>();
  const refreshTokens = new Map<string, { scopes: string[] }>();
  const requests: RecordedRequest[] = [];

  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${++counter}`;

  async function issueIdToken(nonce: string | null, key: CryptoKey): Promise<string> {
    // The spread carries any custom claims; sub/iss/aud are set explicitly.
    return new SignJWT({ ...user, ...(nonce ? { nonce } : {}) })
      .setProtectedHeader({ alg: "ES256", kid })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(user.sub)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(key);
  }

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(input.toString());
    const body =
      typeof init?.body === "string" && init.body.startsWith("{")
        ? (JSON.parse(init.body) as Record<string, string>)
        : typeof init?.body === "string"
          ? Object.fromEntries(new URLSearchParams(init.body))
          : null;

    requests.push({ url: url.toString(), method: init?.method ?? "GET", body });

    switch (url.pathname) {
      case "/.well-known/openid-configuration":
        return json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          revocation_endpoint: `${issuer}/revoke`,
          jwks_uri: `${issuer}/jwks`,
          scopes_supported: ["openid", "email", "profile"],
        });

      case "/jwks":
        return json({ keys: [jwk] });

      case "/token":
        return handleToken(body ?? {}, init?.headers as Record<string, string>);

      case "/revoke":
        return new Response(null, { status: 200 });

      case "/userinfo": {
        const authorization =
          (init?.headers as Record<string, string> | undefined)?.["authorization"] ?? "";
        const token = authorization.replace(/^Bearer /i, "");
        if (!accessTokens.has(token)) {
          return json({ error: "invalid_token" }, 401);
        }
        return json(user);
      }

      default:
        return json({ error: "not_found", path: url.pathname }, 404);
    }
  };

  async function handleToken(
    body: Record<string, string>,
    headers: Record<string, string> | undefined,
  ): Promise<Response> {
    if (queuedFailure) {
      const failure = queuedFailure;
      queuedFailure = null;
      return json(
        {
          error: failure.error,
          ...(failure.error_description
            ? { error_description: failure.error_description }
            : {}),
        },
        failure.status ?? 400,
      );
    }

    // Accept either form of client authentication, like a real server.
    const basic = headers?.["authorization"];
    const authenticated =
      (basic?.startsWith("Basic ") &&
        atob(basic.slice(6)) ===
          `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`) ||
      (body["client_id"] === clientId && body["client_secret"] === clientSecret);

    if (!authenticated) {
      return json({ error: "invalid_client" }, 401);
    }

    if (body["grant_type"] === "refresh_token") {
      const stored = refreshTokens.get(body["refresh_token"] ?? "");
      if (!stored) return json({ error: "invalid_grant" }, 400);
      const accessToken = nextId("access");
      accessTokens.set(accessToken, { scopes: stored.scopes });
      return json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        scope: stored.scopes.join(" "),
      });
    }

    if (body["grant_type"] !== "authorization_code") {
      return json({ error: "unsupported_grant_type" }, 400);
    }

    const pending = codes.get(body["code"] ?? "");
    if (!pending) return json({ error: "invalid_grant" }, 400);
    // Authorization codes are single use.
    codes.delete(body["code"] ?? "");

    if (body["redirect_uri"] !== pending.redirectUri) {
      return json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
    }

    if (pending.codeChallenge !== null) {
      const verifier = body["code_verifier"];
      if (!verifier) {
        return json({ error: "invalid_request", error_description: "code_verifier required" }, 400);
      }
      if ((await createCodeChallenge(verifier)) !== pending.codeChallenge) {
        return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
      }
    }

    const accessToken = nextId("access");
    const refreshToken = nextId("refresh");
    accessTokens.set(accessToken, { scopes: pending.scopes });
    refreshTokens.set(refreshToken, { scopes: pending.scopes });

    return json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: pending.scopes.join(" "),
      id_token: await issueIdToken(pending.nonce, privateKey),
    });
  }

  const provider = createProvider<MockUser>(
    {
      id: "mock",
      meta: { name: "Mock IdP", emailTrust: "asserted" },
      authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`,
      revocationEndpoint: `${issuer}/revoke`,
      issuer,
      jwksUri: `${issuer}/jwks`,
      pkce: "required",
      tokenAuth: "client_secret_post",
      defaultScopes,
      profile: {
        fromIdToken: true,
        endpoint: `${issuer}/userinfo`,
        map: (raw): MappedProfile => ({
          id: raw.sub,
          email: raw.email ?? null,
          emailVerified: raw.email_verified === true,
          name: raw.name ?? null,
          username: raw.preferred_username ?? null,
          avatarUrl: raw.picture ?? null,
        }),
      },
    },
    { clientId, clientSecret, redirectURI, fetch: fetchImpl },
  );

  return {
    issuer,
    provider,
    fetch: fetchImpl,
    requests,

    authorize(authorizationUrl, authorizeOptions) {
      const url = new URL(authorizationUrl.toString());
      const params = url.searchParams;

      if (params.get("client_id") !== clientId) {
        throw new Error(
          `mock server: unknown client_id ${params.get("client_id")}. Expected ${clientId}.`,
        );
      }
      const redirectUri = params.get("redirect_uri");
      if (redirectUri !== redirectURI) {
        // Real providers match exactly; so does this, to catch config drift.
        throw new Error(
          `mock server: redirect_uri ${redirectUri} is not registered. Expected ${redirectURI}.`,
        );
      }

      const code = nextId("code");
      codes.set(code, {
        codeChallenge: params.get("code_challenge"),
        nonce: params.get("nonce"),
        redirectUri,
        scopes:
          authorizeOptions?.grantedScopes ??
          (params.get("scope")?.split(" ").filter(Boolean) ?? []),
      });

      const callback = new URL(redirectUri);
      callback.searchParams.set("code", code);
      const state = params.get("state");
      if (state) callback.searchParams.set("state", state);
      return callback.toString();
    },

    deny(authorizationUrl, error = "access_denied") {
      const url = new URL(authorizationUrl.toString());
      const callback = new URL(url.searchParams.get("redirect_uri") ?? redirectURI);
      callback.searchParams.set("error", error);
      callback.searchParams.set("error_description", "The user denied the request.");
      const state = url.searchParams.get("state");
      if (state) callback.searchParams.set("state", state);
      return callback.toString();
    },

    setUser(next) {
      user = next;
    },

    failNextTokenRequest(error) {
      queuedFailure = error;
    },

    reset() {
      codes.clear();
      accessTokens.clear();
      refreshTokens.clear();
      requests.length = 0;
      queuedFailure = null;
    },
  };
}
