# Dropbox

Register an app: <https://www.dropbox.com/developers/apps>

```ts
import { createFlow, dropbox } from "oathly";

const login = createFlow({
  provider: dropbox({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `account_info.read` |
| Profile | Custom request, see notes |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://www.dropbox.com/oauth2/authorize` |
| Token | `https://api.dropboxapi.com/oauth2/token` |

## Notes

- Set `offlineAccess: true` for a refresh token; access tokens expire in four hours.
- `get_current_account` is a POST with a null body, not a GET.

<sub>Generated from the provider definition. Do not edit.</sub>
