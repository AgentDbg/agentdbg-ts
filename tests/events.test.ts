import { describe, it, expect } from "vitest";
import { newEvent, utcNowIsoMsZ, ensureJsonSafe } from "../src/events.js";
import { EventType } from "../src/types.js";
import { SPEC_VERSION, TRUNCATED_MARKER, DEPTH_LIMIT } from "../src/constants.js";

describe("utcNowIsoMsZ", () => {
  it("returns ISO8601 string ending in Z", () => {
    const ts = utcNowIsoMsZ();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("ensureJsonSafe", () => {
  it("passes through primitives", () => {
    expect(ensureJsonSafe(null)).toBe(null);
    expect(ensureJsonSafe(true)).toBe(true);
    expect(ensureJsonSafe(42)).toBe(42);
    expect(ensureJsonSafe("hello")).toBe("hello");
  });

  it("passes through plain objects", () => {
    expect(ensureJsonSafe({ a: 1, b: "c" })).toEqual({ a: 1, b: "c" });
  });

  it("passes through arrays", () => {
    expect(ensureJsonSafe([1, "a", null])).toEqual([1, "a", null]);
  });

  it("converts undefined to null", () => {
    expect(ensureJsonSafe(undefined)).toBe(null);
  });

  it("stringifies non-JSON-safe values", () => {
    const sym = Symbol("test");
    expect(typeof ensureJsonSafe(sym)).toBe("string");
  });

  it("truncates at DEPTH_LIMIT", () => {
    let nested: unknown = "leaf";
    for (let i = 0; i < DEPTH_LIMIT + 2; i++) {
      nested = { child: nested };
    }
    const result = ensureJsonSafe(nested) as Record<string, unknown>;
    let current: unknown = result;
    let depth = 0;
    while (typeof current === "object" && current !== null && "child" in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>).child;
      depth++;
    }
    expect(current).toBe(TRUNCATED_MARKER);
    expect(depth).toBeLessThanOrEqual(DEPTH_LIMIT + 1);
  });
});

describe("newEvent", () => {
  it("returns all required fields", () => {
    const evt = newEvent(EventType.LLM_CALL, "run-123", "gpt-4", { model: "gpt-4" });
    expect(evt.spec_version).toBe(SPEC_VERSION);
    expect(evt.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(evt.run_id).toBe("run-123");
    expect(evt.parent_id).toBeNull();
    expect(evt.event_type).toBe("LLM_CALL");
    expect(evt.ts).toMatch(/Z$/);
    expect(evt.duration_ms).toBeNull();
    expect(evt.name).toBe("gpt-4");
    expect(evt.payload).toEqual({ model: "gpt-4" });
    expect(evt.meta).toEqual({});
  });

  it("wraps null payload as empty object", () => {
    const evt = newEvent(EventType.RUN_START, "r", "n", null);
    expect(evt.payload).toEqual({});
  });

  it("wraps non-object payload in {value: ...}", () => {
    const evt = newEvent(EventType.RUN_START, "r", "n", "hello");
    expect(evt.payload).toEqual({ value: "hello" });
  });

  it("wraps array payload in {value: ...}", () => {
    const evt = newEvent(EventType.RUN_START, "r", "n", [1, 2, 3]);
    expect(evt.payload).toEqual({ value: [1, 2, 3] });
  });

  it("accepts optional parentId, durationMs, meta", () => {
    const evt = newEvent(EventType.TOOL_CALL, "r", "n", {}, {
      parentId: "parent-1",
      durationMs: 500,
      meta: { key: "value" },
    });
    expect(evt.parent_id).toBe("parent-1");
    expect(evt.duration_ms).toBe(500);
    expect(evt.meta).toEqual({ key: "value" });
  });

  it("wraps non-object meta in {value: ...}", () => {
    const evt = newEvent(EventType.RUN_START, "r", "n", {}, {
      meta: [1, 2] as unknown as Record<string, unknown>,
    });
    expect(evt.meta).toEqual({ value: [1, 2] });
  });

  it("generates unique event_ids", () => {
    const a = newEvent(EventType.RUN_START, "r", "n", {});
    const b = newEvent(EventType.RUN_START, "r", "n", {});
    expect(a.event_id).not.toBe(b.event_id);
  });

  it("accepts string event type", () => {
    const evt = newEvent("CUSTOM_TYPE", "r", "n", {});
    expect(evt.event_type).toBe("CUSTOM_TYPE");
  });
});
