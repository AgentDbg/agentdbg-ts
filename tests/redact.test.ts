import { describe, it, expect } from "vitest";
import {
  keyMatchesRedact,
  truncateString,
  redactAndTruncate,
  normalizeUsage,
  buildErrorPayload,
} from "../src/redact.js";
import { REDACTED_MARKER, TRUNCATED_MARKER, DEPTH_LIMIT } from "../src/constants.js";

const baseConfig = {
  redact: true,
  redact_keys: ["api_key", "authorization", "cookie", "password", "secret", "token"],
  max_field_bytes: 20000,
};

describe("keyMatchesRedact", () => {
  it("matches case-insensitively", () => {
    expect(keyMatchesRedact("API_KEY", ["api_key"])).toBe(true);
    expect(keyMatchesRedact("api_key", ["API_KEY"])).toBe(true);
  });

  it("matches substring", () => {
    expect(keyMatchesRedact("x_api_key_id", ["api_key"])).toBe(true);
  });

  it("returns false for non-matching key", () => {
    expect(keyMatchesRedact("model", ["api_key", "secret"])).toBe(false);
  });
});

describe("truncateString", () => {
  it("returns string unchanged if within byte limit", () => {
    expect(truncateString("hello", 100)).toBe("hello");
  });

  it("truncates long string and appends marker", () => {
    const s = "a".repeat(200);
    const result = truncateString(s, 50);
    expect(result.endsWith(TRUNCATED_MARKER)).toBe(true);
    expect(Buffer.byteLength(result, "utf-8")).toBeLessThanOrEqual(50);
  });

  it("handles multi-byte characters", () => {
    const s = "\u{1F600}".repeat(50);
    const result = truncateString(s, 20);
    expect(result.endsWith(TRUNCATED_MARKER)).toBe(true);
  });

  it("returns string as-is when maxBytes is 0", () => {
    expect(truncateString("hello", 0)).toBe("hello");
  });
});

describe("redactAndTruncate", () => {
  it("passes through primitives", () => {
    expect(redactAndTruncate(null, baseConfig)).toBe(null);
    expect(redactAndTruncate(true, baseConfig)).toBe(true);
    expect(redactAndTruncate(42, baseConfig)).toBe(42);
    expect(redactAndTruncate("hello", baseConfig)).toBe("hello");
  });

  it("redacts matching dict keys", () => {
    const result = redactAndTruncate(
      { api_key: "sk-secret", model: "gpt-4" },
      baseConfig,
    );
    expect(result).toEqual({ api_key: REDACTED_MARKER, model: "gpt-4" });
  });

  it("redacts nested keys", () => {
    const result = redactAndTruncate(
      { config: { password: "12345", host: "localhost" } },
      baseConfig,
    );
    expect(result).toEqual({ config: { password: REDACTED_MARKER, host: "localhost" } });
  });

  it("skips redaction when redact=false", () => {
    const noRedact = { ...baseConfig, redact: false };
    const result = redactAndTruncate({ api_key: "sk-secret" }, noRedact);
    expect(result).toEqual({ api_key: "sk-secret" });
  });

  it("processes arrays recursively", () => {
    const result = redactAndTruncate(
      [{ api_key: "secret" }, "plain"],
      baseConfig,
    );
    expect(result).toEqual([{ api_key: REDACTED_MARKER }, "plain"]);
  });

  it("truncates deep nesting with TRUNCATED_MARKER", () => {
    let nested: unknown = "leaf";
    for (let i = 0; i < DEPTH_LIMIT + 2; i++) {
      nested = { child: nested };
    }
    const result = redactAndTruncate(nested, baseConfig);
    let current: unknown = result;
    let depth = 0;
    while (
      typeof current === "object" &&
      current !== null &&
      "child" in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>).child;
      depth++;
    }
    expect(current).toBe(TRUNCATED_MARKER);
  });

  it("truncates long strings", () => {
    const longStr = "x".repeat(30000);
    const config = { ...baseConfig, max_field_bytes: 100 };
    const result = redactAndTruncate(longStr, config);
    expect(typeof result).toBe("string");
    expect((result as string).endsWith(TRUNCATED_MARKER)).toBe(true);
  });
});

describe("normalizeUsage", () => {
  it("returns null for null input", () => {
    expect(normalizeUsage(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeUsage("string")).toBeNull();
    expect(normalizeUsage(42)).toBeNull();
    expect(normalizeUsage([1, 2])).toBeNull();
  });

  it("extracts token counts", () => {
    expect(
      normalizeUsage({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      }),
    ).toEqual({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    });
  });

  it("returns null for missing keys", () => {
    expect(normalizeUsage({})).toEqual({
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
    });
  });

  it("truncates floats to integers", () => {
    expect(normalizeUsage({ prompt_tokens: 10.7 })).toEqual({
      prompt_tokens: 10,
      completion_tokens: null,
      total_tokens: null,
    });
  });
});

describe("buildErrorPayload", () => {
  it("returns null for null input", () => {
    expect(buildErrorPayload(null, baseConfig)).toBeNull();
  });

  it("builds from Error instance", () => {
    const err = new TypeError("bad input");
    const result = buildErrorPayload(err, baseConfig)!;
    expect(result.error_type).toBe("TypeError");
    expect(result.message).toBe("bad input");
  });

  it("builds from string", () => {
    const result = buildErrorPayload("something failed", baseConfig)!;
    expect(result.error_type).toBe("Error");
    expect(result.message).toBe("something failed");
  });

  it("builds from dict", () => {
    const result = buildErrorPayload(
      { error_type: "CustomError", message: "oops" },
      baseConfig,
    )!;
    expect(result.error_type).toBe("CustomError");
    expect(result.message).toBe("oops");
  });

  it("redacts sensitive keys in error payload", () => {
    const result = buildErrorPayload(
      { error_type: "AuthError", message: "fail", details: { api_key: "sk-123" } },
      baseConfig,
    )!;
    expect((result.details as Record<string, unknown>).api_key).toBe(REDACTED_MARKER);
  });

  it("omits stack when includeStack=false", () => {
    const err = new Error("test");
    const result = buildErrorPayload(err, baseConfig, false)!;
    expect(result.stack).toBeNull();
  });
});
