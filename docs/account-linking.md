# Account linking

Read this before writing `findUserByEmail(profile.email)`.

## The rule

Store `(provider, id)`. Look up by `(provider, id)`. Never look up by email unless
`emailVerified` is `true`.

```ts
import { accountKey } from "oathly";

const { profile } = await login.callback(request);
const key = accountKey(profile, "github"); // "github:4242"
```

`profile.id` is always the provider's stable identifier. Usernames are not: GitHub logins can be
renamed and reused, and Discord usernames became changeable in 2023. Keying on one hands the
account to whoever claims the freed handle.

## Which providers verify email

| Asserts verification | Does not |
| --- | --- |
| GitHub, Google, Discord, Apple, LinkedIn, Slack, Twitch, GitLab, Bitbucket, Dropbox | Facebook, Spotify, Microsoft (personal), Notion |
| | X and Reddit return no address at all |

Spotify documents its addresses as unverified — anyone can sign up with anyone's email. An app that
logs people in by matching that address is takeover-able with no exploit required.

## Linking to an existing account

**1. Link while already signed in.** Safest: the session proves identity, the provider does not.

```ts
const session = await getSession(request);
if (!session) return redirect("/login");

const { profile } = await link.callback(request);
await db.linkAccount(session.userId, accountKey(profile, "github"));
```

**2. Auto-link on a verified address.** Only where the provider asserts verification.

```ts
if (profile.emailVerified && profile.email) {
  const existing = await db.findUserByEmail(profile.email);
  if (existing) return linkAndSignIn(existing, profile);
}
```

**3. Verify it yourself.** For unverified providers, send your own confirmation email. Treat the
provider's address as a form prefill, not proof.

## Provider specifics

- A user may have several accounts at one provider — model links as a separate table.
- Never merge on name or username; neither is unique or stable.
- Apple private relay addresses are per-app and stop delivering if forwarding is disabled.
- Microsoft's `sub` is pairwise per app registration, so oathly uses the Graph object id.
- Slack's `sub` is per workspace; the same person in two workspaces is two identities.
- Unlinking is a security operation. Require re-authentication.

## Guarantees

- `emailVerified` is `true` only on an explicit provider assertion.
- `emailVerified` is `false` whenever `email` is `null`.
- `id` is always the provider's stable identifier.
- Empty strings normalize to `null`.
