# Microsoft

Register an app: <https://entra.microsoft.com>

```ts
import { createFlow, microsoft } from "oathly";

const login = createFlow({
  provider: microsoft({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Unverified — never use for account lookup |
| PKCE | Required, always sent |
| Token auth | `client_secret_post` |
| Default scopes | `openid`, `profile`, `email`, `User.Read` |
| Profile | `https://graph.microsoft.com/v1.0/me` |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| Token | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Userinfo | `https://graph.microsoft.com/v1.0/me` |

## Notes

- `id` is the Graph object id, not `sub`: Entra's `sub` is pairwise per app registration.
- Multi-tenant ID tokens cannot be verified against a fixed issuer, so identity comes from Graph. Pass a tenant GUID for verified ID tokens.
- Microsoft asserts nothing usable about email verification on personal accounts.
- Add the `offline_access` scope for a refresh token.

<sub>Generated from the provider definition. Do not edit.</sub>
