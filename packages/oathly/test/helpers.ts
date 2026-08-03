import type { FetchLike } from "../src/types.js";

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: URLSearchParams | null;
}

export interface MockFetch {
  fetch: FetchLike;
  requests: RecordedRequest[];
  /** The last request made to a URL containing `fragment`. */
  find(fragment: string): RecordedRequest | undefined;
}

type Route = (request: RecordedRequest) => Response | Promise<Response>;

/**
 * A fetch stand-in that records what was sent. Routes are matched by substring,
 * longest first, so `/user/emails` wins over `/user`.
 */
export function mockFetch(routes: Record<string, Route>): MockFetch {
  const requests: RecordedRequest[] = [];
  const patterns = Object.keys(routes).sort((a, b) => b.length - a.length);

  const fetch: FetchLike = async (input, init) => {
    const url = input.toString();
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      (init?.headers as Record<string, string> | undefined) ?? {},
    )) {
      headers[key.toLowerCase()] = value;
    }

    const recorded: RecordedRequest = {
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? new URLSearchParams(init.body) : null,
    };
    requests.push(recorded);

    const pattern = patterns.find((candidate) => url.includes(candidate));
    if (!pattern) throw new Error(`mockFetch: no route for ${url}`);
    return routes[pattern]!(recorded);
  };

  return {
    fetch,
    requests,
    find: (fragment) => [...requests].reverse().find((r) => r.url.includes(fragment)),
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Pull a cookie value out of a response the way a browser would. */
export function readSetCookie(response: Response, name: string): string | null {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const index = pair?.indexOf("=") ?? -1;
    if (index > 0 && pair!.slice(0, index) === name) return pair!.slice(index + 1);
  }
  return null;
}

/** Turn a start() response into the cookie header the callback will see. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
