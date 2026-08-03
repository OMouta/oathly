import { defineProvider } from "../define.js";

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url: string;
  [key: string]: unknown;
}

/** Helix wraps every response in a `data` array, even for a single user. */
interface TwitchUsersResponse {
  data: TwitchUser[];
}

export const twitch = defineProvider<TwitchUser>({
  id: "twitch",
  meta: {
    name: "Twitch",
    setupUrl: "https://dev.twitch.tv/console/apps",
    emailTrust: "asserted",
    notes: [
      "The Helix API requires a `Client-Id` header alongside the bearer token; oathly sends it.",
      "`user:read:email` is required for an email address to be returned at all.",
      "Twitch requires an exact redirect URI match, including the trailing slash.",
    ],
  },
  authorizationEndpoint: "https://id.twitch.tv/oauth2/authorize",
  tokenEndpoint: "https://id.twitch.tv/oauth2/token",
  revocationEndpoint: "https://id.twitch.tv/oauth2/revoke",
  issuer: "https://id.twitch.tv/oauth2",
  jwksUri: "https://id.twitch.tv/oauth2/keys",
  pkce: "supported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["user:read:email"],
  profile: {
    endpoint: "https://api.twitch.tv/helix/users",
    // Helix rejects a bearer token that arrives without the client id.
    headers: (ctx) => ({ "client-id": ctx.provider.clientId }),
    map: (raw) => {
      const user = (raw as unknown as TwitchUsersResponse).data?.[0] ?? raw;
      return {
        id: user.id,
        email: user.email ?? null,
        // Twitch requires a confirmed address on every account.
        emailVerified: Boolean(user.email),
        name: user.display_name,
        username: user.login,
        avatarUrl: user.profile_image_url,
      };
    },
  },
});
