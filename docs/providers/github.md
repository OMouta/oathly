# GitHub

Register an app: <https://github.com/settings/developers>

```ts
import { createFlow, github } from "oathly";

const login = createFlow({
  provider: github({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Not supported by the provider |
| Token auth | `client_secret_post` |
| Default scopes | `read:user`, `user:email` |
| Profile | Custom request, see notes |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://github.com/login/oauth/authorize` |
| Token | `https://github.com/login/oauth/access_token` |

## Notes

- GitHub OAuth Apps ignore PKCE, so no challenge is sent.
- `/user` exposes only the public email and never marks it verified; oathly calls `/user/emails` for the verified primary.
- The token endpoint answers errors with HTTP 200 and an error body.
- Scopes come back comma-delimited even though they are sent space-delimited.
- Key accounts on the numeric `id`: `login` can be renamed and reused.

<sub>Generated from the provider definition. Do not edit.</sub>
