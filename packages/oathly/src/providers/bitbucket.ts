import { defineProvider } from "../define.js";
import { readJson, request } from "../protocol.js";

export interface BitbucketUser {
  uuid: string;
  account_id: string;
  username: string;
  display_name: string | null;
  links?: { avatar?: { href?: string } };
  [key: string]: unknown;
}

export interface BitbucketEmail {
  email: string;
  is_primary: boolean;
  is_confirmed: boolean;
}

export type BitbucketRaw = BitbucketUser & {
  /** Populated when the `email` scope was granted. */
  emails: BitbucketEmail[] | null;
};

/**
 * Bitbucket.
 *
 * Like GitHub, the address lives behind a second endpoint: `/2.0/user` has no
 * email at all, so the confirmed primary comes from `/2.0/user/emails`.
 */
export const bitbucket = defineProvider<BitbucketRaw>({
  id: "bitbucket",
  meta: {
    name: "Bitbucket",
    setupUrl: "https://bitbucket.org/account/settings/app-passwords/",
    emailTrust: "asserted",
    notes: [
      "`/2.0/user` returns no email; oathly makes a second call to `/2.0/user/emails`.",
      "The token endpoint uses HTTP Basic auth.",
      "`account_id` is stable across username changes and is used as the id.",
    ],
  },
  authorizationEndpoint: "https://bitbucket.org/site/oauth2/authorize",
  tokenEndpoint: "https://bitbucket.org/site/oauth2/access_token",
  pkce: "supported",
  tokenAuth: "client_secret_basic",
  defaultScopes: ["account", "email"],
  profile: {
    async fetchRaw(ctx) {
      const headers = {
        authorization: `Bearer ${ctx.tokens.accessToken}`,
        accept: "application/json",
      };

      const userResponse = await request(ctx.provider, "https://api.bitbucket.org/2.0/user", {
        method: "GET",
        headers,
      });
      const user = (await readJson(
        ctx.provider,
        userResponse,
        "Bitbucket /2.0/user",
      )) as unknown as BitbucketUser;

      let emails: BitbucketEmail[] | null = null;
      if (ctx.tokens.hasScope("email")) {
        const emailResponse = await request(
          ctx.provider,
          "https://api.bitbucket.org/2.0/user/emails",
          { method: "GET", headers },
        );
        if (emailResponse.ok) {
          const body = (await emailResponse.json()) as { values?: BitbucketEmail[] };
          emails = body.values ?? null;
        }
      }

      return { ...user, emails };
    },
    map: (raw) => {
      const primary = raw.emails?.find((entry) => entry.is_primary && entry.is_confirmed);
      return {
        // Stable across username changes, unlike `username`.
        id: raw.account_id ?? raw.uuid,
        email: primary?.email ?? null,
        emailVerified: primary !== undefined,
        name: raw.display_name,
        username: raw.username,
        avatarUrl: raw.links?.avatar?.href ?? null,
      };
    },
  },
});
