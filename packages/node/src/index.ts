import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * The Node adapter.
 *
 * oathly's core speaks Web `Request`/`Response`, which every modern runtime and
 * framework already understands. Express and Fastify predate that, so this is
 * the translation layer — and the only framework-specific code in the project.
 */

export interface ToWebRequestOptions {
  /**
   * Origin to resolve the request URL against. Inferred from the `Host` header
   * and connection when omitted.
   *
   * Set it explicitly behind a proxy that does not send `x-forwarded-proto`:
   * getting the scheme wrong makes oathly drop `Secure` from its cookies.
   */
  origin?: string;
}

/** Convert a Node request into a Web `Request`, body included. */
export async function toWebRequest(
  req: IncomingMessage,
  options: ToWebRequestOptions = {},
): Promise<Request> {
  const origin = options.origin ?? inferOrigin(req);
  const url = new URL(req.url ?? "/", origin);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
    else headers.set(name, value);
  }

  const method = req.method ?? "GET";
  // GET and HEAD cannot carry a body; anything else might (Apple form-posts).
  const body =
    method === "GET" || method === "HEAD" ? null : await readBody(req);

  return new Request(url, {
    method,
    headers,
    // Uint8Array is a valid BodyInit at runtime; the DOM lib's generic
    // ArrayBufferLike typing does not line up with it.
    ...(body !== null ? { body: body as unknown as BodyInit } : {}),
  });
}

/** Write a Web `Response` out through a Node response. */
export async function applyResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  // getSetCookie keeps multiple Set-Cookie headers separate; Headers.get would
  // fold them into one comma-joined value that browsers mis-parse.
  const cookies = response.headers.getSetCookie();
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of response.headers) {
    if (name.toLowerCase() === "set-cookie") continue;
    headers[name] = value;
  }
  if (cookies.length > 0) headers["set-cookie"] = cookies;

  res.writeHead(response.status, headers);

  if (response.body) {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      res.write(chunk);
    }
  }
  res.end();
}

/**
 * Wrap a Web-standard handler as an Express/Connect middleware.
 *
 * ```ts
 * app.get("/auth/login", createNodeHandler((request) => login.start(request)));
 * ```
 */
export function createNodeHandler(
  handler: (request: Request) => Response | Promise<Response>,
  options: ToWebRequestOptions = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const response = await handler(await toWebRequest(req, options));
    await applyResponse(res, response);
  };
}

function inferOrigin(req: IncomingMessage): string {
  const forwardedProto = firstValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = firstValue(req.headers["x-forwarded-host"]);
  const encrypted = Boolean(
    (req.socket as { encrypted?: boolean } | undefined)?.encrypted,
  );

  const protocol = forwardedProto ?? (encrypted ? "https" : "http");
  const host = forwardedHost ?? req.headers.host ?? "localhost";
  return `${protocol}://${host}`;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  // "https,http" from a chain of proxies — the client-facing one is first.
  return raw?.split(",")[0]?.trim();
}

async function readBody(req: IncomingMessage): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  }
  if (chunks.length === 0) return null;

  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
