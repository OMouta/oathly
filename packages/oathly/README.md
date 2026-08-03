# oathly

OAuth 2.0 and OpenID Connect for any framework. You get tokens and a verified identity; you own your sessions.

```bash
npm i oathly
```

## Quickstart

```ts
import { createFlow, github } from "oathly";

const login = createFlow({
  provider: github({
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectURI: "https://example.com/auth/callback",
  }),
});

// GET /auth/login
const start = (request: Request) => login.start(request);

// GET /auth/callback
async function callback(request: Request) {
  const { tokens, profile, headers } = await login.callback(request);
  // Create your session here, then merge `headers` into your response.
  headers.set("location", "/");
  return new Response(null, { status: 302, headers });
}
```

`Request` in, `Response` out: the same code on Hono, Next App Router, SvelteKit, Remix, Nitro,
Elysia, Bun, Deno, and Workers. Express and Fastify use [`@oathly/node`](../node).

State, PKCE, nonce, and ID token verification are handled by `createFlow`.

## Profile

Identical across every provider:

```ts
interface Profile<Raw> {
  id: string;              // stable provider id, never an email or username
  email: string | null;
  emailVerified: boolean;
  name: string | null;     // display name
  username: string | null;
  avatarUrl: string | null;
  grantedScopes: string[]; // may be less than you requested
  raw: Raw;                // untouched provider response, typed
}
```

`emailVerified` is `true` only where the provider explicitly asserts it — never inferred.
Facebook, Spotify, Microsoft personal accounts, and Notion assert nothing, so it is `false` there.
Store `(provider, id)`, not the email:

```ts
import { accountKey } from "oathly";
accountKey(profile, "github"); // "github:4242"
```

See [account linking](../../docs/account-linking.md).

## Providers

`apple` · `bitbucket` · `discord` · `dropbox` · `facebook` · `github` · `gitlab` · `google` ·
`linkedin` · `microsoft` · `notion` · `reddit` · `slack` · `spotify` · `twitch` · `twitter`

Endpoints, scopes, and per-provider quirks: [provider reference](../../docs/providers/README.md).

Any other OIDC provider works through discovery:

```ts
import { discover } from "oathly";
const provider = await discover("https://id.example.com", { clientId, clientSecret, redirectURI });
```

## Escape hatches

```ts
login.start(request, { params: { login_hint: "a@b.com" } });   // provider-specific params
createFlow({ provider, requireScopes: ["user:email"] });       // fail if a scope is not granted
createFlow({ provider, store: myStore });                      // replace cookie storage
createFlow({ provider, profile: false });                      // tokens only

import { createAuthorizationURL, exchangeCode, fetchProfile, refreshTokens, revokeToken } from "oathly";
```

## Errors

Every error has a stable `code` and carries no secrets.

```ts
import { OAuthCallbackError } from "oathly";

try {
  await login.callback(request);
} catch (error) {
  if (error instanceof OAuthCallbackError && error.code === "access_denied") {
    return redirect("/login?cancelled=1");
  }
  throw error;
}
```

`OAuthCallbackError` · `OAuthTokenError` · `OAuthNetworkError` · `OAuthProtocolError` ·
`OAuthProfileError` · `OAuthScopeError` · `OAuthConfigError`

`OAuthProfileError` carries the tokens, so a failed profile fetch does not lose a successful exchange.

## Testing

[`@oathly/testing`](../testing) runs a full login in process, with no network:

```ts
const server = await createMockAuthServer();
const flow = createFlow({ provider: server.provider });
const { profile } = await completeLogin(flow, server);
```

## Non-goals

No sessions, database, user model, UI, passwords, magic links, or passkeys.

## License

MIT
