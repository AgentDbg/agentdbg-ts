import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../src/config.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `agentdbg-config-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

let savedEnv: Record<string, string | undefined>;
const envKeys = [
  "AGENTDBG_REDACT",
  "AGENTDBG_REDACT_KEYS",
  "AGENTDBG_MAX_FIELD_BYTES",
  "AGENTDBG_LOOP_WINDOW",
  "AGENTDBG_LOOP_REPETITIONS",
  "AGENTDBG_DATA_DIR",
  "AGENTDBG_ENABLED",
  "AGENTDBG_STOP_ON_LOOP",
  "AGENTDBG_STOP_ON_LOOP_MIN_REPETITIONS",
  "AGENTDBG_MAX_LLM_CALLS",
  "AGENTDBG_MAX_TOOL_CALLS",
  "AGENTDBG_MAX_EVENTS",
  "AGENTDBG_MAX_DURATION_S",
];

beforeEach(() => {
  savedEnv = {};
  for (const k of envKeys) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of envKeys) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("loadConfig", () => {
  it("returns correct defaults when no config files or env vars", () => {
    const tmp = makeTmpDir();
    try {
      // Point to a project root with no config
      const config = loadConfig(tmp);
      expect(config.redact).toBe(true);
      expect(config.redact_keys).toEqual([
        "api_key",
        "authorization",
        "cookie",
        "password",
        "secret",
        "token",
      ]);
      expect(config.max_field_bytes).toBe(20000);
      expect(config.loop_window).toBe(12);
      expect(config.loop_repetitions).toBe(3);
      expect(config.enabled).toBe(true);
      expect(config.guardrails.stop_on_loop).toBe(false);
      expect(config.guardrails.max_llm_calls).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("env var AGENTDBG_REDACT overrides default", () => {
    process.env.AGENTDBG_REDACT = "0";
    const config = loadConfig(makeTmpDir());
    expect(config.redact).toBe(false);
  });

  it("env var AGENTDBG_REDACT truthy values work", () => {
    for (const val of ["1", "true", "yes", "TRUE", "Yes"]) {
      process.env.AGENTDBG_REDACT = val;
      expect(loadConfig(makeTmpDir()).redact).toBe(true);
    }
  });

  it("env var AGENTDBG_REDACT_KEYS overrides default", () => {
    process.env.AGENTDBG_REDACT_KEYS = "my_key,other_key";
    const config = loadConfig(makeTmpDir());
    expect(config.redact_keys).toEqual(["my_key", "other_key"]);
  });

  it("env var AGENTDBG_MAX_FIELD_BYTES overrides default", () => {
    process.env.AGENTDBG_MAX_FIELD_BYTES = "500";
    const config = loadConfig(makeTmpDir());
    expect(config.max_field_bytes).toBe(500);
  });

  it("env var AGENTDBG_MAX_FIELD_BYTES respects minimum", () => {
    process.env.AGENTDBG_MAX_FIELD_BYTES = "10";
    const config = loadConfig(makeTmpDir());
    expect(config.max_field_bytes).toBe(100);
  });

  it("env var AGENTDBG_LOOP_WINDOW overrides default", () => {
    process.env.AGENTDBG_LOOP_WINDOW = "20";
    const config = loadConfig(makeTmpDir());
    expect(config.loop_window).toBe(20);
  });

  it("env var AGENTDBG_LOOP_REPETITIONS overrides default", () => {
    process.env.AGENTDBG_LOOP_REPETITIONS = "5";
    const config = loadConfig(makeTmpDir());
    expect(config.loop_repetitions).toBe(5);
  });

  it("env var AGENTDBG_DATA_DIR overrides default", () => {
    const tmp = makeTmpDir();
    process.env.AGENTDBG_DATA_DIR = tmp;
    const config = loadConfig(makeTmpDir());
    expect(config.data_dir).toBe(tmp);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("AGENTDBG_ENABLED=0 disables", () => {
    process.env.AGENTDBG_ENABLED = "0";
    const config = loadConfig(makeTmpDir());
    expect(config.enabled).toBe(false);
  });

  it("AGENTDBG_ENABLED=1 enables", () => {
    process.env.AGENTDBG_ENABLED = "1";
    const config = loadConfig(makeTmpDir());
    expect(config.enabled).toBe(true);
  });

  it("reads project YAML config", () => {
    const tmp = makeTmpDir();
    const cfgDir = join(tmp, ".agentdbg");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(
      join(cfgDir, "config.yaml"),
      "redact: false\nloop_window: 20\nmax_field_bytes: 5000\n",
    );
    const config = loadConfig(tmp);
    expect(config.redact).toBe(false);
    expect(config.loop_window).toBe(20);
    expect(config.max_field_bytes).toBe(5000);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("env overrides project YAML", () => {
    const tmp = makeTmpDir();
    const cfgDir = join(tmp, ".agentdbg");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, "config.yaml"), "loop_window: 20\n");
    process.env.AGENTDBG_LOOP_WINDOW = "30";
    const config = loadConfig(tmp);
    expect(config.loop_window).toBe(30);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("invalid YAML is silently ignored", () => {
    const tmp = makeTmpDir();
    const cfgDir = join(tmp, ".agentdbg");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, "config.yaml"), "{{invalid yaml");
    const config = loadConfig(tmp);
    // Falls back to defaults
    expect(config.redact).toBe(true);
    expect(config.loop_window).toBe(12);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads guardrails from YAML", () => {
    const tmp = makeTmpDir();
    const cfgDir = join(tmp, ".agentdbg");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(
      join(cfgDir, "config.yaml"),
      "guardrails:\n  stop_on_loop: true\n  max_llm_calls: 50\n  max_duration_s: 120.5\n",
    );
    const config = loadConfig(tmp);
    expect(config.guardrails.stop_on_loop).toBe(true);
    expect(config.guardrails.max_llm_calls).toBe(50);
    expect(config.guardrails.max_duration_s).toBe(120.5);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("guardrail env vars override YAML", () => {
    const tmp = makeTmpDir();
    const cfgDir = join(tmp, ".agentdbg");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(
      join(cfgDir, "config.yaml"),
      "guardrails:\n  max_llm_calls: 50\n",
    );
    process.env.AGENTDBG_MAX_LLM_CALLS = "100";
    const config = loadConfig(tmp);
    expect(config.guardrails.max_llm_calls).toBe(100);
    rmSync(tmp, { recursive: true, force: true });
  });
});
