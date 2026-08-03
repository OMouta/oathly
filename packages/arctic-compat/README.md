# @oathly/arctic-compat

Drop-in replacement for the deprecated [`arctic`](https://github.com/pilcrowonpaper/arctic) package,
implemented on [oathly](../oathly).

```bash
npm uninstall arctic
npm install oathly @oathly/arctic-compat
```

```diff
- import * as arctic from "arctic";
+ import * as arctic from "@oathly/arctic-compat";
```

Provider classes, a synchronous `createAuthorizationURL`, `OAuth2Tokens` accessors,
`OAuth2RequestError`, and `ArcticFetchError` all keep working.

## Differences

- **A redirect URI is required.** Arctic accepted `null`; oathly always sends an exact match.
- **Reddit needs a user agent** as an optional fourth constructor argument.
- **No `nonce` is sent and ID tokens are not verified**, matching Arctic. oathly's native API does
  both — see the [migration guide](../../docs/migrating-from-arctic.md).

## Providers

`Apple` · `Bitbucket` · `Discord` · `Dropbox` · `Facebook` · `GitHub` · `GitLab` · `Google` ·
`LinkedIn` · `MicrosoftEntraId` · `Notion` · `Reddit` · `Slack` · `Spotify` · `Twitch` · `Twitter`

Constructor argument order follows Arctic v3. PKCE providers take the code verifier as the second
argument to `createAuthorizationURL`; others take `(state, scopes)`.

## Bundled SHA-256

oathly hashes PKCE challenges with WebCrypto, which is async. Arctic's `createAuthorizationURL` was
synchronous, so this package ships a small synchronous SHA-256, verified against WebCrypto and the
RFC 7636 test vector. It hashes only the public code verifier; do not reuse it elsewhere.

## License

MIT
