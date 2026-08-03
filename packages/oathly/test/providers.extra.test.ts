import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "../src/crypto.js";
import { fetchProfile } from "../src/profile.js";
import { exchangeCode } from "../src/protocol.js";
import { OAuthTokens } from "../src/tokens.js";
import { bitbucket } from "../src/providers/bitbucket.js";
import { dropbox } from "../src/providers/dropbox.js";
import { facebook } from "../src/providers/facebook.js";
import { notion } from "../src/providers/notion.js";
import { reddit } from "../src/providers/reddit.js";
import { twitch } from "../src/providers/twitch.js";
import { twitter } from "../src/providers/twitter.js";
import { json, mockFetch } from "./helpers.js";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectURI: "https://app.test/callback",
};

function tokens(scopes: string[] = [], raw: Record<string, unknown> = {}): OAuthTokens {
  return new OAuthTokens({
    accessToken: "at",
    tokenType: "Bearer",
    refreshToken: null,
    idToken: null,
    expiresAt: null,
    scopes,
    raw,
  });
}

describe("twitch", () => {
  it("sends the Client-Id header Helix requires and unwraps the data array", async () => {
    const mock = mockFetch({
      "api.twitch.tv/helix/users": () =>
        json({
          data: [
            {
              id: "141981764",
              login: "twitchdev",
              display_name: "TwitchDev",
              email: "dev@test.tv",
              profile_image_url: "https://cdn.test/avatar.png",
            },
          ],
        }),
    });

    const profile = await fetchProfile(
      twitch({ ...credentials, fetch: mock.fetch }),
      tokens(["user:read:email"]),
    );

    expect(mock.find("helix/users")?.headers["client-id"]).toBe("client-id");
    expect(profile.id).toBe("141981764");
    expect(profile.username).toBe("twitchdev");
    expect(profile.name).toBe("TwitchDev");
    expect(profile.emailVerified).toBe(true);
  });
});

describe("twitter", () => {
  it("unwraps data and never claims an email", async () => {
    const mock = mockFetch({
      "api.x.com/2/users/me": () =>
        json({
          data: {
            id: "2244994945",
            name: "X Dev",
            username: "XDevelopers",
            profile_image_url: "https://pbs.test/a_normal.jpg",
          },
        }),
    });

    const profile = await fetchProfile(
      twitter({ ...credentials, fetch: mock.fetch }),
      tokens(["users.read"]),
    );

    expect(profile.id).toBe("2244994945");
    expect(profile.username).toBe("XDevelopers");
    // The v2 API exposes no address under any scope.
    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
    expect(profile.avatarUrl).toBe("https://pbs.test/a.jpg");
  });
});

describe("reddit", () => {
  const provider = (fetchImpl: ReturnType<typeof mockFetch>["fetch"]) =>
    reddit({ ...credentials, fetch: fetchImpl, userAgent: "web:oathly:1.0 (by /u/test)" });

  it("sends the required User-Agent", async () => {
    const mock = mockFetch({
      "oauth.reddit.com/api/v1/me": () => json({ id: "abc", name: "spez" }),
    });

    await fetchProfile(provider(mock.fetch), tokens(["identity"]));

    expect(mock.find("/api/v1/me")?.headers["user-agent"]).toBe(
      "web:oathly:1.0 (by /u/test)",
    );
  });

  it("unescapes the HTML-encoded avatar URL", async () => {
    const mock = mockFetch({
      "oauth.reddit.com/api/v1/me": () =>
        json({
          id: "abc",
          name: "spez",
          icon_img: "https://styles.test/avatar.png?width=256&amp;height=256",
        }),
    });

    const profile = await fetchProfile(provider(mock.fetch), tokens(["identity"]));
    expect(profile.avatarUrl).toBe("https://styles.test/avatar.png?width=256&height=256");
  });

  it("asks for a permanent grant only when a refresh token is wanted", async () => {
    const withRefresh = reddit({
      ...credentials,
      userAgent: "ua",
      permanent: true,
    });
    expect(withRefresh.authorizationParams?.["duration"]).toBe("permanent");
    expect(reddit({ ...credentials, userAgent: "ua" }).authorizationParams).toBeUndefined();
  });
});

describe("facebook", () => {
  it("signs Graph requests with appsecret_proof", async () => {
    const mock = mockFetch({
      "graph.facebook.com": () => json({ id: "10101", name: "Zuck" }),
    });

    await fetchProfile(facebook({ ...credentials, fetch: mock.fetch }), tokens());

    const url = new URL(mock.find("/me")!.url);
    // Proves a stolen token cannot be replayed away from your server.
    expect(url.searchParams.get("appsecret_proof")).toBe(
      await hmacSha256Hex("client-secret", "at"),
    );
  });

  it("never reports an email as verified", async () => {
    const mock = mockFetch({
      "graph.facebook.com": () => json({ id: "1", email: "someone@test.dev" }),
    });

    const profile = await fetchProfile(
      facebook({ ...credentials, fetch: mock.fetch }),
      tokens(),
    );
    expect(profile.email).toBe("someone@test.dev");
    expect(profile.emailVerified).toBe(false);
  });
});

describe("notion", () => {
  it("sends a JSON token body and reads the user out of the token response", async () => {
    const tokenBody = {
      access_token: "secret_at",
      workspace_id: "ws-1",
      owner: {
        type: "user",
        user: {
          id: "user-1",
          name: "Ada",
          avatar_url: "https://notion.test/ada.png",
          person: { email: "ada@test.dev" },
        },
      },
    };

    const mock = mockFetch({
      "api.notion.com/v1/oauth/token": () => json(tokenBody),
    });

    const provider = notion({ ...credentials, fetch: mock.fetch });
    const issued = await exchangeCode(provider, { code: "c" });

    const sent = mock.find("/oauth/token")!;
    expect(sent.headers["content-type"]).toBe("application/json");
    expect(sent.headers["notion-version"]).toBe("2022-06-28");
    expect(sent.headers["authorization"]).toMatch(/^Basic /);

    const profile = await fetchProfile(provider, issued);
    expect(profile.id).toBe("user-1");
    expect(profile.name).toBe("Ada");
    expect(profile.email).toBe("ada@test.dev");
    // Notion asserts nothing about verification.
    expect(profile.emailVerified).toBe(false);
    // No second request was needed.
    expect(mock.requests).toHaveLength(1);
  });
});

describe("bitbucket", () => {
  it("resolves the confirmed primary address from the second endpoint", async () => {
    const mock = mockFetch({
      "api.bitbucket.org/2.0/user/emails": () =>
        json({
          values: [
            { email: "alt@test.dev", is_primary: false, is_confirmed: true },
            { email: "primary@test.dev", is_primary: true, is_confirmed: true },
          ],
        }),
      "api.bitbucket.org/2.0/user": () =>
        json({
          uuid: "{uuid}",
          account_id: "acct-1",
          username: "ada",
          display_name: "Ada L",
          links: { avatar: { href: "https://bb.test/ada.png" } },
        }),
    });

    const profile = await fetchProfile(
      bitbucket({ ...credentials, fetch: mock.fetch }),
      tokens(["account", "email"]),
    );

    expect(profile.id).toBe("acct-1");
    expect(profile.email).toBe("primary@test.dev");
    expect(profile.emailVerified).toBe(true);
  });

  it("skips the email call without the scope and reports no address", async () => {
    const mock = mockFetch({
      "api.bitbucket.org/2.0/user": () =>
        json({ uuid: "{u}", account_id: "acct-1", username: "ada", display_name: null }),
    });

    const profile = await fetchProfile(
      bitbucket({ ...credentials, fetch: mock.fetch }),
      tokens(["account"]),
    );

    expect(mock.find("/user/emails")).toBeUndefined();
    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });
});

describe("dropbox", () => {
  it("POSTs to the RPC-style account endpoint", async () => {
    const mock = mockFetch({
      "users/get_current_account": () =>
        json({
          account_id: "dbid:1",
          name: { display_name: "Ada L" },
          email: "ada@test.dev",
          email_verified: true,
          profile_photo_url: "https://db.test/ada.jpg",
        }),
    });

    const profile = await fetchProfile(
      dropbox({ ...credentials, fetch: mock.fetch }),
      tokens(),
    );

    expect(mock.find("get_current_account")?.method).toBe("POST");
    expect(profile.id).toBe("dbid:1");
    expect(profile.emailVerified).toBe(true);
  });

  it("asks for offline access only when a refresh token is wanted", () => {
    expect(
      dropbox({ ...credentials, offlineAccess: true }).authorizationParams,
    ).toEqual({ token_access_type: "offline" });
    expect(dropbox(credentials).authorizationParams).toBeUndefined();
  });
});
