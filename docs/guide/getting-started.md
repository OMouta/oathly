# Getting started

oathly is an OAuth 2.0 and OpenID Connect client. It hands you tokens and a verified identity, then
gets out of the way — sessions, database, and user model are yours.

```bash
npm i oathly
```

Node 20+, Bun, Deno, Cloudflare Workers, or any runtime with `fetch` and WebCrypto.

## Register an application

Create an OAuth app with your provider and set the redirect URI to a callback route in your app, for
example `https://example.com/auth/callback`. It must match exactly — oathly never sends a wildcard.

Each [provider page](/providers/) links to the right registration screen.

## Two routes

```ts
import { createFlow, github } from "oathly";

export const login = createFlow({
  provider: github({
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectURI: "https://example.com/auth/callback",
  }),
});
```

**Start** redirects the user to the provider:

```ts
// GET /auth/login
const start = (request: Request) => login.start(request);
```

**Callback** validates the response and exchanges the code:

```ts
// GET /auth/callback
async function callback(request: Request) {
  const { tokens, profile, headers } = await login.callback(request);

  // Your job from here: create a session, set your own cookie.
  const session = await createSession(profile);
  headers.append("set-cookie", session.cookie);
  headers.set("location", "/");

  return new Response(null, { status: 302, headers });
}
```

`headers` carries the `Set-Cookie` that clears oathly's in-flight state. Merge it into your response
rather than replacing it.

## What you get

```ts
profile.id;            // "4242" — stable provider id
profile.email;         // "ada@example.com" | null
profile.emailVerified; // true only if the provider asserts it
profile.name;          // "Ada Lovelace" | null
profile.username;      // "ada" | null
profile.avatarUrl;     // absolute URL | null
profile.raw;           // the full provider response, typed

tokens.accessToken;    // string
tokens.refreshToken;   // string | null
tokens.expiresAt;      // Date | null
tokens.scopes;         // what was actually granted
```

Store users by `(provider, id)` — never by email. Read [account linking](/account-linking) before
you wire up sign-in.

## Next

- [Frameworks](/guide/frameworks) — copy-paste routes for your stack
- [The flow](/guide/flow) — scopes, storage, and options
- [Testing](/guide/testing) — run a whole login in a unit test
