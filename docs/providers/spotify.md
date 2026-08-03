# Spotify

Register an app: <https://developer.spotify.com/dashboard>

```ts
import { createFlow, spotify } from "oathly";

const login = createFlow({
  provider: spotify({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Unverified — never use for account lookup |
| PKCE | Always sent |
| Token auth | `client_secret_basic` |
| Default scopes | `user-read-email`, `user-read-private` |
| Profile | `https://api.spotify.com/v1/me` |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://accounts.spotify.com/authorize` |
| Token | `https://accounts.spotify.com/api/token` |
| Userinfo | `https://api.spotify.com/v1/me` |

## Notes

- Spotify does not verify email addresses. Never use one for account lookup.
- The token endpoint requires HTTP Basic auth.
- `user-read-email` is required for an address to be returned.

<sub>Generated from the provider definition. Do not edit.</sub>
