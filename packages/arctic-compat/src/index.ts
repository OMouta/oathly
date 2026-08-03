/**
 * A drop-in replacement for the deprecated `arctic` package.
 *
 * ```diff
 * - import * as arctic from "arctic";
 * + import * as arctic from "@oathly/arctic-compat";
 * ```
 *
 * Everything else keeps working. This exists to make the migration a one-line
 * change; new code should use oathly's native API, which adds verified ID
 * tokens, normalized profiles, and state handling.
 *
 * Two behaviours are inherited from Arctic and deliberately not fixed here:
 * no `nonce` is sent on OIDC requests, and ID tokens are not verified. Use
 * `createFlow` from `oathly` for both.
 */

export { generateCodeVerifier, generateState } from "oathly";

export { OAuth2Tokens } from "./tokens.js";
export {
  ArcticFetchError,
  OAuth2RequestError,
  UnexpectedErrorResponseBodyError,
  UnexpectedResponseError,
} from "./errors.js";
export { OAuth2Client, PKCEOAuth2Client, PlainOAuth2Client } from "./client.js";

export {
  Apple,
  Bitbucket,
  Discord,
  Dropbox,
  Facebook,
  GitHub,
  GitLab,
  Google,
  LinkedIn,
  MicrosoftEntraId,
  Notion,
  Reddit,
  Slack,
  Spotify,
  Twitch,
  Twitter,
} from "./providers.js";
