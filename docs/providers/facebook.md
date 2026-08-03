# Facebook

Register an app: <https://developers.facebook.com/apps>

```ts
import { createFlow, facebook } from "oathly";

const login = createFlow({
  provider: facebook({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Unverified — never use for account lookup |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `email`, `public_profile` |
| Profile | Custom request, see notes |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://www.facebook.com/v21.0/dialog/oauth` |
| Token | `https://graph.facebook.com/v21.0/oauth/access_token` |

## Notes

- Facebook makes no email verification claim, so `emailVerified` is always false.
- Graph requests are signed with `appsecret_proof` automatically.
- An account with no confirmed address, or one registered by phone, returns no email at all.

<sub>Generated from the provider definition. Do not edit.</sub>
