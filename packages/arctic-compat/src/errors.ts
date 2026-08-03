import {
  OAuthNetworkError,
  OAuthProtocolError,
  OAuthTokenError,
} from "oathly";

/** Arctic's error for an RFC 6749 error response from the token endpoint. */
export class OAuth2RequestError extends Error {
  readonly code: string;
  readonly description: string | null;
  readonly uri: string | null;
  readonly state: string | null;

  constructor(
    code: string,
    description: string | null,
    uri: string | null,
    state: string | null,
  ) {
    super(`OAuth request error: ${code}`);
    this.name = "OAuth2RequestError";
    this.code = code;
    this.description = description;
    this.uri = uri;
    this.state = state;
  }
}

/** Arctic's error for a request that never completed. */
export class ArcticFetchError extends Error {
  constructor(cause: unknown) {
    super("Failed to send request");
    this.name = "ArcticFetchError";
    this.cause = cause;
  }
}

/** Arctic's error for a response that does not conform to the spec. */
export class UnexpectedResponseError extends Error {
  readonly responseStatus: number;

  constructor(responseStatus: number) {
    super("Unexpected error response body");
    this.name = "UnexpectedResponseError";
    this.responseStatus = responseStatus;
  }
}

export class UnexpectedErrorResponseBodyError extends Error {
  readonly responseStatus: number;
  readonly data: unknown;

  constructor(responseStatus: number, data: unknown) {
    super("Unexpected error response body");
    this.name = "UnexpectedErrorResponseBodyError";
    this.responseStatus = responseStatus;
    this.data = data;
  }
}

/**
 * Translate an oathly error into the Arctic error a migrating codebase already
 * catches. Anything unrecognised is rethrown untouched.
 */
export function toArcticError(error: unknown): unknown {
  if (error instanceof OAuthTokenError) {
    return new OAuth2RequestError(
      error.error,
      error.errorDescription,
      error.errorUri,
      null,
    );
  }
  if (error instanceof OAuthNetworkError) {
    return new ArcticFetchError(error.cause);
  }
  if (error instanceof OAuthProtocolError) {
    return new UnexpectedResponseError(200);
  }
  return error;
}
