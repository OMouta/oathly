/**
 * Every error oathly throws is one of these, carries a stable `code`, and never
 * contains a client secret, token, or code verifier in its message.
 */
export abstract class OAuthError extends Error {
  /** Stable, machine-readable identifier. Safe to switch on. */
  abstract readonly code: string;
  /** Provider id (`"github"`), or `null` for provider-independent failures. */
  readonly provider: string | null;

  constructor(message: string, provider: string | null) {
    super(message);
    this.name = new.target.name;
    this.provider = provider;
  }

  /** Documentation page for this failure. */
  get docs(): string {
    return `https://oathly.dev/errors/${this.code}`;
  }
}

/**
 * The provider redirected back, but the callback cannot be trusted or completed:
 * the user denied consent, the state did not match, or the flow cookie is gone.
 *
 * These are expected in normal operation — a user hitting "cancel" produces one.
 * Show a friendly message, do not treat it as a bug.
 */
export class OAuthCallbackError extends OAuthError {
  override readonly code:
    | "access_denied"
    | "provider_error"
    | "missing_code"
    | "missing_state"
    | "state_mismatch"
    | "missing_flow_state";

  /** The raw `error` parameter, when the provider sent one. */
  readonly providerError: string | null;

  constructor(
    code: OAuthCallbackError["code"],
    message: string,
    provider: string | null,
    providerError: string | null = null,
  ) {
    super(message, provider);
    this.code = code;
    this.providerError = providerError;
  }
}

/**
 * The token endpoint returned an RFC 6749 error response.
 * `error` is the spec code, e.g. `invalid_grant` (usually: the code was already
 * used, or expired) or `invalid_client` (usually: wrong client secret).
 */
export class OAuthTokenError extends OAuthError {
  override readonly code = "token_error";
  readonly error: string;
  readonly errorDescription: string | null;
  readonly errorUri: string | null;
  readonly status: number;

  constructor(
    provider: string,
    status: number,
    error: string,
    errorDescription: string | null,
    errorUri: string | null,
  ) {
    super(
      errorDescription ? `${error}: ${errorDescription}` : error,
      provider,
    );
    this.error = error;
    this.errorDescription = errorDescription;
    this.errorUri = errorUri;
    this.status = status;
  }
}

/** The request never completed: DNS, TLS, timeout, offline. Retrying may work. */
export class OAuthNetworkError extends OAuthError {
  override readonly code = "network_error";

  constructor(provider: string | null, url: string, cause: unknown) {
    super(`Request to ${url} failed`, provider);
    this.cause = cause;
  }
}

/**
 * The provider responded, but not with anything the spec allows: unparseable
 * body, missing `access_token`, an ID token that fails verification.
 *
 * This means the provider is misbehaving or the provider definition is wrong —
 * not that the user did something.
 */
export class OAuthProtocolError extends OAuthError {
  override readonly code = "protocol_error";

  constructor(provider: string | null, message: string, cause?: unknown) {
    super(message, provider);
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * The token exchange succeeded but the profile could not be fetched.
 *
 * The tokens are attached and are still valid — persist them and retry the
 * profile later rather than sending the user back through the whole flow.
 */
export class OAuthProfileError extends OAuthError {
  override readonly code = "profile_error";
  readonly tokens: import("./tokens.js").OAuthTokens;

  constructor(
    provider: string,
    message: string,
    tokens: import("./tokens.js").OAuthTokens,
    cause?: unknown,
  ) {
    super(message, provider);
    this.tokens = tokens;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * A scope listed in `requireScopes` was not granted.
 *
 * Only thrown when the app explicitly declares a scope essential — a user
 * declining an optional permission is a choice, not an error.
 */
export class OAuthScopeError extends OAuthError {
  override readonly code = "scope_error";
  readonly requested: string[];
  readonly granted: string[];
  readonly missing: string[];

  constructor(
    provider: string,
    requested: string[],
    granted: string[],
    missing: string[],
  ) {
    super(
      `Required scope(s) not granted by the user: ${missing.join(", ")}`,
      provider,
    );
    this.requested = requested;
    this.granted = granted;
    this.missing = missing;
  }
}

/** A provider was configured with missing or invalid options. Always a bug in your code. */
export class OAuthConfigError extends OAuthError {
  override readonly code = "config_error";

  constructor(provider: string | null, message: string) {
    super(message, provider);
  }
}
