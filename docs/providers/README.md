# Providers

16 providers. `emailVerified` is `true` only where the provider explicitly
asserts it — see [account linking](../account-linking.md).

| Provider | Email | PKCE | ID token |
| --- | --- | --- | --- |
| [Apple](./apple.md) | Verified by the provider | supported | verified |
| [Bitbucket](./bitbucket.md) | Verified by the provider | supported | — |
| [Discord](./discord.md) | Verified by the provider | supported | — |
| [Dropbox](./dropbox.md) | Verified by the provider | supported | — |
| [Facebook](./facebook.md) | Unverified — never use for account lookup | supported | — |
| [GitHub](./github.md) | Verified by the provider | unsupported | — |
| [GitLab](./gitlab.md) | Verified by the provider | required | verified |
| [Google](./google.md) | Verified by the provider | required | verified |
| [LinkedIn](./linkedin.md) | Verified by the provider | supported | verified |
| [Microsoft](./microsoft.md) | Unverified — never use for account lookup | required | — |
| [Notion](./notion.md) | Unverified — never use for account lookup | unsupported | — |
| [Reddit](./reddit.md) | Not available | supported | — |
| [Slack](./slack.md) | Verified by the provider | supported | verified |
| [Spotify](./spotify.md) | Unverified — never use for account lookup | supported | — |
| [Twitch](./twitch.md) | Verified by the provider | supported | verified |
| [X (Twitter)](./twitter.md) | Not available | required | — |

## Anything else

Any OpenID Connect provider works through discovery:

```ts
import { discover } from "oathly";

const provider = await discover("https://id.example.com", {
  clientId, clientSecret, redirectURI,
});
```

<sub>Generated from the provider definition. Do not edit.</sub>
