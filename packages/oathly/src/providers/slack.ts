import { defineProvider } from "../define.js";

export interface SlackClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  "https://slack.com/team_id"?: string;
  "https://slack.com/user_id"?: string;
  [key: string]: unknown;
}

/**
 * Sign in with Slack (OIDC).
 *
 * `sub` is unique per user *per workspace*, so the same person in two
 * workspaces is two accounts. If you want to treat them as one, key on
 * `raw["https://slack.com/user_id"]` together with the team id and decide
 * deliberately.
 */
export const slack = defineProvider<SlackClaims>({
  id: "slack",
  meta: {
    name: "Slack",
    setupUrl: "https://api.slack.com/apps",
    emailTrust: "asserted",
    notes: [
      "This is Sign in with Slack (OIDC), not the bot-token OAuth flow.",
      "`sub` identifies a user within one workspace, not across workspaces.",
      "Slack answers errors with HTTP 200 and `{ ok: false, error }`; oathly detects it.",
    ],
  },
  authorizationEndpoint: "https://slack.com/openid/connect/authorize",
  tokenEndpoint: "https://slack.com/api/openid.connect.token",
  issuer: "https://slack.com",
  jwksUri: "https://slack.com/openid/connect/keys",
  pkce: "supported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["openid", "profile", "email"],
  profile: {
    fromIdToken: true,
    endpoint: "https://slack.com/api/openid.connect.userInfo",
    map: (raw) => ({
      id: raw.sub,
      email: raw.email ?? null,
      emailVerified: raw.email_verified === true,
      name: raw.name ?? null,
      username: null,
      avatarUrl: raw.picture ?? null,
    }),
  },
});
