import { defineProvider } from "../define.js";

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  [key: string]: unknown;
}

interface TwitterMeResponse {
  data: TwitterUser;
}

/**
 * X (Twitter).
 *
 * **X never returns an email address** through the v2 API, so `email` is always
 * null. Plan your account model around that before you offer it as a login.
 *
 * PKCE is mandatory, and confidential clients must use HTTP Basic on the token
 * endpoint. Add the `offline.access` scope if you want a refresh token.
 */
export const twitter = defineProvider<TwitterUser>({
  id: "twitter",
  meta: {
    name: "X (Twitter)",
    setupUrl: "https://developer.x.com/en/portal/dashboard",
    emailTrust: "none",
    notes: [
      "The v2 API exposes no email address under any scope.",
      "PKCE is mandatory and the token endpoint requires HTTP Basic auth.",
      "Add the `offline.access` scope to receive a refresh token.",
      "Refresh tokens rotate: persist the new one from every refresh.",
    ],
  },
  authorizationEndpoint: "https://x.com/i/oauth2/authorize",
  tokenEndpoint: "https://api.x.com/2/oauth2/token",
  revocationEndpoint: "https://api.x.com/2/oauth2/revoke",
  pkce: "required",
  tokenAuth: "client_secret_basic",
  defaultScopes: ["users.read", "tweet.read"],
  profile: {
    endpoint: "https://api.x.com/2/users/me?user.fields=profile_image_url",
    map: (raw) => {
      const user = (raw as unknown as TwitterMeResponse).data ?? raw;
      return {
        id: user.id,
        email: null,
        emailVerified: false,
        name: user.name,
        username: user.username,
        // The default URL is a 48px thumbnail; _normal swaps to a larger one.
        avatarUrl: user.profile_image_url?.replace("_normal", "") ?? null,
      };
    },
  },
});

export { twitter as x };
