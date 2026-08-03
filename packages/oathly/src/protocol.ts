import { base64Encode } from "./encoding.js";
import {
  OAuthNetworkError,
  OAuthProtocolError,
  OAuthTokenError,
} from "./errors.js";
import {
  createCodeChallenge,
  generateCodeVerifier,
  generateNonce,
  generateState,
} from "./random.js";
import { OAuthTokens } from "./tokens.js";
import type {
  AuthorizationOptions,
  AuthorizationRequest,
  Provider,
} from "./types.js";

function resolveScopes(
  provider: Provider,
  scopes: readonly string[] | undefined,
): readonly string[] {
  return scopes ?? provider.defaultScopes;
}

/**
 * Build the URL to redirect the user to, along with the values you must keep
 * until the callback.
 *
 * PKCE is applied whenever the provider supports it, with no way to turn it
 * off. A nonce is generated for every OIDC request.
 */
export async function createAuthorizationURL(
  provider: Provider,
  options: AuthorizationOptions = {},
): Promise<AuthorizationRequest> {
  const scopes = resolveScopes(provider, options.scopes);
  const state = options.state ?? generateState();
  const url = new URL(provider.authorizationEndpoint);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("redirect_uri", provider.redirectURI);
  url.searchParams.set("state", state);
  if (scopes.length > 0) {
    url.searchParams.set("scope", scopes.join(provider.scopeSeparator));
  }

  let codeVerifier: string | null = null;
  if (provider.pkce !== "unsupported") {
    codeVerifier = options.codeVerifier ?? generateCodeVerifier();
    url.searchParams.set("code_challenge", await createCodeChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
  }

  // OIDC only: the nonce is echoed into the ID token and checked on the way
  // back. Apple issues ID tokens without an `openid` scope, so key this off the
  // provider being an OIDC issuer as well.
  let nonce: string | null = null;
  if (provider.issuer !== undefined || scopes.includes("openid")) {
    nonce = options.nonce ?? generateNonce();
    url.searchParams.set("nonce", nonce);
  }

  for (const [key, value] of Object.entries(provider.authorizationParams ?? {})) {
    url.searchParams.set(key, value);
  }
  // Caller-supplied params win, so nothing oathly does can block you.
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }

  return { url, state, codeVerifier, nonce };
}

async function tokenRequest(
  provider: Provider,
  body: URLSearchParams,
  requestedScopes: readonly string[],
  fallbackIdToken?: string | null,
): Promise<OAuthTokens> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
    ...provider.tokenHeaders,
  };

  const clientSecret = await provider.getClientSecret();
  if (provider.tokenAuth === "client_secret_basic") {
    // RFC 6749 §2.3.1: form-urlencode the components before base64.
    const credentials = `${encodeURIComponent(provider.clientId)}:${encodeURIComponent(clientSecret ?? "")}`;
    headers["authorization"] = `Basic ${base64Encode(new TextEncoder().encode(credentials))}`;
  } else {
    body.set("client_id", provider.clientId);
    if (clientSecret !== null) body.set("client_secret", clientSecret);
  }

  // Notion rejects form encoding and wants JSON. The spec says otherwise, but
  // the provider is the one holding the tokens.
  if (provider.tokenBodyFormat === "json") {
    headers["content-type"] = "application/json";
  }

  const response = await request(provider, provider.tokenEndpoint, {
    method: "POST",
    headers,
    body:
      provider.tokenBodyFormat === "json"
        ? JSON.stringify(Object.fromEntries(body))
        : body.toString(),
  });

  const parsed = await readJson(provider, response, "token endpoint");

  // GitHub returns HTTP 200 with an error body for a bad code, so the status
  // alone is not enough to tell success from failure.
  const error = parsed["error"];
  if (typeof error === "string" && error !== "") {
    throw new OAuthTokenError(
      provider.id,
      response.status,
      error,
      stringOrNull(parsed["error_description"]),
      stringOrNull(parsed["error_uri"]),
    );
  }
  if (!response.ok) {
    throw new OAuthProtocolError(
      provider.id,
      `Token endpoint returned HTTP ${response.status} without a usable error code.`,
    );
  }

  return OAuthTokens.fromResponse(parsed, {
    providerId: provider.id,
    scopeSeparator: provider.scopeSeparator,
    requestedScopes,
    ...(fallbackIdToken !== undefined ? { fallbackIdToken } : {}),
  });
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(
  provider: Provider,
  options: {
    code: string;
    /** Required when the authorization request used PKCE. */
    codeVerifier?: string | null;
    /** Used to populate `tokens.scopes` when the provider omits `scope`. */
    scopes?: readonly string[];
    params?: Record<string, string>;
  },
): Promise<OAuthTokens> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", options.code);
  body.set("redirect_uri", provider.redirectURI);
  if (options.codeVerifier) body.set("code_verifier", options.codeVerifier);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    body.set(key, value);
  }

  return tokenRequest(provider, body, resolveScopes(provider, options.scopes));
}

/**
 * Exchange a refresh token for a fresh access token.
 *
 * Providers that rotate refresh tokens return a new one; providers that do not
 * return `null`, so persist `newTokens.refreshToken ?? oldRefreshToken`.
 */
export async function refreshTokens(
  provider: Provider,
  refreshToken: string,
  options: { scopes?: readonly string[]; params?: Record<string, string> } = {},
): Promise<OAuthTokens> {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  // Only narrowing is legal here; omitting it keeps the original grant.
  if (options.scopes) {
    body.set("scope", options.scopes.join(provider.scopeSeparator));
  }
  for (const [key, value] of Object.entries(options.params ?? {})) {
    body.set(key, value);
  }

  return tokenRequest(provider, body, resolveScopes(provider, options.scopes), null);
}

/** RFC 7009 token revocation. Resolves quietly when the provider has no revocation endpoint. */
export async function revokeToken(
  provider: Provider,
  token: string,
  options: { tokenTypeHint?: "access_token" | "refresh_token" } = {},
): Promise<void> {
  if (!provider.revocationEndpoint) return;

  const body = new URLSearchParams();
  body.set("token", token);
  if (options.tokenTypeHint) body.set("token_type_hint", options.tokenTypeHint);

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
    ...provider.tokenHeaders,
  };

  const clientSecret = await provider.getClientSecret();
  if (provider.tokenAuth === "client_secret_basic") {
    const credentials = `${encodeURIComponent(provider.clientId)}:${encodeURIComponent(clientSecret ?? "")}`;
    headers["authorization"] = `Basic ${base64Encode(new TextEncoder().encode(credentials))}`;
  } else {
    body.set("client_id", provider.clientId);
    if (clientSecret !== null) body.set("client_secret", clientSecret);
  }

  const response = await request(provider, provider.revocationEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  // RFC 7009: revoking an already-invalid token is a success.
  if (!response.ok && response.status !== 400) {
    throw new OAuthProtocolError(
      provider.id,
      `Revocation endpoint returned HTTP ${response.status}.`,
    );
  }
}

/** fetch, with transport failures turned into a typed error. */
export async function request(
  provider: Provider,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await provider.fetch(url, init);
  } catch (cause) {
    throw new OAuthNetworkError(provider.id, url, cause);
  }
}

export async function readJson(
  provider: Provider,
  response: Response,
  what: string,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new OAuthProtocolError(
      provider.id,
      `${what} returned HTTP ${response.status} with a body that is not JSON.`,
      cause,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new OAuthProtocolError(
      provider.id,
      `${what} returned JSON that is not an object.`,
    );
  }
  return parsed as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}
