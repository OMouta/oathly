import { createCookieStore, type FlowStore } from "./cookies.js";
import { OAuthCallbackError, OAuthScopeError } from "./errors.js";
import { canVerifyIdToken, verifyIdToken } from "./idtoken.js";
import { fetchProfile } from "./profile.js";
import { createAuthorizationURL, exchangeCode } from "./protocol.js";
import { constantTimeEqual } from "./random.js";
import { base64UrlToUtf8, utf8ToBase64Url } from "./encoding.js";
import type { OAuthTokens } from "./tokens.js";
import type { Profile, Provider } from "./types.js";

export interface FlowOptions<TRaw> {
  provider: Provider<TRaw>;
  /** Defaults to the provider's `defaultScopes`. */
  scopes?: readonly string[];
  /**
   * Scopes the app genuinely cannot work without. Missing ones throw
   * `OAuthScopeError` so you can re-prompt.
   *
   * A user declining an optional permission is a choice, not an error, so
   * nothing is enforced unless you list it here. Note that providers which omit
   * `scope` from the token response cannot be checked at all — `tokens.scopes`
   * falls back to what was requested.
   */
  requireScopes?: readonly string[];
  /** Set false to skip the profile request and return tokens only. */
  profile?: boolean;
  /** Extra authorization parameters. */
  params?: Record<string, string>;
  cookie?: {
    /** Defaults to `oathly.<providerId>`. */
    name?: string;
    /** Inferred from the request scheme (and `x-forwarded-proto`) when omitted. */
    secure?: boolean;
    path?: string;
    maxAge?: number;
    sameSite?: "Lax" | "None";
  };
  /** Replace cookie storage entirely — KV, memory, whatever fits. */
  store?: FlowStore;
}

export interface CallbackResult<TRaw> {
  tokens: OAuthTokens;
  /** `null` only when `profile: false`. */
  profile: Profile<TRaw> | null;
  /** Verified ID token claims, for providers that issue one. */
  claims: Record<string, unknown> | null;
  /** The raw callback parameters. */
  params: Record<string, string>;
  /**
   * Headers that clear the in-flight cookie. Merge these into whatever
   * response you send, alongside your own session cookie.
   */
  headers: Headers;
}

export interface Flow<TRaw> {
  /** Build the redirect to the provider. Returns a 302 with the state cookie set. */
  start(request?: Request, options?: { scopes?: readonly string[]; params?: Record<string, string> }): Promise<Response>;
  /** Validate the callback and exchange the code. Throws typed errors on failure. */
  callback(request: Request): Promise<CallbackResult<TRaw>>;
}

interface FlowState {
  s: string;
  v: string | null;
  n: string | null;
}

/**
 * The framework-agnostic layer: `Request` in, `Response` (or a result) out.
 *
 * Works unchanged on Hono, Next App Router, SvelteKit, Remix, Nitro, Elysia,
 * Bun, Deno, and Workers. Node's `req`/`res` needs `@oathly/node`.
 */
export function createFlow<TRaw>(options: FlowOptions<TRaw>): Flow<TRaw> {
  const { provider } = options;
  const cookieName = options.cookie?.name ?? `oathly.${provider.id}`;

  function storeFor(request: Request | undefined): FlowStore {
    if (options.store) return options.store;
    return createCookieStore({
      secure: options.cookie?.secure ?? isSecure(request),
      ...(options.cookie?.path !== undefined ? { path: options.cookie.path } : {}),
      ...(options.cookie?.maxAge !== undefined ? { maxAge: options.cookie.maxAge } : {}),
      ...(options.cookie?.sameSite !== undefined ? { sameSite: options.cookie.sameSite } : {}),
    });
  }

  return {
    async start(request, startOptions) {
      const authorization = await createAuthorizationURL(provider, {
        scopes: startOptions?.scopes ?? options.scopes ?? provider.defaultScopes,
        params: { ...options.params, ...startOptions?.params },
      });

      const state: FlowState = {
        s: authorization.state,
        v: authorization.codeVerifier,
        n: authorization.nonce,
      };

      const headers = new Headers(
        await storeFor(request).set(cookieName, utf8ToBase64Url(JSON.stringify(state))),
      );
      headers.set("location", authorization.url.toString());
      // The redirect is user-specific and single-use.
      headers.set("cache-control", "no-store");

      return new Response(null, { status: 302, headers });
    },

    async callback(request) {
      const params = await readCallbackParams(request);
      const store = storeFor(request);

      const errorParam = params["error"];
      if (errorParam) {
        // access_denied is the user pressing cancel. Expected, not a bug.
        throw new OAuthCallbackError(
          errorParam === "access_denied" ? "access_denied" : "provider_error",
          params["error_description"] ?? `Provider returned "${errorParam}".`,
          provider.id,
          errorParam,
        );
      }

      const code = params["code"];
      const returnedState = params["state"];
      if (!code) {
        throw new OAuthCallbackError("missing_code", "Callback had no code parameter.", provider.id);
      }
      if (!returnedState) {
        throw new OAuthCallbackError("missing_state", "Callback had no state parameter.", provider.id);
      }

      const stored = await store.get(cookieName, request);
      if (!stored) {
        throw new OAuthCallbackError(
          "missing_flow_state",
          "No in-flight state found. The login took too long, cookies are blocked, or the callback was replayed.",
          provider.id,
        );
      }

      let state: FlowState;
      try {
        state = JSON.parse(base64UrlToUtf8(stored)) as FlowState;
      } catch {
        throw new OAuthCallbackError(
          "missing_flow_state",
          "In-flight state cookie was unreadable.",
          provider.id,
        );
      }

      if (!constantTimeEqual(state.s, returnedState)) {
        throw new OAuthCallbackError(
          "state_mismatch",
          "State did not match. This callback did not come from a login this browser started.",
          provider.id,
        );
      }

      const headers = new Headers(await store.clear(cookieName));

      const tokens = await exchangeCode(provider, {
        code,
        codeVerifier: state.v,
        scopes: options.scopes ?? provider.defaultScopes,
      });

      let claims: Record<string, unknown> | null = null;
      if (tokens.idToken && canVerifyIdToken(provider)) {
        claims = await verifyIdToken(provider, tokens.idToken, { nonce: state.n });
      }

      if (options.requireScopes?.length) {
        const missing = options.requireScopes.filter((scope) => !tokens.scopes.includes(scope));
        if (missing.length > 0) {
          throw new OAuthScopeError(
            provider.id,
            [...(options.scopes ?? provider.defaultScopes)],
            tokens.scopes,
            missing,
          );
        }
      }

      const profile =
        options.profile === false
          ? null
          : await fetchProfile(provider, tokens, { claims, params });

      return { tokens, profile, claims, params, headers };
    },
  };
}

/** Apple posts the callback as a form instead of using query parameters. */
async function readCallbackParams(request: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    params[key] = value;
  }

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      for (const [key, value] of await request.formData()) {
        if (typeof value === "string") params[key] = value;
      }
    }
  }

  return params;
}

function isSecure(request: Request | undefined): boolean {
  // Default to secure: a cookie that is wrongly Secure fails loudly in dev,
  // while one that is wrongly insecure fails silently in production.
  if (!request) return true;
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}
