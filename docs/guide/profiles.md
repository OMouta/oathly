# Profiles

Every provider returns the same shape.

```ts
interface Profile<Raw> {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  grantedScopes: string[];
  raw: Raw;
}
```

The core is deliberately small. Anything a provider offers beyond it lives on `raw`, fully typed, so
normalization is never a cage.

```ts
const { profile } = await login.callback(request);
profile.raw.login;       // GitHub-specific, typed
profile.raw.emails;      // the /user/emails result
```

## id

Always the provider's stable, immutable identifier — never an email, never a username.

GitHub logins can be renamed and the old one reused; Discord usernames became changeable in 2023.
Keying on either hands the account to whoever claims the freed handle.

```ts
import { accountKey } from "oathly";
accountKey(profile, "github"); // "github:4242"
```

Put a unique index on `(provider, provider_account_id)`.

## emailVerified

`true` only where the provider explicitly asserts it. Never inferred from "that provider probably
checks."

| Asserts verification | Does not |
| --- | --- |
| GitHub, Google, Discord, Apple, LinkedIn, Slack, Twitch, GitLab, Bitbucket, Dropbox | Facebook, Spotify, Microsoft (personal), Notion |

X and Reddit return no address at all.

Two invariants a provider mapping cannot opt out of:

- `emailVerified` is `false` whenever `email` is `null` — an absent address cannot be verified.
- Empty strings normalize to `null`, so `null` is the only "no value" check you need.

See [account linking](/account-linking).

## name and username

`name` is a display name. oathly never splits it into first and last, which is wrong for a large
share of the world's names; structured names live on `raw` where a provider supplies them.

`username` is populated only where the provider has a real handle. Google and Apple return `null`
rather than a handle invented from the email.

## Where the profile comes from

For OIDC providers, claims from the verified ID token are preferred over a userinfo round-trip — a
Google login completes with no extra HTTP request. Userinfo is called only when the ID token is
missing a field.

Some providers need more than one request; GitHub's verified primary address lives behind
`/user/emails`, and oathly fetches it when the scope allows.

To skip the profile entirely:

```ts
createFlow({ provider, profile: false });
```

Or fetch it later:

```ts
import { fetchProfile } from "oathly";
const profile = await fetchProfile(provider, tokens);
```
