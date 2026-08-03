# Frameworks

`flow.start()` takes a `Request` and returns a `Response`; `flow.callback()` takes a `Request`.
Anything built on Web standards works without an adapter.

All examples assume:

```ts
import { createFlow, github } from "oathly";

export const login = createFlow({
  provider: github({ clientId, clientSecret, redirectURI }),
});
```

## Hono

```ts
app.get("/auth/login", (c) => login.start(c.req.raw));

app.get("/auth/callback", async (c) => {
  const { profile, headers } = await login.callback(c.req.raw);
  headers.set("location", "/");
  return new Response(null, { status: 302, headers });
});
```

## Next.js (App Router)

```ts
// app/auth/login/route.ts
export const GET = (request: Request) => login.start(request);
```

```ts
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const { profile, headers } = await login.callback(request);
  headers.set("location", "/");
  return new Response(null, { status: 302, headers });
}
```

## SvelteKit

```ts
// src/routes/auth/login/+server.ts
export const GET = ({ request }) => login.start(request);
```

```ts
// src/routes/auth/callback/+server.ts
export async function GET({ request }) {
  const { profile, headers } = await login.callback(request);
  headers.set("location", "/");
  return new Response(null, { status: 302, headers });
}
```

## Remix / React Router

```ts
export async function loader({ request }: LoaderFunctionArgs) {
  return login.start(request);
}
```

## Elysia, Bun, Deno, Workers

```ts
export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/auth/login") return login.start(request);
    if (url.pathname === "/auth/callback") {
      const { profile, headers } = await login.callback(request);
      headers.set("location", "/");
      return new Response(null, { status: 302, headers });
    }
    return new Response("Not found", { status: 404 });
  },
};
```

## Express / Fastify

Node's `req`/`res` predate the Web API, so these use
[`@oathly/node`](https://github.com/OMouta/oathly/tree/main/packages/node):

```bash
npm i @oathly/node
```

```ts
import { createNodeHandler } from "@oathly/node";

app.get("/auth/login", createNodeHandler((request) => login.start(request)));

app.get(
  "/auth/callback",
  createNodeHandler(async (request) => {
    const { profile, headers } = await login.callback(request);
    headers.set("location", "/");
    return new Response(null, { status: 302, headers });
  }),
);
```

## Behind a proxy

oathly decides whether to mark its cookie `Secure` from the request scheme, honouring
`x-forwarded-proto`. If your proxy sends neither a scheme nor that header, set it explicitly:

```ts
createFlow({ provider, cookie: { secure: true } });
```
