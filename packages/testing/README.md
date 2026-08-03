# @oathly/testing

In-process OAuth 2.0 / OpenID Connect authorization server for testing [oathly](../oathly) logins.
No network, no socket, no fixtures.

```bash
npm i -D @oathly/testing
```

## Use

```ts
import { createFlow } from "oathly";
import { completeLogin, createMockAuthServer } from "@oathly/testing";

it("signs a user in", async () => {
  const server = await createMockAuthServer();
  const flow = createFlow({ provider: server.provider });

  const { tokens, profile } = await completeLogin(flow, server);

  expect(profile.id).toBe("mock-user-1");
});
```

`completeLogin` runs `start()` → consent → `callback()`, carrying cookies like a browser.

## Simulating the awkward cases

```ts
server.setUser({ sub: "u2", email: "bob@test.dev", email_verified: false });
server.failNextTokenRequest({ error: "invalid_grant" });
server.deny(authorizationUrl);                                  // user cancels
await completeLogin(flow, server, { grantedScopes: ["openid"] }); // partial grant
server.requests;                                                // everything received
```

The server enforces the protocol, so wiring bugs fail rather than pass: mismatched PKCE verifiers,
reused authorization codes, and unregistered `redirect_uri`s are all rejected.

## API

| | |
| --- | --- |
| `createMockAuthServer(options?)` | Returns `{ provider, fetch, issuer, requests, ... }`. |
| `completeLogin(flow, server, options?)` | Runs a full login, returns the `CallbackResult`. |
| `server.authorize(url, options?)` | Approve consent; returns the callback URL. |
| `server.deny(url, error?)` | Cancel consent; returns the callback URL. |
| `server.setUser(user)` | Change who is signed in. |
| `server.failNextTokenRequest(error)` | Queue a one-shot token endpoint failure. |
| `server.reset()` | Clear codes, tokens, requests, and queued failures. |
| `CookieJar` | Minimal cookie jar for driving the flow yourself. |

`server.fetch` is the transport, so `discover(server.issuer, { fetch: server.fetch })` works too.

## License

MIT
