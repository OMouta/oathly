import { defineProvider } from "../define.js";

export interface LinkedInClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * LinkedIn.
 *
 * LinkedIn moved to OIDC and retired the old v2 `/me` and `emailAddress`
 * endpoints; identity now comes from the ID token and `/v2/userinfo`. Your app
 * needs the "Sign In with LinkedIn using OpenID Connect" product enabled or
 * authorization fails with an unhelpful error.
 */
export const linkedin = defineProvider<LinkedInClaims>({
  id: "linkedin",
  meta: {
    name: "LinkedIn",
    setupUrl: "https://www.linkedin.com/developers/apps",
    emailTrust: "asserted",
    notes: [
      'Requires the "Sign In with LinkedIn using OpenID Connect" product on the app.',
      "The legacy v2 profile and email endpoints are gone; this uses OIDC.",
      "LinkedIn has no public handle in the OIDC claims, so `username` is null.",
    ],
  },
  authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
  tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
  issuer: "https://www.linkedin.com/oauth",
  jwksUri: "https://www.linkedin.com/oauth/openid/jwks",
  pkce: "supported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["openid", "profile", "email"],
  profile: {
    fromIdToken: true,
    endpoint: "https://api.linkedin.com/v2/userinfo",
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
