import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { OAuthConfigError, OAuthProtocolError } from "./errors.js";
import type { Provider } from "./types.js";

/**
 * One key set per provider instance. jose handles the caching, the cooldown,
 * and rotation — refetching keys on every login would be both slow and a good
 * way to get rate-limited.
 *
 * Keyed on the provider object rather than the URI so two providers pointing at
 * the same issuer through different transports (a mock server in tests, say)
 * never share an entry.
 */
const jwksCache = new WeakMap<Provider, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(provider: Provider, jwksUri: string) {
  let jwks = jwksCache.get(provider);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri), {
      // Route key fetching through the provider's fetch so the testing kit and
      // custom transports work for verification too.
      [customFetch]: provider.fetch as never,
    });
    jwksCache.set(provider, jwks);
  }
  return jwks;
}

/**
 * Verify an ID token: signature, issuer, audience, expiry, and nonce.
 *
 * oathly never decodes an ID token without verifying it. An unverified ID
 * token is attacker-controlled JSON — trusting its `sub` or `email_verified`
 * is a straight path to account takeover.
 */
export async function verifyIdToken(
  provider: Provider,
  idToken: string,
  options: { nonce?: string | null } = {},
): Promise<Record<string, unknown>> {
  if (!provider.jwksUri || !provider.issuer) {
    throw new OAuthConfigError(
      provider.id,
      `${provider.id} has no issuer/jwksUri, so its ID tokens cannot be verified.`,
    );
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(idToken, getJwks(provider, provider.jwksUri), {
      issuer: provider.issuer,
      audience: provider.clientId,
      // Providers routinely have a few seconds of clock skew.
      clockTolerance: 30,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (cause) {
    throw new OAuthProtocolError(
      provider.id,
      "ID token failed verification.",
      cause,
    );
  }

  const expectedNonce = options.nonce;
  if (expectedNonce) {
    if (payload["nonce"] !== expectedNonce) {
      throw new OAuthProtocolError(
        provider.id,
        "ID token nonce did not match the authorization request.",
      );
    }
  }

  return payload;
}

/** Whether this provider is configured well enough to verify ID tokens. */
export function canVerifyIdToken(provider: Provider): boolean {
  return Boolean(provider.issuer && provider.jwksUri);
}
