import { OAuthProtocolError } from "./errors.js";

/**
 * A token response, parsed into something usable.
 *
 * Properties, not Arctic's accessor methods: `tokens.accessToken`, not
 * `tokens.accessToken()`. Optional values are `null` rather than throwing, so
 * `tokens.refreshToken ?? existing` works without a try/catch.
 */
export class OAuthTokens {
  readonly accessToken: string;
  readonly tokenType: string;
  readonly refreshToken: string | null;
  readonly idToken: string | null;
  /** Absolute expiry, computed at parse time. `null` if the provider omitted `expires_in`. */
  readonly expiresAt: Date | null;
  /** Scopes the provider actually granted — not necessarily what you requested. */
  readonly scopes: string[];
  /** The untouched token response, for provider-specific extras. */
  readonly raw: Readonly<Record<string, unknown>>;

  constructor(init: {
    accessToken: string;
    tokenType: string;
    refreshToken: string | null;
    idToken: string | null;
    expiresAt: Date | null;
    scopes: string[];
    raw: Record<string, unknown>;
  }) {
    this.accessToken = init.accessToken;
    this.tokenType = init.tokenType;
    this.refreshToken = init.refreshToken;
    this.idToken = init.idToken;
    this.expiresAt = init.expiresAt;
    this.scopes = init.scopes;
    this.raw = Object.freeze(init.raw);
  }

  /** True when `expiresAt` is known and in the past. Unknown expiry is not expired. */
  get expired(): boolean {
    return this.expiresAt !== null && this.expiresAt.getTime() <= Date.now();
  }

  /** Seconds until expiry, or `null` when the provider did not say. */
  get expiresIn(): number | null {
    if (this.expiresAt === null) return null;
    return Math.max(0, Math.round((this.expiresAt.getTime() - Date.now()) / 1000));
  }

  hasScope(scope: string): boolean {
    return this.scopes.includes(scope);
  }

  static fromResponse(
    body: Record<string, unknown>,
    options: {
      providerId: string;
      scopeSeparator: string;
      /** Used when the provider omits `scope`, which many do on refresh. */
      requestedScopes: readonly string[];
      /** Preserved across refreshes that omit `id_token`. */
      fallbackIdToken?: string | null;
    },
  ): OAuthTokens {
    const accessToken = body["access_token"];
    if (typeof accessToken !== "string" || accessToken === "") {
      throw new OAuthProtocolError(
        options.providerId,
        "Token response did not include an access_token.",
      );
    }

    const expiresIn = body["expires_in"];
    // Some providers send expires_in as a string. Accept both, ignore garbage.
    const seconds =
      typeof expiresIn === "number"
        ? expiresIn
        : typeof expiresIn === "string" && expiresIn.trim() !== "" && Number.isFinite(Number(expiresIn))
          ? Number(expiresIn)
          : null;

    const scope = body["scope"];
    // Split on both separators regardless of what was sent: GitHub accepts
    // space-delimited scopes on the way out and returns them comma-delimited on
    // the way back. Scope values themselves never contain either character.
    const scopes =
      typeof scope === "string" && scope !== ""
        ? scope.split(/[\s,]+/).filter(Boolean)
        : [...options.requestedScopes];

    const idToken = body["id_token"];

    return new OAuthTokens({
      accessToken,
      tokenType: typeof body["token_type"] === "string" ? body["token_type"] : "Bearer",
      refreshToken: typeof body["refresh_token"] === "string" ? body["refresh_token"] : null,
      idToken:
        typeof idToken === "string" ? idToken : (options.fallbackIdToken ?? null),
      expiresAt: seconds === null ? null : new Date(Date.now() + seconds * 1000),
      scopes,
      raw: body,
    });
  }
}
