import { createProvider } from "../define.js";
import { readJson, request } from "../protocol.js";
import type { Provider, ProviderCredentials, ProviderDefinition } from "../types.js";

export interface DropboxUser {
  account_id: string;
  name?: { display_name?: string; abbreviated_name?: string };
  email?: string;
  email_verified?: boolean;
  profile_photo_url?: string | null;
  [key: string]: unknown;
}

export interface DropboxOptions extends ProviderCredentials {
  /**
   * Ask for a refresh token. Dropbox issues short-lived access tokens and only
   * returns a refresh token when `token_access_type=offline`.
   */
  offlineAccess?: boolean;
}

/**
 * Dropbox.
 *
 * The account endpoint is a POST with a literal `null` body — an RPC-style API
 * rather than REST — so it needs a custom fetch rather than the standard
 * userinfo path.
 */
export function dropbox(options: DropboxOptions): Provider<DropboxUser> {
  const definition: ProviderDefinition<DropboxUser> = {
    id: "dropbox",
    meta: {
      name: "Dropbox",
      setupUrl: "https://www.dropbox.com/developers/apps",
      emailTrust: "asserted",
      notes: [
        "Set `offlineAccess: true` for a refresh token; access tokens expire in four hours.",
        "`get_current_account` is a POST with a null body, not a GET.",
      ],
    },
    authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
    tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
    pkce: "supported",
    tokenAuth: "client_secret_post",
    defaultScopes: ["account_info.read"],
    ...(options.offlineAccess
      ? { authorizationParams: { token_access_type: "offline" } }
      : {}),
    profile: {
      async fetchRaw(ctx) {
        const response = await request(
          ctx.provider,
          "https://api.dropboxapi.com/2/users/get_current_account",
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${ctx.tokens.accessToken}`,
              accept: "application/json",
            },
          },
        );
        return (await readJson(
          ctx.provider,
          response,
          "Dropbox get_current_account",
        )) as unknown as DropboxUser;
      },
      map: (raw) => ({
        id: raw.account_id,
        email: raw.email ?? null,
        emailVerified: raw.email_verified === true,
        name: raw.name?.display_name ?? null,
        username: null,
        avatarUrl: raw.profile_photo_url ?? null,
      }),
    },
  };

  return createProvider(definition, options);
}
