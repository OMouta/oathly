import { createProvider } from "../define.js";
import type { Provider, ProviderCredentials, ProviderDefinition } from "../types.js";

export interface GitLabUser {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  /** Present and non-null once the address has been confirmed. */
  confirmed_at?: string | null;
  [key: string]: unknown;
}

export interface GitLabOptions extends ProviderCredentials {
  /** Base URL of a self-managed instance. Defaults to gitlab.com. */
  baseUrl?: string;
}

/**
 * GitLab, hosted or self-managed.
 *
 * Self-managed instances put every endpoint under their own origin, which is
 * why this is a function rather than a static definition.
 */
export function gitlab(options: GitLabOptions): Provider<GitLabUser> {
  const base = (options.baseUrl ?? "https://gitlab.com").replace(/\/$/, "");

  const definition: ProviderDefinition<GitLabUser> = {
    id: "gitlab",
    meta: {
      name: "GitLab",
      setupUrl: "https://gitlab.com/-/user_settings/applications",
      emailTrust: "asserted",
      notes: [
        "Pass `baseUrl` for a self-managed instance; every endpoint follows it.",
        "GitLab confirms addresses before an account can be used, and reports it via `confirmed_at`.",
      ],
    },
    authorizationEndpoint: `${base}/oauth/authorize`,
    tokenEndpoint: `${base}/oauth/token`,
    revocationEndpoint: `${base}/oauth/revoke`,
    issuer: base,
    jwksUri: `${base}/oauth/discovery/keys`,
    pkce: "required",
    tokenAuth: "client_secret_post",
    defaultScopes: ["read_user"],
    profile: {
      endpoint: `${base}/api/v4/user`,
      map: (raw) => ({
        id: String(raw.id),
        email: raw.email,
        emailVerified: Boolean(raw.confirmed_at),
        name: raw.name,
        username: raw.username,
        avatarUrl: raw.avatar_url,
      }),
    },
  };

  return createProvider(definition, options);
}
