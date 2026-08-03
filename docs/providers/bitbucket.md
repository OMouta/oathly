# Bitbucket

Register an app: <https://bitbucket.org/account/settings/app-passwords/>

```ts
import { createFlow, bitbucket } from "oathly";

const login = createFlow({
  provider: bitbucket({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_basic` |
| Default scopes | `account`, `email` |
| Profile | Custom request, see notes |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://bitbucket.org/site/oauth2/authorize` |
| Token | `https://bitbucket.org/site/oauth2/access_token` |

## Notes

- `/2.0/user` returns no email; oathly makes a second call to `/2.0/user/emails`.
- The token endpoint uses HTTP Basic auth.
- `account_id` is stable across username changes and is used as the id.

<sub>Generated from the provider definition. Do not edit.</sub>
