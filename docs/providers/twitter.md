# X (Twitter)

Register an app: <https://developer.x.com/en/portal/dashboard>

```ts
import { createFlow, twitter } from "oathly";

const login = createFlow({
  provider: twitter({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Not available |
| PKCE | Required, always sent |
| Token auth | `client_secret_basic` |
| Default scopes | `users.read`, `tweet.read` |
| Profile | `https://api.x.com/2/users/me?user.fields=profile_image_url` |
| ID token | Not used |
| Revocation | Supported |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://x.com/i/oauth2/authorize` |
| Token | `https://api.x.com/2/oauth2/token` |
| Revocation | `https://api.x.com/2/oauth2/revoke` |
| Userinfo | `https://api.x.com/2/users/me?user.fields=profile_image_url` |

## Notes

- The v2 API exposes no email address under any scope.
- PKCE is mandatory and the token endpoint requires HTTP Basic auth.
- Add the `offline.access` scope to receive a refresh token.
- Refresh tokens rotate: persist the new one from every refresh.

<sub>Generated from the provider definition. Do not edit.</sub>
