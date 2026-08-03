# Coming from Arctic

[Arctic](https://github.com/pilcrowonpaper/arctic) is deprecated. oathly covers the same ground and
adds normalized profiles, state and PKCE handling, and verified ID tokens.

## 1. One-line migration

```bash
npm uninstall arctic
npm install oathly @oathly/arctic-compat
```

```diff
- import * as arctic from "arctic";
+ import * as arctic from "@oathly/arctic-compat";
```

Two differences: a redirect URI is required (Arctic allowed `null`), and Reddit needs a user agent
as an optional fourth constructor argument.

Compat mode reproduces Arctic's behaviour, including **no `nonce` on OIDC requests and no ID token
verification**. Both are fixed by the native API.

## 2. Native API

### Before

```ts
const state = arctic.generateState();
const url = github.createAuthorizationURL(state, ["user:email"]);
setCookie("github_oauth_state", state, {
  httpOnly: true, secure: true, maxAge: 600, path: "/", sameSite: "lax",
});
redirect(url.toString());

// callback
if (!code || !state || state !== storedState) return new Response(null, { status: 400 });
const tokens = await github.validateAuthorizationCode(code);
const user = await fetch("https://api.github.com/user", {
  headers: { Authorization: `Bearer ${tokens.accessToken()}` },
}).then((r) => r.json());
// plus /user/emails for a verified address
```

### After

```ts
const login = createFlow({
  provider: github({ clientId, clientSecret, redirectURI }),
  scopes: ["read:user", "user:email"],
});

export const GET = (request: Request) => login.start(request);

const { tokens, profile, headers } = await login.callback(request);
```

### Mapping

| Arctic | oathly |
| --- | --- |
| `new arctic.GitHub(id, secret, uri)` | `github({ clientId, clientSecret, redirectURI })` |
| `generateState()` / `generateCodeVerifier()` | handled by `createFlow` |
| `client.createAuthorizationURL(...)` | `flow.start(request)` |
| `client.validateAuthorizationCode(code, verifier)` | `flow.callback(request)` |
| `client.refreshAccessToken(token)` | `refreshTokens(provider, token)` |
| `client.revokeToken(token)` | `revokeToken(provider, token)` |
| `tokens.accessToken()` | `tokens.accessToken` |
| `tokens.accessTokenExpiresAt()` | `tokens.expiresAt` |
| `tokens.hasRefreshToken()` / `refreshToken()` | `tokens.refreshToken` (`null` when absent) |
| hand-rolled user fetch | `profile` |
| `OAuth2RequestError` | `OAuthTokenError` |
| `ArcticFetchError` | `OAuthNetworkError` |
| `UnexpectedResponseError` | `OAuthProtocolError` |

### Behaviour changes

- Accessors became properties, and missing values are `null` rather than throwing.
- `createAuthorizationURL` is async in the native API (WebCrypto). `createFlow` hides this; the
  compat layer stays synchronous.
- ID tokens are verified: signature, issuer, audience, expiry, nonce.
- `emailVerified` is `false` unless the provider asserts it. See [account linking](./account-linking.md).

## Testing the migration

```ts
import { completeLogin, createMockAuthServer } from "@oathly/testing";

const server = await createMockAuthServer();
const flow = createFlow({ provider: server.provider });
const { profile } = await completeLogin(flow, server);
```
