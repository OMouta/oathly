import { OAuthConfigError, OAuthProfileError, OAuthProtocolError } from "./errors.js";
import { readJson, request } from "./protocol.js";
import type { OAuthTokens } from "./tokens.js";
import type { MappedProfile, Profile, ProfileContext, Provider } from "./types.js";

/**
 * The linking key. Always the `(provider, id)` pair — never the id alone,
 * which collides across providers, and never the email.
 */
export function accountKey(profile: { id: string }, providerId: string): string {
  return `${providerId}:${profile.id}`;
}

/**
 * Fetch and normalize the user.
 *
 * Prefers verified ID token claims when they cover every field the provider
 * declares, so OIDC logins cost no extra HTTP request.
 */
export async function fetchProfile<TRaw>(
  provider: Provider<TRaw>,
  tokens: OAuthTokens,
  options: {
    claims?: Record<string, unknown> | null;
    params?: Record<string, string>;
  } = {},
): Promise<Profile<TRaw>> {
  const spec = provider.profile;
  if (!spec) {
    throw new OAuthConfigError(
      provider.id,
      `${provider.id} does not define a profile mapping.`,
    );
  }

  const ctx: ProfileContext = {
    provider: provider as Provider,
    tokens,
    claims: options.claims ?? null,
    params: options.params ?? {},
  };

  let raw: TRaw;
  try {
    if (spec.fetchRaw) {
      raw = await spec.fetchRaw(ctx);
    } else if (spec.fromIdToken && ctx.claims !== null) {
      raw = ctx.claims as TRaw;
    } else if (spec.endpoint) {
      raw = (await fetchUserinfo(spec.endpoint, ctx, spec.headers)) as TRaw;
    } else {
      throw new OAuthConfigError(
        provider.id,
        `${provider.id} has no userinfo endpoint and no ID token to read claims from.`,
      );
    }
  } catch (cause) {
    // The tokens are valid and worth keeping even though this step failed.
    if (cause instanceof OAuthProfileError) throw cause;
    throw new OAuthProfileError(
      provider.id,
      `Failed to fetch the user profile from ${provider.id}.`,
      tokens,
      cause,
    );
  }

  return normalize(provider.id, spec.map(raw, ctx), raw, tokens.scopes);
}

async function fetchUserinfo(
  endpoint: string,
  ctx: ProfileContext,
  extraHeaders: ((ctx: ProfileContext) => Record<string, string>) | undefined,
): Promise<Record<string, unknown>> {
  const provider = ctx.provider;
  const response = await request(provider, endpoint, {
    method: "GET",
    headers: {
      authorization: `Bearer ${ctx.tokens.accessToken}`,
      accept: "application/json",
      ...extraHeaders?.(ctx),
    },
  });

  if (!response.ok) {
    throw new OAuthProtocolError(
      provider.id,
      `Userinfo request returned HTTP ${response.status}.`,
    );
  }
  return readJson(provider, response, "Userinfo endpoint");
}

/**
 * Apply the invariants that make the shape trustworthy across providers.
 * A mapper cannot opt out of these.
 */
function normalize<TRaw>(
  providerId: string,
  mapped: MappedProfile,
  raw: TRaw,
  grantedScopes: string[],
): Profile<TRaw> {
  // Numeric ids (GitHub, Spotify) become strings so the storage type never varies.
  const id =
    typeof mapped.id === "number" ? String(mapped.id) : mapped.id;
  if (typeof id !== "string" || id === "") {
    throw new OAuthProtocolError(
      providerId,
      "Provider response did not contain a usable account id.",
    );
  }

  const email = nonEmpty(mapped.email);
  return {
    id,
    email,
    // An unverified address is never treated as verified, and an absent address
    // can never be verified.
    emailVerified: email === null ? false : mapped.emailVerified === true,
    name: nonEmpty(mapped.name),
    username: nonEmpty(mapped.username),
    avatarUrl: nonEmpty(mapped.avatarUrl),
    grantedScopes,
    raw,
  };
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Providers occasionally send booleans as strings. Apple sends `"true"`. */
export function coerceBoolean(value: unknown): boolean {
  return value === true || value === "true";
}
