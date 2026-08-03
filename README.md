<p align="center">
  <img src="assets/oathly-mark.png" alt="oathly" width="128" />
</p>

<h1 align="center">oathly</h1>

<p align="center">
  OAuth 2.0 and OpenID Connect for any framework.<br />
  You get tokens and a verified identity; you own your sessions.
</p>

```ts
import { createFlow, github } from "oathly";

const login = createFlow({ provider: github({ clientId, clientSecret, redirectURI }) });

export const GET = (request: Request) => login.start(request);  // /auth/login
const { tokens, profile } = await login.callback(request);      // /auth/callback
```

## Packages

| Package | |
| --- | --- |
| [`oathly`](./packages/oathly) | The library. 16 providers, no framework coupling. |
| [`@oathly/testing`](./packages/testing) | In-process mock authorization server. |
| [`@oathly/node`](./packages/node) | Express/Fastify adapter. |
| [`@oathly/arctic-compat`](./packages/arctic-compat) | Drop-in replacement for `arctic`. |

## Docs

- [Providers](./docs/providers/README.md)
- [Account linking](./docs/account-linking.md)
- [Coming from Arctic](./docs/migrating-from-arctic.md)

## Development

```bash
pnpm install
pnpm run check          # typecheck + test + docs:check
pnpm run build
pnpm run smoke          # drive a full login against the built output

pnpm run docs:generate  # regenerate docs/providers from the definitions
pnpm run docs:dev       # docs site, local
pnpm run docs:build     # docs site, production
```

Node 20+. Use `pnpm run docs:generate`, not `pnpm docs` — the latter is a built-in pnpm command.

## License

MIT
