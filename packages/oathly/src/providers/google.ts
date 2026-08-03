import { createProvider } from "../define.js";
import type { Provider, ProviderCredentials, ProviderDefinition } from "../types.js";

export interface GoogleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  hd?: string;
  [key: string]: unknown;
}

const definition: ProviderDefinition<GoogleClaims> = {
  id: "google",
  meta: {
    name: "Google",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    emailTrust: "asserted",
    notes: [
      "A refresh token requires `offlineAccess: true`, which sets both `access_type=offline` and `prompt=consent`.",
      "The verified ID token already carries the profile, so a login makes no extra HTTP request.",
      "Granular consent lets users decline individual scopes; check `profile.grantedScopes`.",
      "Use `hostedDomain` to restrict sign-in to one Workspace domain, and verify `raw.hd` too.",
    ],
  },
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  issuer: "https://accounts.google.com",
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
  pkce: "required",
  tokenAuth: "client_secret_post",
  defaultScopes: ["openid", "email", "profile"],
  profile: {
    // Everything needed is already in the verified ID token, so a standard
    // Google login costs zero extra HTTP requests.
    fromIdToken: true,
    endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
    map: (raw) => ({
      id: raw.sub,
      email: raw.email ?? null,
      emailVerified: raw.email_verified === true,
      name: raw.name ?? null,
      // Google has no handle concept. Deriving one from the email would be a lie.
      username: null,
      avatarUrl: raw.picture ?? null,
    }),
  },
};

export interface GoogleOptions extends ProviderCredentials {
  /**
   * Ask for a refresh token.
   *
   * Google only issues one when `access_type=offline` *and* the user is shown a
   * fresh consent screen, which is why this also forces `prompt=consent`.
   * Getting this wrong is the single most common Google OAuth complaint.
   */
  offlineAccess?: boolean;
  /** Restrict sign-in to one Workspace domain. Verify `hd` server-side too. */
  hostedDomain?: string;
}

export function google(options: GoogleOptions): Provider<GoogleClaims> {
  const authorizationParams: Record<string, string> = {};
  if (options.offlineAccess) {
    authorizationParams["access_type"] = "offline";
    authorizationParams["prompt"] = "consent";
  }
  if (options.hostedDomain) {
    authorizationParams["hd"] = options.hostedDomain;
  }

  return createProvider({ ...definition, authorizationParams }, options);
}
