# Google

Register an app: <https://console.cloud.google.com/apis/credentials>

```ts
import { createFlow, google } from "oathly";

const login = createFlow({
  provider: google({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Required, always sent |
| Token auth | `client_secret_post` |
| Default scopes | `openid`, `email`, `profile` |
| Profile | ID token claims, else `https://openidconnect.googleapis.com/v1/userinfo` |
| ID token | Verified |
| Revocation | Supported |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token | `https://oauth2.googleapis.com/token` |
| Revocation | `https://oauth2.googleapis.com/revoke` |
| Issuer | `https://accounts.google.com` |
| JWKS | `https://www.googleapis.com/oauth2/v3/certs` |
| Userinfo | `https://openidconnect.googleapis.com/v1/userinfo` |

## Notes

- A refresh token requires `offlineAccess: true`, which sets both `access_type=offline` and `prompt=consent`.
- The verified ID token already carries the profile, so a login makes no extra HTTP request.
- Granular consent lets users decline individual scopes; check `profile.grantedScopes`.
- Use `hostedDomain` to restrict sign-in to one Workspace domain, and verify `raw.hd` too.

<sub>Generated from the provider definition. Do not edit.</sub>
