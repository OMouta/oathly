import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { createMockAuthServer } from "@oathly/testing";
import { createFlow } from "oathly";
import { afterEach, describe, expect, it } from "vitest";
import { applyResponse, createNodeHandler, toWebRequest } from "../src/index.js";

let running: Server | null = null;

afterEach(async () => {
  if (running) {
    await new Promise<void>((resolve) => running!.close(() => resolve()));
    running = null;
  }
});

/** Start a throwaway http server and return its base URL. */
async function serve(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  const server = createServer(handler);
  running = server;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("toWebRequest", () => {
  it("reconstructs the URL, method, and headers", async () => {
    let captured: Request | undefined;
    const base = await serve(async (req, res) => {
      captured = await toWebRequest(req);
      res.end("ok");
    });

    await fetch(`${base}/auth/callback?code=abc&state=xyz`, {
      headers: { cookie: "oathly.mock=value" },
    });

    expect(captured?.method).toBe("GET");
    const url = new URL(captured!.url);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("code")).toBe("abc");
    expect(captured?.headers.get("cookie")).toBe("oathly.mock=value");
  });

  it("carries a form-encoded body through, the way Apple posts callbacks", async () => {
    let form: Record<string, string> = {};
    const base = await serve(async (req, res) => {
      const request = await toWebRequest(req);
      form = Object.fromEntries(await request.formData()) as Record<string, string>;
      res.end("ok");
    });

    await fetch(`${base}/auth/callback`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: "the-code", state: "the-state" }).toString(),
    });

    expect(form).toEqual({ code: "the-code", state: "the-state" });
  });

  it("honours x-forwarded-proto so cookies stay Secure behind a proxy", async () => {
    let origin = "";
    const base = await serve(async (req, res) => {
      origin = new URL((await toWebRequest(req)).url).protocol;
      res.end("ok");
    });

    await fetch(`${base}/`, { headers: { "x-forwarded-proto": "https" } });

    expect(origin).toBe("https:");
  });
});

describe("applyResponse", () => {
  it("keeps multiple Set-Cookie headers separate", async () => {
    const base = await serve(async (_req, res) => {
      const headers = new Headers();
      headers.append("set-cookie", "a=1; Path=/");
      headers.append("set-cookie", "b=2; Path=/");
      headers.set("x-custom", "yes");
      await applyResponse(res, new Response(null, { status: 204, headers }));
    });

    const response = await fetch(`${base}/`);

    expect(response.status).toBe(204);
    expect(response.headers.get("x-custom")).toBe("yes");
    // Folding these into one comma-joined header is a classic adapter bug.
    expect(response.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });

  it("does not follow the redirect itself", async () => {
    const base = await serve(async (_req, res) => {
      await applyResponse(
        res,
        new Response(null, { status: 302, headers: { location: "https://provider.test" } }),
      );
    });

    const response = await fetch(`${base}/`, { redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://provider.test");
  });
});

describe("createNodeHandler", () => {
  it("runs a full login through a plain Node server", async () => {
    // Bind first so the mock IdP can be told the real callback URL.
    const server = createServer();
    running = server;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    const idp = await createMockAuthServer({
      redirectURI: `${base}/auth/callback`,
    });
    const flow = createFlow({ provider: idp.provider });

    const start = createNodeHandler((request) => flow.start(request));
    const callback = createNodeHandler(async (request) => {
      const { profile, headers } = await flow.callback(request);
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(profile), { headers });
    });

    server.on("request", (req, res) => {
      if (req.url?.startsWith("/auth/login")) void start(req, res);
      else void callback(req, res);
    });

    const redirect = await fetch(`${base}/auth/login`, { redirect: "manual" });
    expect(redirect.status).toBe(302);

    const cookie = redirect.headers
      .getSetCookie()
      .map((entry) => entry.split(";")[0])
      .join("; ");
    const callbackUrl = idp.authorize(redirect.headers.get("location")!);

    const result = await fetch(callbackUrl, { headers: { cookie } });
    const profile = (await result.json()) as { id: string; email: string };

    expect(profile.id).toBe("mock-user-1");
    expect(profile.email).toBe("ada@oathly.test");
  });
});
