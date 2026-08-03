import { defineProvider } from "../define.js";
import { readJson, request } from "../protocol.js";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  /** The *public* profile email. Not necessarily verified, and often null. */
  email: string | null;
  avatar_url: string;
  [key: string]: unknown;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export type GitHubRaw = GitHubUser & {
  /** Populated when the `user:email` scope was granted. */
  emails: GitHubEmail[] | null;
};

/**
 * GitHub.
 *
 * Two quirks handled here:
 *
 * - GitHub OAuth Apps ignore PKCE, so it is not sent.
 * - `/user` only exposes the *public* email, which may be absent and is never
 *   marked verified. The verified primary address needs a second call to
 *   `/user/emails`, which oathly makes for you whenever `user:email` is granted.
 */
export const github = defineProvider<GitHubRaw>({
  id: "github",
  meta: {
    name: "GitHub",
    setupUrl: "https://github.com/settings/developers",
    emailTrust: "asserted",
    notes: [
      "GitHub OAuth Apps ignore PKCE, so no challenge is sent.",
      "`/user` exposes only the public email and never marks it verified; oathly calls `/user/emails` for the verified primary.",
      "The token endpoint answers errors with HTTP 200 and an error body.",
      "Scopes come back comma-delimited even though they are sent space-delimited.",
      "Key accounts on the numeric `id`: `login` can be renamed and reused.",
    ],
  },
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  pkce: "unsupported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["read:user", "user:email"],
  profile: {
    async fetchRaw(ctx) {
      const headers = {
        authorization: `Bearer ${ctx.tokens.accessToken}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      };

      const userResponse = await request(ctx.provider, "https://api.github.com/user", {
        method: "GET",
        headers,
      });
      const user = (await readJson(
        ctx.provider,
        userResponse,
        "GitHub /user",
      )) as unknown as GitHubUser;

      // Identity only: this is the address the account is verified against.
      // Anything beyond identity (repos, orgs) is your job, not oathly's.
      let emails: GitHubEmail[] | null = null;
      if (ctx.tokens.hasScope("user:email") || ctx.tokens.hasScope("user")) {
        const emailResponse = await request(
          ctx.provider,
          "https://api.github.com/user/emails",
          { method: "GET", headers },
        );
        if (emailResponse.ok) {
          emails = (await emailResponse.json()) as GitHubEmail[];
        }
      }

      return { ...user, emails };
    },
    map(raw) {
      const primary = raw.emails?.find((entry) => entry.primary && entry.verified);
      return {
        // The numeric id, never `login` — logins are renameable and reusable.
        id: String(raw.id),
        email: primary?.email ?? raw.email,
        emailVerified: primary !== undefined,
        name: raw.name,
        username: raw.login,
        avatarUrl: raw.avatar_url,
      };
    },
  },
});
