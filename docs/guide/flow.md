# The flow

`createFlow` owns everything between the redirect out and the callback back: state, PKCE, nonce,
ID token verification, and the profile fetch.

```ts
const login = createFlow({
  provider: github({ clientId, clientSecret, redirectURI }),
  scopes: ["read:user", "user:email"],
  requireScopes: ["user:email"],
  profile: true,
  cookie: { secure: true },
});
```

| Option | |
| --- | --- |
| `provider` | Required. |
| `scopes` | Defaults to the provider's own defaults. |
| `requireScopes` | Throws `OAuthScopeError` if one is not granted. |
| `profile` | Set `false` to skip the profile request and return tokens only. |
| `params` | Extra authorization parameters. |
| `cookie` | `name`, `secure`, `path`, `maxAge`, `sameSite`. |
| `store` | Replace cookie storage entirely. |

## start

```ts
const response = await login.start(request);
```

Returns a `302` with the state cookie set. Per-call overrides:

```ts
login.start(request, {
  scopes: ["read:user"],
  params: { login_hint: "ada@example.com" },
});
```

## callback

```ts
const { tokens, profile, claims, params, headers } = await login.callback(request);
```

| | |
| --- | --- |
| `tokens` | Access token, refresh token, expiry, granted scopes, `raw`. |
| `profile` | The normalized user, or `null` when `profile: false`. |
| `claims` | Verified ID token claims, or `null`. |
| `params` | The raw callback parameters. |
| `headers` | `Set-Cookie` that clears the in-flight state — merge into your response. |

Query strings and form posts are both read, so Apple's `response_mode=form_post` callback needs no
special handling.

## The state cookie

Short-lived (10 minutes), `HttpOnly`, `SameSite=Lax`, and prefixed `__Host-` whenever the connection
is secure, which stops a subdomain from tossing a cookie onto the parent.

It is not signed, deliberately. State is validated by comparing it to the cookie; a signature adds
nothing, since an attacker able to mint cookies would simply use a signed pair from their own flow.

## Custom storage

Cookies are the default, not a requirement. Anything matching `FlowStore` works — KV on serverless,
an in-memory map for native app deep links:

```ts
interface FlowStore {
  set(key: string, value: string): Promise<Headers> | Headers;
  get(key: string, request: Request): Promise<string | null> | string | null;
  clear(key: string): Promise<Headers> | Headers;
}

createFlow({ provider, store: myStore });
```

## Scopes you actually got

Users can grant less than you asked for — Google's granular consent, GitHub org restrictions,
Facebook's per-permission opt-out. `profile.grantedScopes` and `tokens.scopes` report what was
really granted.

A partial grant is not an error by default; a user declining an optional permission is a choice, not
a protocol failure. List the ones you genuinely cannot work without:

```ts
createFlow({ provider, requireScopes: ["user:email"] });
```

## Refresh and revoke

```ts
import { refreshTokens, revokeToken } from "oathly";

const fresh = await refreshTokens(provider, oldRefreshToken);
// Some providers rotate the refresh token, some do not:
await save(fresh.refreshToken ?? oldRefreshToken);

await revokeToken(provider, tokens.accessToken);
```
