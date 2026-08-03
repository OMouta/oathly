import type { OAuthTokens } from "./tokens.js";

/** How the client authenticates to the token endpoint. */
export type TokenAuthMethod =
  /** `client_id` + `client_secret` in the form body. The common case. */
  | "client_secret_post"
  /** HTTP Basic. Required by X/Twitter, Reddit, and a few others. */
  | "client_secret_basic"
  /** Public client, no secret. */
  | "none";

export type PkceSupport =
  /** The provider mandates PKCE. */
  | "required"
  /** The provider accepts PKCE. oathly always sends it. */
  | "supported"
  /** The provider rejects or ignores the challenge (e.g. GitHub OAuth apps). */
  | "unsupported";

/**
 * The normalized user, identical in shape across every provider.
 *
 * Deliberately small. Anything a provider offers beyond this lives in `raw`,
 * fully typed — normalization is never a cage.
 */
export interface Profile<TRaw = unknown> {
  /**
   * The provider's stable, immutable identifier for this user.
   *
   * Never an email or a username: GitHub logins and Discord usernames can be
   * changed, and reusing a freed handle would hand over the account. Store
   * `(provider, id)` as your unique key — see `accountKey()`.
   */
  id: string;
  email: string | null;
  /**
   * True only when the provider explicitly asserts the address is verified.
   *
   * Never inferred. Facebook, Spotify, X, and Microsoft personal accounts do
   * not assert it, so this is `false` for them even when an email is present.
   * Do not look up an existing account by email unless this is `true`.
   */
  emailVerified: boolean;
  /** Display name. Never split into first/last — see `raw` for structured names. */
  name: string | null;
  /** A real handle, where the provider has that concept. Never derived from an email. */
  username: string | null;
  /** Ready-to-use absolute URL. CDN/hash assembly is already done. */
  avatarUrl: string | null;
  /** What the provider actually granted, which may be less than you requested. */
  grantedScopes: string[];
  /** The untouched provider response. */
  raw: TRaw;
}

/** What a provider's `map` returns. Everything except `id` is optional. */
export interface MappedProfile {
  id: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface ProfileContext {
  provider: Provider;
  tokens: OAuthTokens;
  /** Verified ID token claims, when the provider issued one. */
  claims: Record<string, unknown> | null;
  /**
   * Raw callback parameters. Apple sends the user's name here — once, on the
   * very first authorization, and never again.
   */
  params: Record<string, string>;
}

export interface ProfileSpec<TRaw> {
  /** Userinfo endpoint. Omit when `fromIdToken` covers every field. */
  endpoint?: string;
  /** Extra headers. Twitch needs a `Client-Id`, Reddit a `User-Agent`; most need nothing. */
  headers?(ctx: ProfileContext): Record<string, string>;
  /**
   * Full override for providers that need more than one request to establish
   * identity — GitHub's `/user` plus `/user/emails`, for instance.
   */
  fetchRaw?(ctx: ProfileContext): Promise<TRaw>;
  /**
   * When true and a verified ID token is present, its claims are used directly
   * and the userinfo round-trip is skipped. Google logins complete with zero
   * extra HTTP requests this way.
   */
  fromIdToken?: boolean;
  // Method syntax, not a property: it makes `map` bivariant in `TRaw`, which is
  // what lets a `Provider<GitHubRaw>` be passed where a `Provider` is expected.
  map(raw: TRaw, ctx: ProfileContext): MappedProfile;
}

/** Human-facing metadata. The provider docs pages are generated from this. */
export interface ProviderMeta {
  /** Display name, e.g. `"GitHub"`. */
  name: string;
  /** Where to register an application. */
  setupUrl?: string;
  /**
   * How far the provider's email claim can be trusted.
   *
   * - `asserted` — the provider states the address is verified, and oathly reports it.
   * - `unverified` — an address is returned but nothing verifies it. Never use it for account lookup.
   * - `none` — no email is available at all.
   */
  emailTrust: "asserted" | "unverified" | "none";
  /** Quirks and gotchas worth knowing. Rendered into the generated docs. */
  notes?: string[];
}

/** A provider definition, before credentials are attached. */
export interface ProviderDefinition<TRaw = unknown> {
  id: string;
  meta?: ProviderMeta;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  /** OIDC issuer. Required to verify ID tokens. */
  issuer?: string;
  /** JWKS location. Required to verify ID tokens. */
  jwksUri?: string;
  pkce: PkceSupport;
  tokenAuth: TokenAuthMethod;
  /** Sent when the caller does not specify scopes. */
  defaultScopes?: readonly string[];
  /** Space, except for the handful of providers that use a comma. */
  scopeSeparator?: string;
  /** Always appended to the authorization URL. */
  authorizationParams?: Record<string, string>;
  /** Always sent with token requests. */
  tokenHeaders?: Record<string, string>;
  /**
   * Body encoding for token requests. The spec says form; Notion wants JSON.
   * Defaults to `form`.
   */
  tokenBodyFormat?: "form" | "json";
  profile?: ProfileSpec<TRaw>;
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface ProviderCredentials {
  clientId: string;
  /**
   * Omit only for public clients. A function is supported for providers whose
   * secret is a short-lived generated credential (Apple).
   */
  clientSecret?: string | (() => Promise<string>);
  /** Must exactly match one registered with the provider. No wildcards, ever. */
  redirectURI: string;
  /**
   * Override the fetch implementation. Used by `@oathly/testing` to run whole
   * flows in-process, and for custom retry/proxy behaviour.
   */
  fetch?: FetchLike;
}

/** A provider definition with credentials attached. Ready to use. */
export interface Provider<TRaw = unknown> extends ProviderDefinition<TRaw> {
  clientId: string;
  redirectURI: string;
  scopeSeparator: string;
  defaultScopes: readonly string[];
  fetch: FetchLike;
  /**
   * Resolved per request, because Apple's "client secret" is a short-lived
   * ES256 JWT that has to be regenerated as it expires.
   */
  getClientSecret(): Promise<string | null>;
}

export interface AuthorizationRequest {
  url: URL;
  state: string;
  /** `null` when the provider does not support PKCE. */
  codeVerifier: string | null;
  /** `null` for non-OIDC providers. */
  nonce: string | null;
}

export interface AuthorizationOptions {
  /** Defaults to the provider's `defaultScopes`. */
  scopes?: readonly string[];
  state?: string;
  codeVerifier?: string;
  nonce?: string;
  /**
   * Provider-specific parameters. The escape hatch: you are never blocked
   * waiting on oathly to add a flag.
   */
  params?: Record<string, string>;
}
