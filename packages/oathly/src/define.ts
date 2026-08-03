import { OAuthConfigError } from "./errors.js";
import type {
  FetchLike,
  Provider,
  ProviderCredentials,
  ProviderDefinition,
} from "./types.js";

/**
 * Attach credentials to a provider definition.
 *
 * Validation happens here, at configuration time, rather than on the first
 * login attempt in production.
 */
export function createProvider<TRaw>(
  definition: ProviderDefinition<TRaw>,
  credentials: ProviderCredentials,
): Provider<TRaw> {
  const { clientId, clientSecret, redirectURI } = credentials;

  if (!clientId) {
    throw new OAuthConfigError(definition.id, "clientId is required.");
  }
  if (!redirectURI) {
    throw new OAuthConfigError(definition.id, "redirectURI is required.");
  }
  try {
    // Providers match redirect URIs exactly; a relative path can never match.
    new URL(redirectURI);
  } catch {
    throw new OAuthConfigError(
      definition.id,
      `redirectURI must be an absolute URL, received ${JSON.stringify(redirectURI)}.`,
    );
  }
  if (definition.tokenAuth !== "none" && clientSecret === undefined) {
    throw new OAuthConfigError(
      definition.id,
      `${definition.id} is a confidential client and requires a clientSecret.`,
    );
  }

  const fetchImpl: FetchLike =
    credentials.fetch ?? ((input, init) => globalThis.fetch(input, init));

  return {
    ...definition,
    clientId,
    redirectURI,
    fetch: fetchImpl,
    scopeSeparator: definition.scopeSeparator ?? " ",
    defaultScopes: definition.defaultScopes ?? [],
    getClientSecret:
      typeof clientSecret === "function"
        ? clientSecret
        : async () => clientSecret ?? null,
  };
}

/**
 * Turn a definition into a provider factory.
 *
 * ```ts
 * export const discord = defineProvider({ id: "discord", ... });
 * const provider = discord({ clientId, clientSecret, redirectURI });
 * ```
 */
export function defineProvider<TRaw>(
  definition: ProviderDefinition<TRaw>,
): (credentials: ProviderCredentials) => Provider<TRaw> {
  return (credentials) => createProvider(definition, credentials);
}
