# Testing

`@oathly/testing` is an OAuth 2.0 / OpenID Connect authorization server that runs in your test
process. No network, no socket, no recorded fixtures.

```bash
npm i -D @oathly/testing
```

## A whole login in one call

```ts
import { createFlow } from "oathly";
import { completeLogin, createMockAuthServer } from "@oathly/testing";

it("signs a user in", async () => {
  const server = await createMockAuthServer();
  const flow = createFlow({ provider: server.provider });

  const { tokens, profile } = await completeLogin(flow, server);

  expect(profile.id).toBe("mock-user-1");
  expect(profile.emailVerified).toBe(true);
});
```

`completeLogin` runs `start()` → consent → `callback()`, carrying cookies the way a browser would.
PKCE, state, nonce, and JWKS verification all really happen — the server signs its ID tokens with a
generated ES256 key and serves the matching JWKS.

## Cases you cannot reproduce by hand

```ts
// A different user
server.setUser({ sub: "u2", email: "bob@test.dev", email_verified: false });

// A user who declines an optional scope
await completeLogin(flow, server, { grantedScopes: ["openid"] });

// A token endpoint that fails once
server.failNextTokenRequest({ error: "invalid_grant", error_description: "Code expired" });

// A user who cancels
const callbackUrl = server.deny(authorizationUrl);

// Everything the server received
server.requests;
```

## It enforces the protocol

Wiring bugs fail instead of passing silently. The server rejects a mismatched PKCE verifier, a
reused authorization code, and an unregistered `redirect_uri`.

## Testing your own routes

```ts
const server = await createMockAuthServer({
  redirectURI: "http://localhost:3000/auth/callback",
});

const response = await app.request("/auth/login");
const callbackUrl = server.authorize(response.headers.get("location")!);
// ...drive your callback route with the cookie from the first response
```

`server.fetch` is the transport, so any provider can point at it — including one built from the
server's own discovery document:

```ts
const provider = await discover(server.issuer, {
  clientId: "mock-client-id",
  clientSecret: "mock-client-secret",
  redirectURI: "https://app.oathly.test/auth/callback",
  fetch: server.fetch,
});
```
