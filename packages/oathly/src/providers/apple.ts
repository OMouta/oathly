import { SignJWT, importPKCS8 } from "jose";
import { createProvider } from "../define.js";
import { coerceBoolean } from "../profile.js";
import type { FetchLike, Provider, ProviderDefinition } from "../types.js";

export interface AppleClaims {
  sub: string;
  email?: string;
  /** Apple sometimes sends this as the string `"true"` rather than a boolean. */
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  [key: string]: unknown;
}

export interface AppleOptions {
  /** Your Services ID, not the App ID. */
  clientId: string;
  /** Ten-character Apple Developer team id. */
  teamId: string;
  /** Key id for the .p8 signing key. */
  keyId: string;
  /** Contents of the .p8 file, PKCS#8 PEM. Keep it out of source control. */
  privateKey: string;
  redirectURI: string;
  fetch?: FetchLike;
}

/**
 * Apple's "client secret" is a short-lived ES256 JWT you have to mint and
 * re-mint. Generated on demand and cached until just before it expires.
 */
function clientSecretFactory(options: AppleOptions): () => Promise<string> {
  let cached: { secret: string; expiresAt: number } | null = null;

  return async () => {
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt - 60 > now) return cached.secret;

    // Apple allows up to six months. An hour is plenty and limits the blast
    // radius if one ever leaks into a log.
    const expiresAt = now + 3600;
    const key = await importPKCS8(options.privateKey, "ES256");
    const secret = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: options.keyId })
      .setIssuer(options.teamId)
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .setAudience("https://appleid.apple.com")
      .setSubject(options.clientId)
      .sign(key);

    cached = { secret, expiresAt };
    return secret;
  };
}

const definition: ProviderDefinition<AppleClaims & { name: string | null }> = {
  id: "apple",
  meta: {
    name: "Apple",
    setupUrl: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
    emailTrust: "asserted",
    notes: [
      "The client secret is a short-lived ES256 JWT; oathly mints and re-mints it from your .p8 key.",
      "The callback is a form POST, which `flow.callback()` reads.",
      "The user's name arrives once, in the first callback only. Persist it then or lose it.",
      "Addresses may be `@privaterelay.appleid.com` and stop working if forwarding is disabled — never key on them.",
      "`email_verified` sometimes arrives as the string \"true\"; it is normalized.",
    ],
  },
  authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
  tokenEndpoint: "https://appleid.apple.com/auth/token",
  issuer: "https://appleid.apple.com",
  jwksUri: "https://appleid.apple.com/auth/keys",
  pkce: "supported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["name", "email"],
  // Requesting name or email makes Apple POST the callback as a form.
  // `flow.callback()` reads both query and form bodies, so this just works.
  authorizationParams: { response_mode: "form_post" },
  profile: {
    fromIdToken: true,
    map: (raw, ctx) => ({
      id: raw.sub,
      email: raw.email ?? null,
      emailVerified: coerceBoolean(raw.email_verified),
      // Apple sends the name exactly once, in the first callback's `user`
      // field, and never again. If you do not persist it now, it is gone.
      name: raw.name ?? readNameFromCallback(ctx.params["user"]),
      username: null,
      avatarUrl: null,
    }),
  },
};

function readNameFromCallback(userField: string | undefined): string | null {
  if (!userField) return null;
  try {
    const parsed = JSON.parse(userField) as {
      name?: { firstName?: string; lastName?: string };
    };
    const name = [parsed.name?.firstName, parsed.name?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name === "" ? null : name;
  } catch {
    return null;
  }
}

/**
 * Sign in with Apple.
 *
 * Identity comes from the verified ID token — Apple has no userinfo endpoint.
 * Note that `email` may be a `@privaterelay.appleid.com` address that stops
 * working if the user turns off forwarding, so never key accounts on it.
 */
export function apple(
  options: AppleOptions,
): Provider<AppleClaims & { name: string | null }> {
  return createProvider(definition, {
    clientId: options.clientId,
    redirectURI: options.redirectURI,
    clientSecret: clientSecretFactory(options),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}
