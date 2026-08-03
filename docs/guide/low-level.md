# Low-level API

`createFlow` is the recommended path. Underneath it is a stateless protocol layer you can drive
yourself when you need to — native apps, device flows, or storing state somewhere unusual.

```ts
import {
  createAuthorizationURL,
  exchangeCode,
  refreshTokens,
  revokeToken,
  verifyIdToken,
  fetchProfile,
} from "oathly";
```

## By hand

```ts
const provider = google({ clientId, clientSecret, redirectURI });

// 1. Build the URL. Keep state, codeVerifier, and nonce somewhere.
const { url, state, codeVerifier, nonce } = await createAuthorizationURL(provider, {
  scopes: ["openid", "email"],
});

// 2. On callback, compare state yourself, then exchange.
const tokens = await exchangeCode(provider, { code, codeVerifier });

// 3. Verify the ID token. Never trust an unverified one.
const claims = tokens.idToken
  ? await verifyIdToken(provider, tokens.idToken, { nonce })
  : null;

// 4. Normalize the user.
const profile = await fetchProfile(provider, tokens, { claims });
```

Comparing state is your responsibility here. Use `constantTimeEqual` from `oathly` rather than `===`.

## Any OIDC provider

```ts
import { discover } from "oathly";

const provider = await discover("https://id.example.com/realms/main", {
  clientId,
  clientSecret,
  redirectURI,
});
```

Discovery is explicitly async and meant to run once at startup — doing it on every login is a
latency bug and a hard dependency on someone else's uptime. The document's `issuer` is checked
against the one you asked for, so a redirect cannot swap in another identity provider.

## Custom providers

```ts
import { defineProvider } from "oathly";

export const acme = defineProvider({
  id: "acme",
  authorizationEndpoint: "https://acme.example/oauth/authorize",
  tokenEndpoint: "https://acme.example/oauth/token",
  pkce: "supported",
  tokenAuth: "client_secret_post",
  defaultScopes: ["profile"],
  profile: {
    endpoint: "https://acme.example/api/me",
    map: (user) => ({
      id: user.id,
      email: user.email ?? null,
      emailVerified: user.email_confirmed === true,
      name: user.full_name ?? null,
      username: user.handle ?? null,
      avatarUrl: user.avatar ?? null,
    }),
  },
});
```

Useful fields for awkward providers:

| | |
| --- | --- |
| `profile.fetchRaw` | Full control when identity takes more than one request. |
| `profile.headers` | Extra headers, e.g. an API client id. |
| `profile.fromIdToken` | Read claims from the verified ID token instead of userinfo. |
| `tokenBodyFormat` | `"json"` for providers that reject form encoding. |
| `tokenHeaders` | Headers sent with every token request. |
| `authorizationParams` | Always appended to the authorization URL. |

`fromIdToken` only takes effect when `issuer` and `jwksUri` are set — oathly will not read claims it
cannot verify.

## Escape hatches

Nothing is ever blocked waiting on oathly to add a flag:

```ts
await createAuthorizationURL(provider, { params: { prompt: "select_account" } });
await exchangeCode(provider, { code, params: { audience: "https://api.example" } });
```

Caller-supplied parameters override everything oathly sets.
