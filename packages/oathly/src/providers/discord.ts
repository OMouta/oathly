import { defineProvider } from "../define.js";

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
  email?: string | null;
  verified?: boolean;
  [key: string]: unknown;
}

/** Discord serves avatars as a hash that has to be assembled into a CDN URL. */
function avatarUrl(user: DiscordUser): string {
  if (user.avatar) {
    const extension = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}`;
  }
  // Default avatar. Post-migration accounts index by snowflake; legacy ones by
  // discriminator.
  const index =
    user.discriminator === "0"
      ? Number((BigInt(user.id) >> 22n) % 6n)
      : Number(user.discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export const discord = defineProvider<DiscordUser>({
  id: "discord",
  meta: {
    name: "Discord",
    setupUrl: "https://discord.com/developers/applications",
    emailTrust: "asserted",
    notes: [
      "The `email` scope is required for an address; `identify` alone returns none.",
      "Avatar hashes are assembled into CDN URLs, animated ones included.",
      "Usernames have been changeable since the 2023 migration — key on the snowflake id.",
    ],
  },
  authorizationEndpoint: "https://discord.com/oauth2/authorize",
  tokenEndpoint: "https://discord.com/api/oauth2/token",
  revocationEndpoint: "https://discord.com/api/oauth2/token/revoke",
  pkce: "supported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["identify", "email"],
  profile: {
    endpoint: "https://discord.com/api/users/@me",
    map: (raw) => ({
      // Usernames are changeable since the 2023 migration; the snowflake is not.
      id: raw.id,
      email: raw.email ?? null,
      emailVerified: raw.verified === true,
      name: raw.global_name ?? raw.username,
      username: raw.username,
      avatarUrl: avatarUrl(raw),
    }),
  },
});
