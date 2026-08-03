# Discord

Register an app: <https://discord.com/developers/applications>

```ts
import { createFlow, discord } from "oathly";

const login = createFlow({
  provider: discord({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `identify`, `email` |
| Profile | `https://discord.com/api/users/@me` |
| ID token | Not used |
| Revocation | Supported |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://discord.com/oauth2/authorize` |
| Token | `https://discord.com/api/oauth2/token` |
| Revocation | `https://discord.com/api/oauth2/token/revoke` |
| Userinfo | `https://discord.com/api/users/@me` |

## Notes

- The `email` scope is required for an address; `identify` alone returns none.
- Avatar hashes are assembled into CDN URLs, animated ones included.
- Usernames have been changeable since the 2023 migration — key on the snowflake id.

<sub>Generated from the provider definition. Do not edit.</sub>
