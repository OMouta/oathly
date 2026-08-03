// Protocol — Layer 1. Stateless, no storage, no framework.
export {
  createAuthorizationURL,
  exchangeCode,
  refreshTokens,
  revokeToken,
} from "./protocol.js";
export { OAuthTokens } from "./tokens.js";
export { verifyIdToken, canVerifyIdToken } from "./idtoken.js";
export { fetchProfile, accountKey } from "./profile.js";

// Flow — Layer 2. Request in, Response out. State, PKCE, and nonce handled.
export { createFlow } from "./flow.js";
export type { Flow, FlowOptions, CallbackResult } from "./flow.js";

// Storage — Layer 3. Cookies by default, anything else if you need it.
export { createCookieStore, parseCookies, serializeCookie } from "./cookies.js";
export type { FlowStore, CookieOptions } from "./cookies.js";

// Building your own provider.
export { defineProvider, createProvider } from "./define.js";
export { discover } from "./discovery.js";
export type { DiscoverOptions, StandardClaims } from "./discovery.js";

// Primitives, exposed because sometimes you need to drive the flow by hand.
export {
  generateState,
  generateNonce,
  generateCodeVerifier,
  createCodeChallenge,
  constantTimeEqual,
} from "./random.js";

export {
  OAuthError,
  OAuthCallbackError,
  OAuthTokenError,
  OAuthNetworkError,
  OAuthProtocolError,
  OAuthProfileError,
  OAuthScopeError,
  OAuthConfigError,
} from "./errors.js";

export type {
  AuthorizationOptions,
  AuthorizationRequest,
  FetchLike,
  MappedProfile,
  PkceSupport,
  Profile,
  ProfileContext,
  ProfileSpec,
  Provider,
  ProviderCredentials,
  ProviderDefinition,
  ProviderMeta,
  TokenAuthMethod,
} from "./types.js";

// Providers.
export { apple } from "./providers/apple.js";
export type { AppleClaims, AppleOptions } from "./providers/apple.js";
export { bitbucket } from "./providers/bitbucket.js";
export type {
  BitbucketEmail,
  BitbucketRaw,
  BitbucketUser,
} from "./providers/bitbucket.js";
export { discord } from "./providers/discord.js";
export type { DiscordUser } from "./providers/discord.js";
export { dropbox } from "./providers/dropbox.js";
export type { DropboxOptions, DropboxUser } from "./providers/dropbox.js";
export { facebook } from "./providers/facebook.js";
export type { FacebookOptions, FacebookUser } from "./providers/facebook.js";
export { github } from "./providers/github.js";
export type { GitHubEmail, GitHubRaw, GitHubUser } from "./providers/github.js";
export { gitlab } from "./providers/gitlab.js";
export type { GitLabOptions, GitLabUser } from "./providers/gitlab.js";
export { google } from "./providers/google.js";
export type { GoogleClaims, GoogleOptions } from "./providers/google.js";
export { linkedin } from "./providers/linkedin.js";
export type { LinkedInClaims } from "./providers/linkedin.js";
export { microsoft } from "./providers/microsoft.js";
export type { MicrosoftOptions, MicrosoftUser } from "./providers/microsoft.js";
export { notion } from "./providers/notion.js";
export type { NotionTokenResponse } from "./providers/notion.js";
export { reddit } from "./providers/reddit.js";
export type { RedditOptions, RedditUser } from "./providers/reddit.js";
export { slack } from "./providers/slack.js";
export type { SlackClaims } from "./providers/slack.js";
export { spotify } from "./providers/spotify.js";
export type { SpotifyUser } from "./providers/spotify.js";
export { twitch } from "./providers/twitch.js";
export type { TwitchUser } from "./providers/twitch.js";
export { twitter, x } from "./providers/twitter.js";
export type { TwitterUser } from "./providers/twitter.js";
