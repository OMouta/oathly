# Slack

Register an app: <https://api.slack.com/apps>

```ts
import { createFlow, slack } from "oathly";

const login = createFlow({
  provider: slack({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `openid`, `profile`, `email` |
| Profile | ID token claims, else `https://slack.com/api/openid.connect.userInfo` |
| ID token | Verified |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://slack.com/openid/connect/authorize` |
| Token | `https://slack.com/api/openid.connect.token` |
| Issuer | `https://slack.com` |
| JWKS | `https://slack.com/openid/connect/keys` |
| Userinfo | `https://slack.com/api/openid.connect.userInfo` |

## Notes

- This is Sign in with Slack (OIDC), not the bot-token OAuth flow.
- `sub` identifies a user within one workspace, not across workspaces.
- Slack answers errors with HTTP 200 and `{ ok: false, error }`; oathly detects it.

<sub>Generated from the provider definition. Do not edit.</sub>
