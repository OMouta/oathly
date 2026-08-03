---
layout: home

hero:
  name: oathly
  text: OAuth for any framework
  tagline: Tokens and a verified identity. You own your sessions.
  image:
    src: /logo-mark.png
    alt: oathly
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Providers
      link: /providers/
    - theme: alt
      text: GitHub
      link: https://github.com/OMouta/oathly

features:
  - title: Framework agnostic
    details: Request in, Response out. The same code on Hono, Next, SvelteKit, Remix, Nitro, Elysia, Bun, Deno, and Workers — no adapter packages.
  - title: One profile shape
    details: Every provider returns the same normalized user, with the untouched response typed on raw.
  - title: Secure by default
    details: PKCE wherever it is supported, state always, nonce on every OIDC request, and ID tokens that are actually verified.
  - title: Honest email verification
    details: emailVerified is true only where the provider asserts it. Never inferred, never guessed.
  - title: 16 providers
    details: Quirks handled for you — GitHub's second email call, Apple's rotating client secret, Facebook's appsecret_proof.
  - title: Testable
    details: An in-process authorization server runs a whole login with no network and no fixtures.
---
