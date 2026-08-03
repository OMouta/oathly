# Reddit

Register an app: <https://www.reddit.com/prefs/apps>

```ts
import { createFlow, reddit } from "oathly";

const login = createFlow({
  provider: reddit({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Not available |
| PKCE | Always sent |
| Token auth | `client_secret_basic` |
| Default scopes | `identity` |
| Profile | `https://oauth.reddit.com/api/v1/me` |
| ID token | Not used |
| Revocation | Supported |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://www.reddit.com/api/v1/authorize` |
| Token | `https://www.reddit.com/api/v1/access_token` |
| Revocation | `https://www.reddit.com/api/v1/revoke_token` |
| Userinfo | `https://oauth.reddit.com/api/v1/me` |

## Notes

- A descriptive `userAgent` is mandatory; Reddit rate-limits or blocks generic ones.
- Set `permanent: true` to receive a refresh token.
- Reddit exposes `has_verified_email` but never the address itself.
- The token endpoint uses HTTP Basic authentication.

<sub>Generated from the provider definition. Do not edit.</sub>
