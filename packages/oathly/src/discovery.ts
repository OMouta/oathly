import { createProvider } from "./define.js";
import { OAuthProtocolError } from "./errors.js";
import type {
  MappedProfile,
  Provider,
  ProviderCredentials,
  ProviderDefinition,
} from "./types.js";

interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
}

export interface StandardClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface DiscoverOptions extends ProviderCredentials {
  /** Identifies the provider in errors and cookie names. */
  id?: string;
  scopes?: readonly string[];
  /** Override the default OIDC standard-claims mapping. */
  map?: (claims: StandardClaims) => MappedProfile;
}

/**
 * Build a provider from an OIDC issuer's discovery document.
 *
 * Explicitly async, and meant to be called once at startup rather than per
 * request — discovery in the hot path of every login is a latency bug and a
 * hard dependency on someone else's uptime.
 *
 * ```ts
 * const keycloak = await discover("https://id.example.com/realms/main", { ... });
 * ```
 */
export async function discover(
  issuer: string,
  options: DiscoverOptions,
): Promise<Provider<StandardClaims>> {
  const url = new URL(
    ".well-known/openid-configuration",
    issuer.endsWith("/") ? issuer : `${issuer}/`,
  );

  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(url.toString(), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new OAuthProtocolError(
      options.id ?? issuer,
      `Discovery document at ${url} returned HTTP ${response.status}.`,
    );
  }

  const doc = (await response.json()) as DiscoveryDocument;
  for (const field of [
    "issuer",
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
  ] as const) {
    if (typeof doc[field] !== "string") {
      throw new OAuthProtocolError(
        options.id ?? issuer,
        `Discovery document is missing "${field}".`,
      );
    }
  }
  // Guards against a redirect to an attacker-controlled document.
  if (doc.issuer !== issuer.replace(/\/$/, "")) {
    throw new OAuthProtocolError(
      options.id ?? issuer,
      `Discovery document issuer "${doc.issuer}" does not match the requested issuer "${issuer}".`,
    );
  }

  const map =
    options.map ??
    ((claims: StandardClaims): MappedProfile => ({
      id: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email_verified === true,
      name: claims.name ?? null,
      username: claims.preferred_username ?? null,
      avatarUrl: claims.picture ?? null,
    }));

  const definition: ProviderDefinition<StandardClaims> = {
    id: options.id ?? new URL(issuer).hostname,
    authorizationEndpoint: doc.authorization_endpoint,
    tokenEndpoint: doc.token_endpoint,
    issuer: doc.issuer,
    jwksUri: doc.jwks_uri,
    pkce: "required",
    tokenAuth: "client_secret_post",
    defaultScopes: options.scopes ?? ["openid", "email", "profile"],
    ...(doc.revocation_endpoint ? { revocationEndpoint: doc.revocation_endpoint } : {}),
    profile: {
      fromIdToken: true,
      ...(doc.userinfo_endpoint ? { endpoint: doc.userinfo_endpoint } : {}),
      map,
    },
  };

  return createProvider(definition, options);
}
