/**
 * @agentdbg/core — TypeScript interface for AgentDbg.
 *
 * Write-side trace events compatible with the Python agentdbg viewer.
 * Python package (agentdbg) is the source of truth for the spec.
 */

export {
  EventType,
  type AgentDbgEvent,
  type RunMeta,
  type RunCounts,
  type AgentDbgConfig,
  type GuardrailParams,
} from "./types.js";

export {
  SPEC_VERSION,
  REDACTED_MARKER,
  TRUNCATED_MARKER,
  DEPTH_LIMIT,
  defaultCounts,
} from "./constants.js";

export { newEvent, utcNowIsoMsZ, ensureJsonSafe, type NewEventOpts } from "./events.js";

export { createRun, appendEvent, finalizeRun, validateRunId } from "./storage.js";

export { loadConfig } from "./config.js";

export {
  redactAndTruncate,
  truncateString,
  keyMatchesRedact,
  normalizeUsage,
  buildErrorPayload,
} from "./redact.js";

export {
  computeSignature,
  detectLoop,
  patternKey,
  type LoopWarningPayload,
} from "./loopdetect.js";
