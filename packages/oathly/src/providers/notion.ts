import { defineProvider } from "../define.js";

export interface NotionTokenResponse {
  workspace_id?: string;
  workspace_name?: string | null;
  workspace_icon?: string | null;
  bot_id?: string;
  owner?: {
    type?: string;
    user?: {
      id?: string;
      name?: string | null;
      avatar_url?: string | null;
      person?: { email?: string };
    };
  };
  [key: string]: unknown;
}

/**
 * Notion.
 *
 * Two deviations from the usual shape:
 *
 * - The token endpoint wants a **JSON** body, not form encoding.
 * - There is no userinfo endpoint. The user arrives inside the token response
 *   itself, so the profile is read straight from `tokens.raw` and costs no
 *   extra request.
 *
 * Pass `params: { owner: "user" }` to `start()` for a user-level authorization
 * rather than a workspace integration.
 */
export const notion = defineProvider<NotionTokenResponse>({
  id: "notion",
  meta: {
    name: "Notion",
    setupUrl: "https://www.notion.so/my-integrations",
    emailTrust: "unverified",
    notes: [
      "The token endpoint requires a JSON body and HTTP Basic auth.",
      "There is no userinfo endpoint; the user is embedded in the token response.",
      "Notion tokens do not expire and there is no refresh token.",
      "Notion asserts nothing about email verification, so `emailVerified` is false.",
    ],
  },
  authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
  tokenEndpoint: "https://api.notion.com/v1/oauth/token",
  pkce: "unsupported",
  tokenAuth: "client_secret_basic",
  tokenBodyFormat: "json",
  tokenHeaders: { "notion-version": "2022-06-28" },
  authorizationParams: { owner: "user" },
  defaultScopes: [],
  profile: {
    // Everything is already in hand — no second request.
    fetchRaw: async (ctx) => ctx.tokens.raw as NotionTokenResponse,
    map: (raw) => {
      const user = raw.owner?.user;
      return {
        id: user?.id ?? raw.bot_id ?? "",
        email: user?.person?.email ?? null,
        emailVerified: false,
        name: user?.name ?? null,
        username: null,
        avatarUrl: user?.avatar_url ?? null,
      };
    },
  },
});
