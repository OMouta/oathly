import { defineProvider } from "../define.js";

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  images?: { url: string; height: number | null; width: number | null }[];
  [key: string]: unknown;
}

/**
 * Spotify.
 *
 * **Spotify does not verify email addresses.** Anyone can sign up with any
 * address, so `emailVerified` is always `false` here and you must never use a
 * Spotify email to look up and log into an existing account. This is a real
 * account-takeover vector, not a theoretical one.
 */
export const spotify = defineProvider<SpotifyUser>({
  id: "spotify",
  meta: {
    name: "Spotify",
    setupUrl: "https://developer.spotify.com/dashboard",
    emailTrust: "unverified",
    notes: [
      "Spotify does not verify email addresses. Never use one for account lookup.",
      "The token endpoint requires HTTP Basic auth.",
      "`user-read-email` is required for an address to be returned.",
    ],
  },
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
  pkce: "supported",
  // Spotify wants HTTP Basic on the token endpoint for confidential clients.
  tokenAuth: "client_secret_basic",
  defaultScopes: ["user-read-email", "user-read-private"],
  profile: {
    endpoint: "https://api.spotify.com/v1/me",
    map: (raw) => ({
      id: raw.id,
      email: raw.email ?? null,
      emailVerified: false,
      name: raw.display_name,
      username: raw.id,
      avatarUrl: raw.images?.[0]?.url ?? null,
    }),
  },
});
