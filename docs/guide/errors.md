# Errors

Every error extends `OAuthError`, carries a stable `code`, and never puts a secret in its message.

| Error | Means |
| --- | --- |
| `OAuthCallbackError` | The callback cannot be trusted or completed. |
| `OAuthTokenError` | The token endpoint returned a spec error response. |
| `OAuthNetworkError` | The request never completed. |
| `OAuthProtocolError` | The provider responded with something the spec does not allow. |
| `OAuthProfileError` | Tokens are valid but the profile fetch failed. |
| `OAuthScopeError` | A scope listed in `requireScopes` was not granted. |
| `OAuthConfigError` | A provider was configured wrongly. Always a bug in your code. |

## Cancelled logins are normal

```ts
import { OAuthCallbackError } from "oathly";

try {
  const { profile } = await login.callback(request);
} catch (error) {
  if (error instanceof OAuthCallbackError) {
    switch (error.code) {
      case "access_denied":
        return redirect("/login?cancelled=1");
      case "state_mismatch":
      case "missing_flow_state":
        // Expired, replayed, or cookies blocked. Send them round again.
        return redirect("/login?retry=1");
    }
  }
  throw error;
}
```

`OAuthCallbackError` codes: `access_denied`, `provider_error`, `missing_code`, `missing_state`,
`state_mismatch`, `missing_flow_state`.

## Token errors

```ts
if (error instanceof OAuthTokenError) {
  error.error;            // "invalid_grant" — the RFC 6749 code
  error.errorDescription; // provider text, or null
  error.status;
}
```

`invalid_grant` usually means the code was already used or expired. `invalid_client` usually means a
wrong client secret.

## Do not lose good tokens

`OAuthProfileError` carries the tokens, so a userinfo outage does not throw away a successful
exchange:

```ts
if (error instanceof OAuthProfileError) {
  await persist(error.tokens);
  return retryProfileLater();
}
```
