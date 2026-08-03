import { createProvider } from "../define.js";
import { hmacSha256Hex } from "../crypto.js";
import { readJson, request } from "../protocol.js";
import type { Provider, ProviderCredentials, ProviderDefinition } from "../types.js";

export interface FacebookUser {
  id: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
  [key: string]: unknown;
}

export interface FacebookOptions extends ProviderCredentials {
  /** Graph API version, e.g. `"v21.0"`. Defaults to a recent stable release. */
  version?: string;
}

/**
 * Facebook.
 *
 * **`emailVerified` is always `false`.** Facebook returns an address but makes
 * no verification claim about it, so it must never be used to look up and log
 * into an existing account.
 *
 * Every Graph call is signed with `appsecret_proof`, which Facebook requires
 * for server-side requests and which stops a stolen access token from being
 * usable away from your server.
 */
export function facebook(options: FacebookOptions): Provider<FacebookUser> {
  const version = options.version ?? "v21.0";
  const graph = `https://graph.facebook.com/${version}`;

  const definition: ProviderDefinition<FacebookUser> = {
    id: "facebook",
    meta: {
      name: "Facebook",
      setupUrl: "https://developers.facebook.com/apps",
      emailTrust: "unverified",
      notes: [
        "Facebook makes no email verification claim, so `emailVerified` is always false.",
        "Graph requests are signed with `appsecret_proof` automatically.",
        "An account with no confirmed address, or one registered by phone, returns no email at all.",
      ],
    },
    authorizationEndpoint: `https://www.facebook.com/${version}/dialog/oauth`,
    tokenEndpoint: `${graph}/oauth/access_token`,
    pkce: "supported",
    tokenAuth: "client_secret_post",
    defaultScopes: ["email", "public_profile"],
    profile: {
      async fetchRaw(ctx) {
        const secret = (await ctx.provider.getClientSecret()) ?? "";
        const proof = await hmacSha256Hex(secret, ctx.tokens.accessToken);

        const url = new URL(`${graph}/me`);
        url.searchParams.set("fields", "id,name,email,picture.type(large)");
        url.searchParams.set("appsecret_proof", proof);

        const response = await request(ctx.provider, url.toString(), {
          method: "GET",
          headers: {
            authorization: `Bearer ${ctx.tokens.accessToken}`,
            accept: "application/json",
          },
        });
        return (await readJson(
          ctx.provider,
          response,
          "Facebook Graph /me",
        )) as unknown as FacebookUser;
      },
      map: (raw) => ({
        id: raw.id,
        email: raw.email ?? null,
        emailVerified: false,
        name: raw.name ?? null,
        username: null,
        avatarUrl: raw.picture?.data?.url ?? null,
      }),
    },
  };

  return createProvider(definition, options);
}
