/**
 * Arctic's token wrapper.
 *
 * Accessors are methods that throw when a value is absent, which is why
 * `hasRefreshToken()` exists. oathly returns `null` instead — but changing that
 * here would break the code this package exists to keep working.
 */
export class OAuth2Tokens {
  readonly data: Record<string, unknown>;

  constructor(data: Record<string, unknown>) {
    this.data = data;
  }

  tokenType(): string {
    return this.required("token_type");
  }

  accessToken(): string {
    return this.required("access_token");
  }

  accessTokenExpiresInSeconds(): number {
    const value = this.data["expires_in"];
    if (typeof value !== "number") {
      throw new Error("Missing or invalid field 'expires_in'");
    }
    return value;
  }

  accessTokenExpiresAt(): Date {
    return new Date(Date.now() + this.accessTokenExpiresInSeconds() * 1000);
  }

  hasRefreshToken(): boolean {
    return typeof this.data["refresh_token"] === "string";
  }

  refreshToken(): string {
    return this.required("refresh_token");
  }

  hasScopes(): boolean {
    return typeof this.data["scope"] === "string";
  }

  scopes(): string[] {
    return this.required("scope").split(" ");
  }

  idToken(): string {
    return this.required("id_token");
  }

  private required(field: string): string {
    const value = this.data[field];
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid field '${field}'`);
    }
    return value;
  }
}
