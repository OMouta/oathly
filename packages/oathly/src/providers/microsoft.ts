import { createProvider } from "../define.js";
import type { Provider, ProviderCredentials, ProviderDefinition } from "../types.js";

export interface MicrosoftUser {
  id: string;
  displayName: string | null;
  userPrincipalName: string | null;
  mail: string | null;
  [key: string]: unknown;
}

export interface MicrosoftOptions extends ProviderCredentials {
  /**
   * `common` (default), `organizations`, `consumers`, or a tenant GUID.
   *
   * A concrete tenant GUID is the only value whose ID token issuer is known in
   * advance, so it is also the only one where oathly can verify the ID token.
   * With `common`, identity comes from Microsoft Graph instead — see below.
   */
  tenant?: string;
}

/**
 * Microsoft (Entra ID).
 *
 * Two things worth knowing:
 *
 * - **`id` is the `sub` claim's Graph equivalent, `/me`'s `id` (the object id).**
 *   Entra's `sub` is *pairwise per app registration*, so keying on it means a
 *   new app registration orphans every linked account. `raw.id` is the tenant
 *   object id, which is stable across registrations.
 * - **Multi-tenant ID tokens cannot be verified against a fixed issuer**, since
 *   the issuer contains the caller's tenant id. Rather than skip verification,
 *   oathly declines to read those claims at all and reads identity from Graph.
 *   Pass a tenant GUID to get verified ID tokens.
 * - Microsoft does not assert email verification for personal accounts, so
 *   `emailVerified` is always `false`.
 */
export function microsoft(options: MicrosoftOptions): Provider<MicrosoftUser> {
  const tenant = options.tenant ?? "common";
  const isSingleTenant = /^[0-9a-f-]{36}$/i.test(tenant);

  const definition: ProviderDefinition<MicrosoftUser> = {
    id: "microsoft",
    meta: {
      name: "Microsoft",
      setupUrl: "https://entra.microsoft.com",
      emailTrust: "unverified",
      notes: [
        "`id` is the Graph object id, not `sub`: Entra's `sub` is pairwise per app registration.",
        "Multi-tenant ID tokens cannot be verified against a fixed issuer, so identity comes from Graph. Pass a tenant GUID for verified ID tokens.",
        "Microsoft asserts nothing usable about email verification on personal accounts.",
        "Add the `offline_access` scope for a refresh token.",
      ],
    },
    authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    pkce: "required",
    tokenAuth: "client_secret_post",
    defaultScopes: ["openid", "profile", "email", "User.Read"],
    ...(isSingleTenant
      ? {
          issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
          jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
        }
      : {}),
    profile: {
      endpoint: "https://graph.microsoft.com/v1.0/me",
      map: (raw) => ({
        id: raw.id,
        email: raw.mail ?? raw.userPrincipalName,
        // Entra asserts nothing usable here for personal accounts.
        emailVerified: false,
        name: raw.displayName,
        username: raw.userPrincipalName,
        // /me/photo/$value returns binary, not a URL. Fetch it yourself if you need it.
        avatarUrl: null,
      }),
    },
  };

  return createProvider(definition, options);
}
