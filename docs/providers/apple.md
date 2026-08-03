# Apple

Register an app: <https://developer.apple.com/account/resources/identifiers/list/serviceId>

```ts
import { createFlow, apple } from "oathly";

const login = createFlow({
  provider: apple({ clientId, clientSecret, redirectURI }),
});
```

| | |
| --- | --- |
| Email | Verified by the provider |
| PKCE | Always sent |
| Token auth | `client_secret_post` |
| Default scopes | `name`, `email` |
| Profile | ID token claims |
| ID token | Verified |
| Revocation | — |

## Endpoints

| | |
| --- | --- |
| Authorization | `https://appleid.apple.com/auth/authorize` |
| Token | `https://appleid.apple.com/auth/token` |
| Issuer | `https://appleid.apple.com` |
| JWKS | `https://appleid.apple.com/auth/keys` |

## Notes

- The client secret is a short-lived ES256 JWT; oathly mints and re-mints it from your .p8 key.
- The callback is a form POST, which `flow.callback()` reads.
- The user's name arrives once, in the first callback only. Persist it then or lose it.
- Addresses may be `@privaterelay.appleid.com` and stop working if forwarding is disabled — never key on them.
- `email_verified` sometimes arrives as the string "true"; it is normalized.

<sub>Generated from the provider definition. Do not edit.</sub>
