export interface CookieOptions {
  path: string;
  maxAge: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: "Lax" | "None" | "Strict";
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function parseCookies(header: string | null): Map<string, string> {
  const jar = new Map<string, string>();
  if (!header) return jar;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index < 1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (name !== "") jar.set(name, value);
  }
  return jar;
}

/**
 * Where in-flight state lives between the redirect out and the callback back.
 *
 * The default is a cookie, but anything implementing this works — KV for
 * serverless, or an in-memory map for native app deep links.
 */
export interface FlowStore {
  /** Returns headers to merge into the redirect response. */
  set(key: string, value: string): Promise<Headers> | Headers;
  get(key: string, request: Request): Promise<string | null> | string | null;
  /** Returns headers to merge into your callback response. */
  clear(key: string): Promise<Headers> | Headers;
}

/**
 * The default store.
 *
 * The cookie is not signed, deliberately. State is defended by comparing it to
 * the query parameter — a signature adds nothing, since an attacker who can
 * mint cookies would simply use a signed pair from their own flow. What does
 * help is the `__Host-` prefix, which stops a subdomain from tossing a cookie
 * onto the parent, so it is used automatically whenever the connection is secure.
 */
export function createCookieStore(options: {
  secure: boolean;
  path?: string;
  maxAge?: number;
  sameSite?: "Lax" | "None";
}): FlowStore {
  const path = options.path ?? "/";
  // __Host- requires Secure, Path=/, and no Domain.
  const usePrefix = options.secure && path === "/";
  const cookieOptions: CookieOptions = {
    path,
    // Long enough for a slow consent screen, short enough to be forgettable.
    maxAge: options.maxAge ?? 600,
    secure: options.secure,
    httpOnly: true,
    // Lax survives the provider's top-level redirect back. Strict does not.
    sameSite: options.sameSite ?? "Lax",
  };

  const nameFor = (key: string) => (usePrefix ? `__Host-${key}` : key);

  return {
    set(key, value) {
      const headers = new Headers();
      headers.append("set-cookie", serializeCookie(nameFor(key), value, cookieOptions));
      return headers;
    },
    get(key, request) {
      return parseCookies(request.headers.get("cookie")).get(nameFor(key)) ?? null;
    },
    clear(key) {
      const headers = new Headers();
      headers.append(
        "set-cookie",
        serializeCookie(nameFor(key), "", { ...cookieOptions, maxAge: 0 }),
      );
      return headers;
    },
  };
}
