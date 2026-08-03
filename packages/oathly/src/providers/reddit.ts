import { createProvider } from "../define.js";
import type { Provider, ProviderCredentials, ProviderDefinition } from "../types.js";

export interface RedditUser {
  id: string;
  name: string;
  icon_img?: string;
  has_verified_email?: boolean;
  [key: string]: unknown;
}

export interface RedditOptions extends ProviderCredentials {
  /**
   * Reddit blocks requests with a generic or missing User-Agent. Use their
   * format: `platform:app-id:version (by /u/username)`.
   */
  userAgent: string;
  /**
   * Ask for a refresh token. Reddit issues one only when `duration=permanent`,
   * and otherwise expires the access token in an hour with no way to renew it.
   */
  permanent?: boolean;
}

/**
 * Reddit.
 *
 * Reddit never returns an email address — only whether one has been verified —
 * so `email` is always null while `emailVerified` can still be true.
 */
export function reddit(options: RedditOptions): Provider<RedditUser> {
  const definition: ProviderDefinition<RedditUser> = {
    id: "reddit",
    meta: {
      name: "Reddit",
      setupUrl: "https://www.reddit.com/prefs/apps",
      emailTrust: "none",
      notes: [
        "A descriptive `userAgent` is mandatory; Reddit rate-limits or blocks generic ones.",
        "Set `permanent: true` to receive a refresh token.",
        "Reddit exposes `has_verified_email` but never the address itself.",
        "The token endpoint uses HTTP Basic authentication.",
      ],
    },
    authorizationEndpoint: "https://www.reddit.com/api/v1/authorize",
    tokenEndpoint: "https://www.reddit.com/api/v1/access_token",
    revocationEndpoint: "https://www.reddit.com/api/v1/revoke_token",
    pkce: "supported",
    tokenAuth: "client_secret_basic",
    defaultScopes: ["identity"],
    tokenHeaders: { "user-agent": options.userAgent },
    ...(options.permanent ? { authorizationParams: { duration: "permanent" } } : {}),
    profile: {
      endpoint: "https://oauth.reddit.com/api/v1/me",
      headers: () => ({ "user-agent": options.userAgent }),
      map: (raw) => ({
        id: raw.id,
        // Reddit will not tell you the address, only that one exists. With no
        // address there is nothing to verify, so this stays false and
        // `raw.has_verified_email` is where to look if you need the signal.
        email: null,
        emailVerified: false,
        name: raw.name,
        username: raw.name,
        // Reddit HTML-escapes the query string in icon_img.
        avatarUrl: raw.icon_img ? raw.icon_img.replace(/&amp;/g, "&") : null,
      }),
    },
  };

  return createProvider(definition, options);
}
