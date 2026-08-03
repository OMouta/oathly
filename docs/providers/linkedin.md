# LinkedIn

Register an app: <https://www.linkedin.com/developers/apps>

```ts
import { createFlow, linkedin } from "oathly";

const login = createFlow({
  provider: linkedin({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `openid`, `profile`, `email` |
| Profile | ID token claims, else `https://api.linkedin.com/v2/userinfo` |
| ID token | Verified |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://www.linkedin.com/oauth/v2/authorization` |
| Token | `https://www.linkedin.com/oauth/v2/accessToken` |
| Issuer | `https://www.linkedin.com/oauth` |
| JWKS | `https://www.linkedin.com/oauth/openid/jwks` |
| Userinfo | `https://api.linkedin.com/v2/userinfo` |

## Notes

- Requires the "Sign In with LinkedIn using OpenID Connect" product on the app.
- The legacy v2 profile and email endpoints are gone; this uses OIDC.
- LinkedIn has no public handle in the OIDC claims, so `username` is null.

<sub>Generated from the provider definition. Do not edit.</sub>
