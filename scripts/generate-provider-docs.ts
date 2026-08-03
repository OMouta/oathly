/**
 * Generate one documentation page per provider, straight from the provider
 * definitions.
 *
 * Generated docs cannot drift from the code, which is the failure mode that
 * made Arctic's provider list untrustworthy over time. Run with `--check` in
 * CI to fail when someone edits a definition without regenerating.
 *
 *   pnpm run docs:generate  # write
 *   pnpm run docs:check     # verify
 *
 * Always `pnpm run` these: bare `pnpm docs` hits pnpm's built-in command that
 * opens a package page in your browser, not this script.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "../packages/oathly/src/catalog.ts";
import type { Provider } from "../packages/oathly/src/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "docs", "providers");
const sidebarPath = join(root, "docs", ".vitepress", "providers.json");
const check = process.argv.includes("--check");

const TRUST_LABEL = {
  asserted: "Verified by the provider",
  unverified: "Unverified — never use for account lookup",
  none: "Not available",
} as const;

const GENERATED_NOTE =
  "<sub>Generated from the provider definition. Do not edit.</sub>";

function pkceLabel(provider: Provider): string {
  switch (provider.pkce) {
    case "required":
      return "Required, always sent";
    case "supported":
      return "Always sent";
    case "unsupported":
      return "Not supported by the provider";
  }
}

function profileSource(provider: Provider): string {
  const spec = provider.profile;
  if (!spec) return "None";
  if (spec.fetchRaw) return spec.endpoint ? `\`${spec.endpoint}\`` : "Custom request, see notes";
  if (spec.fromIdToken && spec.endpoint) return `ID token claims, else \`${spec.endpoint}\``;
  if (spec.fromIdToken) return "ID token claims";
  return `\`${spec.endpoint}\``;
}

function renderProvider(exportName: string, provider: Provider): string {
  const meta = provider.meta;
  const lines: string[] = [];

  lines.push(`# ${meta?.name ?? exportName}`, "");
  if (meta?.setupUrl) lines.push(`Register an app: <${meta.setupUrl}>`, "");

  lines.push(
    "```ts",
    `import { createFlow, ${exportName} } from "oathly";`,
    "",
    "const login = createFlow({",
    `  provider: ${exportName}({ clientId, clientSecret, redirectURI }),`,
    "});",
    "```",
    "",
  );

  lines.push("| | |");
  lines.push("| --- | --- |");
  lines.push(`| Email | ${TRUST_LABEL[meta?.emailTrust ?? "none"]} |`);
  lines.push(`| PKCE | ${pkceLabel(provider)} |`);
  lines.push(`| Token auth | \`${provider.tokenAuth}\` |`);
  lines.push(
    `| Default scopes | ${
      provider.defaultScopes.length > 0
        ? provider.defaultScopes.map((scope) => `\`${scope}\``).join(", ")
        : "none"
    } |`,
  );
  lines.push(`| Profile | ${profileSource(provider)} |`);
  lines.push(`| ID token | ${provider.issuer ? "Verified" : "Not used"} |`);
  lines.push(`| Revocation | ${provider.revocationEndpoint ? "Supported" : "—"} |`);
  lines.push("");

  lines.push("## Endpoints", "");
  lines.push("| | |");
  lines.push("| --- | --- |");
  lines.push(`| Authorization | \`${provider.authorizationEndpoint}\` |`);
  lines.push(`| Token | \`${provider.tokenEndpoint}\` |`);
  if (provider.revocationEndpoint) {
    lines.push(`| Revocation | \`${provider.revocationEndpoint}\` |`);
  }
  if (provider.issuer) lines.push(`| Issuer | \`${provider.issuer}\` |`);
  if (provider.jwksUri) lines.push(`| JWKS | \`${provider.jwksUri}\` |`);
  if (provider.profile?.endpoint) {
    lines.push(`| Userinfo | \`${provider.profile.endpoint}\` |`);
  }
  lines.push("");

  if (meta?.notes?.length) {
    lines.push("## Notes", "");
    for (const note of meta.notes) lines.push(`- ${note}`);
    lines.push("");
  }

  lines.push(GENERATED_NOTE, "");

  return lines.join("\n");
}

function renderIndex(entries: [string, Provider][]): string {
  const lines: string[] = [];

  lines.push("# Providers", "");
  lines.push(
    `${entries.length} providers. \`emailVerified\` is \`true\` only where the provider explicitly`,
    "asserts it — see [account linking](../account-linking.md).",
    "",
  );

  lines.push("| Provider | Email | PKCE | ID token |");
  lines.push("| --- | --- | --- | --- |");
  for (const [name, provider] of entries) {
    lines.push(
      `| [${provider.meta?.name ?? name}](./${provider.id}.md) | ${
        TRUST_LABEL[provider.meta?.emailTrust ?? "none"]
      } | ${provider.pkce} | ${provider.issuer ? "verified" : "—"} |`,
    );
  }
  lines.push("");

  lines.push("## Anything else", "");
  lines.push(
    "Any OpenID Connect provider works through discovery:",
    "",
    "```ts",
    'import { discover } from "oathly";',
    "",
    'const provider = await discover("https://id.example.com", {',
    "  clientId, clientSecret, redirectURI,",
    "});",
    "```",
    "",
  );
  lines.push(GENERATED_NOTE, "");

  return lines.join("\n");
}

const entries: [string, Provider][] = Object.entries(catalog)
  .map(([name, create]): [string, Provider] => [name, create()])
  .sort(([a], [b]) => a.localeCompare(b));

const files = new Map<string, string>([
  [join(outputDir, "README.md"), renderIndex(entries)],
  ...entries.map(
    ([name, provider]): [string, string] => [
      join(outputDir, `${provider.id}.md`),
      renderProvider(name, provider),
    ],
  ),
  // Docs-site sidebar, generated alongside the pages so the two cannot drift.
  [
    sidebarPath,
    `${JSON.stringify(
      entries.map(([name, provider]) => ({
        text: provider.meta?.name ?? name,
        link: `/providers/${provider.id}`,
      })),
      null,
      2,
    )}\n`,
  ],
]);

if (check) {
  const stale: string[] = [];
  for (const [path, contents] of files) {
    const existing = await readFile(path, "utf8").catch(() => null);
    if (existing !== contents) stale.push(path);
  }
  if (stale.length > 0) {
    console.error(
      `Provider docs are out of date:\n${stale.map((p) => `  - ${p}`).join("\n")}\n\nRun "pnpm run docs:generate" and commit the result.`,
    );
    process.exit(1);
  }
  console.log(`Provider docs are up to date (${files.size} files).`);
} else {
  for (const path of new Set([...files.keys()].map((file) => dirname(file)))) {
    await mkdir(path, { recursive: true });
  }
  for (const [path, contents] of files) await writeFile(path, contents, "utf8");
  console.log(`Wrote ${files.size} files.`);
}
