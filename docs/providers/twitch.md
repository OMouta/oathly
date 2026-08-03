# Twitch

Register an app: <https://dev.twitch.tv/console/apps>

```ts
import { createFlow, twitch } from "oathly";

const login = createFlow({
  provider: twitch({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `user:read:email` |
| Profile | `https://api.twitch.tv/helix/users` |
| ID token | Verified |
| Revocation | Supported |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://id.twitch.tv/oauth2/authorize` |
| Token | `https://id.twitch.tv/oauth2/token` |
| Revocation | `https://id.twitch.tv/oauth2/revoke` |
| Issuer | `https://id.twitch.tv/oauth2` |
| JWKS | `https://id.twitch.tv/oauth2/keys` |
| Userinfo | `https://api.twitch.tv/helix/users` |

## Notes

- The Helix API requires a `Client-Id` header alongside the bearer token; oathly sends it.
- `user:read:email` is required for an email address to be returned at all.
- Twitch requires an exact redirect URI match, including the trailing slash.

<sub>Generated from the provider definition. Do not edit.</sub>
