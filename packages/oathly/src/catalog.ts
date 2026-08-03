/**
 * Every provider, instantiated with placeholder credentials.
 *
 * Not exported from the package entry point — importing it would pull in all
 * providers and defeat tree-shaking. It exists so the docs generator and the
 * contract tests can inspect real definitions instead of a hand-maintained
 * list that would drift.
 */
import type { Provider } from "./types.js";
import { apple } from "./providers/apple.js";
import { bitbucket } from "./providers/bitbucket.js";
import { discord } from "./providers/discord.js";
import { dropbox } from "./providers/dropbox.js";
import { facebook } from "./providers/facebook.js";
import { github } from "./providers/github.js";
import { gitlab } from "./providers/gitlab.js";
import { google } from "./providers/google.js";
import { linkedin } from "./providers/linkedin.js";
import { microsoft } from "./providers/microsoft.js";
import { notion } from "./providers/notion.js";
import { reddit } from "./providers/reddit.js";
import { slack } from "./providers/slack.js";
import { spotify } from "./providers/spotify.js";
import { twitch } from "./providers/twitch.js";
import { twitter } from "./providers/twitter.js";

const PLACEHOLDER = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectURI: "https://example.com/auth/callback",
};

/**
 * Keyed by the export name, so the generated docs can show the exact import.
 * Apple's key is never parsed here — the secret is minted lazily.
 */
export const catalog: Record<string, () => Provider> = {
  apple: () =>
    apple({
      clientId: PLACEHOLDER.clientId,
      redirectURI: PLACEHOLDER.redirectURI,
      teamId: "TEAM123456",
      keyId: "KEY123456",
      privateKey: "-----BEGIN PRIVATE KEY-----placeholder-----END PRIVATE KEY-----",
    }),
  bitbucket: () => bitbucket(PLACEHOLDER),
  discord: () => discord(PLACEHOLDER),
  dropbox: () => dropbox(PLACEHOLDER),
  facebook: () => facebook(PLACEHOLDER),
  github: () => github(PLACEHOLDER),
  gitlab: () => gitlab(PLACEHOLDER),
  google: () => google(PLACEHOLDER),
  linkedin: () => linkedin(PLACEHOLDER),
  microsoft: () => microsoft(PLACEHOLDER),
  notion: () => notion(PLACEHOLDER),
  reddit: () => reddit({ ...PLACEHOLDER, userAgent: "web:oathly:1.0 (by /u/example)" }),
  slack: () => slack(PLACEHOLDER),
  spotify: () => spotify(PLACEHOLDER),
  twitch: () => twitch(PLACEHOLDER),
  twitter: () => twitter(PLACEHOLDER),
};

export const catalogEntries: [string, Provider][] = Object.entries(catalog).map(
  ([name, create]) => [name, create()],
);
