import type { CallbackResult, Flow } from "oathly";
import type { MockAuthServer } from "./server.js";

/**
 * A minimal cookie jar — enough to carry oathly's in-flight state from the
 * redirect out to the callback back, the way a browser would.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  /** Absorb every `Set-Cookie` on a response, honouring `Max-Age=0` deletions. */
  absorb(response: Response): void {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(";");
      const index = pair?.indexOf("=") ?? -1;
      if (index < 1) continue;

      const name = pair!.slice(0, index);
      const value = pair!.slice(index + 1);
      const expired = attributes.some(
        (attribute) => attribute.trim().toLowerCase() === "max-age=0",
      );

      if (expired || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  /** The `Cookie` request header, or `""` when the jar is empty. */
  get header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  get size(): number {
    return this.cookies.size;
  }
}

export interface CompleteLoginOptions {
  /** The URL your login route lives at. Its scheme decides cookie security. */
  startUrl?: string;
  /** Scopes the simulated user grants. Defaults to everything requested. */
  grantedScopes?: string[];
  /** Reuse a jar across calls to test consecutive logins. */
  jar?: CookieJar;
}

/**
 * Drive a whole login end to end, in process: start → consent → callback.
 *
 * ```ts
 * const server = await createMockAuthServer();
 * const flow = createFlow({ provider: server.provider });
 * const { profile, tokens } = await completeLogin(flow, server);
 * ```
 */
export async function completeLogin<TRaw>(
  flow: Flow<TRaw>,
  server: MockAuthServer,
  options: CompleteLoginOptions = {},
): Promise<CallbackResult<TRaw>> {
  const jar = options.jar ?? new CookieJar();
  const startUrl = options.startUrl ?? "https://app.oathly.test/auth/login";

  const startResponse = await flow.start(new Request(startUrl));
  jar.absorb(startResponse);

  const location = startResponse.headers.get("location");
  if (!location) {
    throw new Error("mock login: flow.start() returned no Location header.");
  }

  const callbackUrl = server.authorize(location, {
    ...(options.grantedScopes ? { grantedScopes: options.grantedScopes } : {}),
  });

  const result = await flow.callback(
    new Request(callbackUrl, { headers: { cookie: jar.header } }),
  );
  // Keep the jar honest so a caller can assert the state cookie was cleared.
  jar.absorb(new Response(null, { headers: result.headers }));

  return result;
}
