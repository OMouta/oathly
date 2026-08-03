# GitLab

Register an app: <https://gitlab.com/-/user_settings/applications>

```ts
import { createFlow, gitlab } from "oathly";

const login = createFlow({
  provider: gitlab({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Required, always sent |
| Token auth | `client_secret_post` |
| Default scopes | `read_user` |
| Profile | `https://gitlab.com/api/v4/user` |
| ID token | Verified |
| Revocation | Supported |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://gitlab.com/oauth/authorize` |
| Token | `https://gitlab.com/oauth/token` |
| Revocation | `https://gitlab.com/oauth/revoke` |
| Issuer | `https://gitlab.com` |
| JWKS | `https://gitlab.com/oauth/discovery/keys` |
| Userinfo | `https://gitlab.com/api/v4/user` |

## Notes

- Pass `baseUrl` for a self-managed instance; every endpoint follows it.
- GitLab confirms addresses before an account can be used, and reports it via `confirmed_at`.

<sub>Generated from the provider definition. Do not edit.</sub>
