import {
  apple,
  bitbucket,
  discord,
  dropbox,
  facebook,
  github,
  gitlab,
  google,
  linkedin,
  microsoft,
  notion,
  reddit,
  slack,
  spotify,
  twitch,
  twitter,
} from "oathly";
import { PKCEOAuth2Client, PlainOAuth2Client, requireRedirectURI } from "./client.js";

/**
 * Arctic's provider classes, reimplemented on oathly.
 *
 * Constructor argument order follows Arctic v3. Providers that support PKCE
 * take the code verifier as the second argument to `createAuthorizationURL`;
 * providers that do not take `(state, scopes)`.
 */

export class GitHub extends PlainOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string | null) {
    super(
      github({
        clientId,
        clientSecret,
        redirectURI: requireRedirectURI("GitHub", redirectURI),
      }),
    );
  }
}

export class Google extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(google({ clientId, clientSecret, redirectURI }));
  }
}

export class Discord extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(discord({ clientId, clientSecret, redirectURI }));
  }
}

export class Spotify extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(spotify({ clientId, clientSecret, redirectURI }));
  }
}

export class Twitch extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(twitch({ clientId, clientSecret, redirectURI }));
  }
}

export class GitLab extends PKCEOAuth2Client {
  constructor(
    baseURL: string,
    clientId: string,
    clientSecret: string,
    redirectURI: string,
  ) {
    super(gitlab({ baseUrl: baseURL, clientId, clientSecret, redirectURI }));
  }
}

export class Facebook extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(facebook({ clientId, clientSecret, redirectURI }));
  }
}

export class LinkedIn extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(linkedin({ clientId, clientSecret, redirectURI }));
  }
}

export class Reddit extends PKCEOAuth2Client {
  /**
   * Reddit blocks generic user agents. Arctic left that to the caller; oathly
   * requires one, so pass yours as the optional fourth argument.
   */
  constructor(
    clientId: string,
    clientSecret: string,
    redirectURI: string,
    userAgent = "web:oathly-arctic-compat:1.0",
  ) {
    super(reddit({ clientId, clientSecret, redirectURI, userAgent }));
  }
}

export class Twitter extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(twitter({ clientId, clientSecret, redirectURI }));
  }
}

export class Slack extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(slack({ clientId, clientSecret, redirectURI }));
  }
}

export class Dropbox extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(dropbox({ clientId, clientSecret, redirectURI }));
  }
}

export class Bitbucket extends PKCEOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(bitbucket({ clientId, clientSecret, redirectURI }));
  }
}

export class Notion extends PlainOAuth2Client {
  constructor(clientId: string, clientSecret: string, redirectURI: string) {
    super(notion({ clientId, clientSecret, redirectURI }));
  }
}

export class MicrosoftEntraId extends PKCEOAuth2Client {
  constructor(
    tenant: string,
    clientId: string,
    clientSecret: string,
    redirectURI: string,
  ) {
    super(microsoft({ tenant, clientId, clientSecret, redirectURI }));
  }
}

export class Apple extends PKCEOAuth2Client {
  constructor(
    clientId: string,
    teamId: string,
    keyId: string,
    pkcs8PrivateKey: string,
    redirectURI: string,
  ) {
    super(apple({ clientId, teamId, keyId, privateKey: pkcs8PrivateKey, redirectURI }));
  }
}
