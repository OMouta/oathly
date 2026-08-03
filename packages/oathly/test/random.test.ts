import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../src/random.js";

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B test vector", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    await expect(createCodeChallenge(verifier)).resolves.toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("generates verifiers within the length the spec allows", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("does not repeat", () => {
    const values = new Set(Array.from({ length: 500 }, () => generateState()));
    expect(values.size).toBe(500);
  });
});

describe("constantTimeEqual", () => {
  it("compares equal strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });

  it("rejects different strings of the same length", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });

  it("rejects strings of different lengths without throwing", () => {
    expect(constantTimeEqual("abc", "abcdef")).toBe(false);
    expect(constantTimeEqual("", "a")).toBe(false);
  });
});
