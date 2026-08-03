import { describe, expect, it } from "vitest";
import { accountKey, fetchProfile } from "../src/profile.js";
import { OAuthTokens } from "../src/tokens.js";
import { discord } from "../src/providers/discord.js";
import { github } from "../src/providers/github.js";
import { spotify } from "../src/providers/spotify.js";
import type { FetchLike } from "../src/types.js";
import { json, mockFetch } from "./helpers.js";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectURI: "https://app.test/callback",
};

function tokensWith(scopes: string[], fetchImpl?: FetchLike): OAuthTokens {
  void fetchImpl;
  return new OAuthTokens({
    accessToken: "at",
    tokenType: "Bearer",
    refreshToken: null,
    idToken: null,
    expiresAt: null,
    scopes,
    raw: {},
  });
}

describe("github", () => {
  it("resolves the verified primary address from /user/emails", async () => {
    const mock = mockFetch({
      "api.github.com/user/emails": () =>
        json([
          { email: "unverified@test.dev", primary: false, verified: false, visibility: null },
          { email: "primary@test.dev", primary: true, verified: true, visibility: null },
        ]),
      "api.github.com/user": () =>
        json({ id: 1, login: "octocat", name: null, email: "public@test.dev", avatar_url: "https://a.test/1" }),
    });

    const profile = await fetchProfile(
      github({ ...credentials, fetch: mock.fetch }),
      tokensWith(["read:user", "user:email"]),
    );

    expect(profile.email).toBe("primary@test.dev");
    expect(profile.emailVerified).toBe(true);
    expect(profile.raw.emails).toHaveLength(2);
  });

  it("does not claim verification from the public profile email alone", async () => {
    // Without `user:email` there is no way to know the address is verified, so
    // the public one is reported as unverified rather than optimistically trusted.
    const mock = mockFetch({
      "api.github.com/user": () =>
        json({ id: 1, login: "octocat", name: null, email: "public@test.dev", avatar_url: "https://a.test/1" }),
    });

    const profile = await fetchProfile(
      github({ ...credentials, fetch: mock.fetch }),
      tokensWith(["read:user"]),
    );

    expect(profile.email).toBe("public@test.dev");
    expect(profile.emailVerified).toBe(false);
    expect(mock.find("/user/emails")).toBeUndefined();
  });

  it("keys on the numeric id, never the renameable login", async () => {
    const mock = mockFetch({
      "api.github.com/user": () =>
        json({ id: 987, login: "renamed-later", name: null, email: null, avatar_url: "" }),
    });

    const profile = await fetchProfile(
      github({ ...credentials, fetch: mock.fetch }),
      tokensWith(["read:user"]),
    );

    expect(profile.id).toBe("987");
    expect(accountKey(profile, "github")).toBe("github:987");
  });
});

describe("discord", () => {
  const user = {
    id: "80351110224678912",
    username: "nelly",
    global_name: "Nelly",
    discriminator: "0",
    avatar: "8342729096ea3675442027381ff50dfe",
    email: "nelly@test.dev",
    verified: true,
  };

  async function profileFor(overrides: Record<string, unknown>) {
    const mock = mockFetch({
      "discord.com/api/users/@me": () => json({ ...user, ...overrides }),
    });
    return fetchProfile(
      discord({ ...credentials, fetch: mock.fetch }),
      tokensWith(["identify", "email"]),
    );
  }

  it("assembles the CDN avatar URL from the hash", async () => {
    const profile = await profileFor({});
    expect(profile.avatarUrl).toBe(
      "https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png",
    );
  });

  it("uses the gif extension for animated avatars", async () => {
    const profile = await profileFor({ avatar: "a_8342729096ea3675442027381ff50dfe" });
    expect(profile.avatarUrl).toMatch(/\.gif$/);
  });

  it("falls back to the snowflake-derived default avatar", async () => {
    const profile = await profileFor({ avatar: null });
    expect(profile.avatarUrl).toMatch(
      /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/,
    );
  });

  it("prefers the display name but keeps the handle separate", async () => {
    const profile = await profileFor({});
    expect(profile.name).toBe("Nelly");
    expect(profile.username).toBe("nelly");
  });
});

describe("spotify", () => {
  it("never reports an email as verified, because Spotify does not verify them", async () => {
    const mock = mockFetch({
      "api.spotify.com/v1/me": () =>
        json({
          id: "wizzler",
          display_name: "Wizz",
          email: "anyone@test.dev",
          images: [{ url: "https://i.test/1", height: 300, width: 300 }],
        }),
    });

    const profile = await fetchProfile(
      spotify({ ...credentials, fetch: mock.fetch }),
      tokensWith(["user-read-email"]),
    );

    expect(profile.email).toBe("anyone@test.dev");
    // Trusting this for account lookup would be an account-takeover vector.
    expect(profile.emailVerified).toBe(false);
  });
});

describe("profile invariants", () => {
  it("cannot report a missing email as verified", async () => {
    const mock = mockFetch({
      "api.spotify.com/v1/me": () => json({ id: "x", display_name: null }),
    });

    const profile = await fetchProfile(
      spotify({ ...credentials, fetch: mock.fetch }),
      tokensWith([]),
    );

    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });

  it("normalizes empty strings to null so callers only check for null", async () => {
    const mock = mockFetch({
      "api.spotify.com/v1/me": () =>
        json({ id: "x", display_name: "   ", email: "", images: [] }),
    });

    const profile = await fetchProfile(
      spotify({ ...credentials, fetch: mock.fetch }),
      tokensWith([]),
    );

    expect(profile.name).toBeNull();
    expect(profile.email).toBeNull();
    expect(profile.avatarUrl).toBeNull();
  });
});
