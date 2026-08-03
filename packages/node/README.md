# @oathly/node

Express, Fastify, and `node:http` adapter for [oathly](../oathly).

Every other runtime — Hono, Next, SvelteKit, Remix, Nitro, Elysia, Bun, Deno, Workers — speaks Web
`Request`/`Response` and needs no adapter.

```bash
npm i @oathly/node
```

## Express

```ts
import express from "express";
import { createFlow, github } from "oathly";
import { createNodeHandler } from "@oathly/node";

const login = createFlow({ provider: github({ clientId, clientSecret, redirectURI }) });
const app = express();

app.get("/auth/login", createNodeHandler((request) => login.start(request)));

app.get(
  "/auth/callback",
  createNodeHandler(async (request) => {
    const { profile, headers } = await login.callback(request);
    // create your session here
    headers.set("location", "/");
    return new Response(null, { status: 302, headers });
  }),
);
```

## API

| | |
| --- | --- |
| `toWebRequest(req, options?)` | Node request → Web `Request`, body included. |
| `applyResponse(res, response)` | Web `Response` → Node response, `Set-Cookie` headers kept separate. |
| `createNodeHandler(handler, options?)` | Wrap a Web-standard handler as Express/Connect middleware. |

## Behind a proxy

The request scheme decides whether oathly marks cookies `Secure`. `x-forwarded-proto` and
`x-forwarded-host` are honoured. If your proxy sends neither, set the origin explicitly:

```ts
createNodeHandler(handler, { origin: "https://example.com" });
```

## License

MIT
