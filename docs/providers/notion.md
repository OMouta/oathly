# Notion

Register an app: <https://www.notion.so/my-integrations>

```ts
import { createFlow, notion } from "oathly";

const login = createFlow({
  provider: notion({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Unverified — never use for account lookup |
| PKCE | Not supported by the provider |
| Token auth | `client_secret_basic` |
| Default scopes | none |
| Profile | Custom request, see notes |
| ID token | Not used |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://api.notion.com/v1/oauth/authorize` |
| Token | `https://api.notion.com/v1/oauth/token` |

## Notes

- The token endpoint requires a JSON body and HTTP Basic auth.
- There is no userinfo endpoint; the user is embedded in the token response.
- Notion tokens do not expire and there is no refresh token.
- Notion asserts nothing about email verification, so `emailVerified` is false.

<sub>Generated from the provider definition. Do not edit.</sub>
