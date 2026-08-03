import { defineConfig } from "vitepress";
import providers from "./providers.json" with { type: "json" };

export default defineConfig({
  title: "oathly",
  description:
    "OAuth 2.0 and OpenID Connect for any framework. Tokens and a verified identity; you own your sessions.",
  cleanUrls: true,
  lastUpdated: true,

  // The providers index doubles as the folder README on GitHub.
  rewrites: {
    "providers/README.md": "providers/index.md",
  },

  head: [
    ["link", { rel: "icon", href: "/favicon.png" }],
    ["meta", { name: "theme-color", content: "#FFA860" }],
    ["meta", { property: "og:title", content: "oathly" }],
    [
      "meta",
      {
        property: "og:description",
        content: "OAuth 2.0 and OpenID Connect for any framework.",
      },
    ],
    ["meta", { property: "og:image", content: "/logo.png" }],
  ],

  themeConfig: {
    // Transparent mark, so it sits on either background without a visible box.
    logo: "/logo-mark.png",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Providers", link: "/providers/" },
      { text: "Migrate", link: "/migrating-from-arctic" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Frameworks", link: "/guide/frameworks" },
          { text: "The flow", link: "/guide/flow" },
          { text: "Profiles", link: "/guide/profiles" },
          { text: "Errors", link: "/guide/errors" },
          { text: "Testing", link: "/guide/testing" },
          { text: "Low-level API", link: "/guide/low-level" },
        ],
      },
      {
        text: "Security",
        items: [{ text: "Account linking", link: "/account-linking" }],
      },
      {
        text: "Migration",
        items: [{ text: "Coming from Arctic", link: "/migrating-from-arctic" }],
      },
      {
        text: "Providers",
        collapsed: false,
        // Generated alongside the provider pages, so it cannot drift.
        items: [{ text: "Overview", link: "/providers/" }, ...providers],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/OMouta/oathly" }],

    search: { provider: "local" },

    editLink: {
      pattern: "https://github.com/OMouta/oathly/edit/main/docs/:path",
      text: "Edit this page",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 OMouta",
    },
  },
});
