import { exchangeCode, refreshTokens, revokeToken } from "oathly";
import type { Provider } from "oathly";
import { toArcticError } from "./errors.js";
import { codeChallengeS256 } from "./sha256.js";
import { OAuth2Tokens } from "./tokens.js";

/**
 * Shared behaviour for the compatibility provider classes.
 *
 * The authorization URL is built here rather than through oathly's
 * `createAuthorizationURL`, which is async because WebCrypto is. Arctic's was
 * synchronous, and a drop-in that forces `await` on every call site is not a
 * drop-in.
 *
 * Two differences from oathly's native API, both inherited from Arctic:
 * no `nonce` is sent, and ID tokens are not verified. Migrate to `createFlow`
 * for either.
 */
export class OAuth2Client {
  protected readonly provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
  }

  protected buildAuthorizationURL(
    state: string,
    scopes: readonly string[],
    codeVerifier?: string,
  ): URL {
    const provider = this.provider;
    const url = new URL(provider.authorizationEndpoint);

    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", provider.clientId);
    url.searchParams.set("redirect_uri", provider.redirectURI);
    url.searchParams.set("state", state);

    const requested = scopes.length > 0 ? scopes : provider.defaultScopes;
    if (requested.length > 0) {
      url.searchParams.set("scope", requested.join(provider.scopeSeparator));
    }

    if (codeVerifier !== undefined && provider.pkce !== "unsupported") {
      url.searchParams.set("code_challenge", codeChallengeS256(codeVerifier));
      url.searchParams.set("code_challenge_method", "S256");
    }

    for (const [key, value] of Object.entries(provider.authorizationParams ?? {})) {
      url.searchParams.set(key, value);
    }

    return url;
  }

  async validateAuthorizationCode(
    code: string,
    codeVerifier?: string | null,
  ): Promise<OAuth2Tokens> {
    try {
      const tokens = await exchangeCode(this.provider, {
        code,
        codeVerifier: codeVerifier ?? null,
      });
      return new OAuth2Tokens(tokens.raw as Record<string, unknown>);
    } catch (error) {
      throw toArcticError(error);
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    scopes: readonly string[] = [],
  ): Promise<OAuth2Tokens> {
    try {
      const tokens = await refreshTokens(this.provider, refreshToken, {
        ...(scopes.length > 0 ? { scopes } : {}),
      });
      return new OAuth2Tokens(tokens.raw as Record<string, unknown>);
    } catch (error) {
      throw toArcticError(error);
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await revokeToken(this.provider, token);
    } catch (error) {
      throw toArcticError(error);
    }
  }
}

/** Providers that reject PKCE: `createAuthorizationURL(state, scopes)`. */
export class PlainOAuth2Client extends OAuth2Client {
  createAuthorizationURL(state: string, scopes: readonly string[] = []): URL {
    return this.buildAuthorizationURL(state, scopes);
  }
}

/** Providers that support PKCE: `createAuthorizationURL(state, codeVerifier, scopes)`. */
export class PKCEOAuth2Client extends OAuth2Client {
  createAuthorizationURL(
    state: string,
    codeVerifier: string,
    scopes: readonly string[] = [],
  ): URL {
    return this.buildAuthorizationURL(state, scopes, codeVerifier);
  }
}

/**
 * oathly matches redirect URIs exactly and has no concept of "whatever is
 * registered", which Arctic allowed by passing null.
 */
export function requireRedirectURI(
  provider: string,
  redirectURI: string | null,
): string {
  if (redirectURI === null) {
    throw new Error(
      `@oathly/arctic-compat: ${provider} needs an explicit redirect URI. ` +
        "Arctic allowed null to fall back to the URI registered with the provider; " +
        "oathly always sends an exact match. Pass the same URL you registered.",
    );
  }
  return redirectURI;
}
