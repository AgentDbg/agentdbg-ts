# @agentdbg/core

TypeScript interface for AgentDbg.

`@agentdbg/core` is a **limited, write-side mirror** of the Python `agentdbg` package. It exists to support future TS/JS plugin integrations by writing run data in the same on-disk format that `agentdbg view` reads.

Python remains the source of truth for spec and behavior.

## What this package is

- A small TS library that mirrors core AgentDbg schema/helpers.
- A compatibility layer that writes `run.json` and `events.jsonl` under `~/.agentdbg/runs/<run_id>/`.
- A package intended for plugin authors and integration code, not a full replacement for Python AgentDbg.

## What this package is not

- Not a full port of Python `agentdbg`.
- Not a viewer/UI/CLI.
- Not the runtime tracing decorator/context manager system from Python (`@trace`, `traced_run`).
- Not the canonical implementation of the spec.

## Source of truth

The Python package in this repository is canonical:

- `agentdbg/agentdbg/events.py`
- `agentdbg/agentdbg/constants.py`
- `agentdbg/agentdbg/storage.py`
- `agentdbg/agentdbg/config.py`
- `agentdbg/agentdbg/_tracing/_redact.py`
- `agentdbg/agentdbg/loopdetect.py`

When Python behavior changes, this TS package should be updated to mirror it.

## Installation

```bash
npm install @agentdbg/core
```

## Quick usage

```ts
import {
  createRun,
  appendEvent,
  finalizeRun,
  newEvent,
  EventType,
  loadConfig,
} from "@agentdbg/core";

const config = loadConfig();

const run = createRun("my-plugin-run", { data_dir: config.data_dir });

appendEvent(
  run.run_id,
  newEvent(EventType.RUN_START, run.run_id, "my-plugin-run", {}),
  { data_dir: config.data_dir },
);

appendEvent(
  run.run_id,
  newEvent(EventType.LLM_CALL, run.run_id, "gpt-4", {
    model: "gpt-4",
    prompt: "hello",
    response: "world",
  }),
  { data_dir: config.data_dir },
);

appendEvent(
  run.run_id,
  newEvent(EventType.RUN_END, run.run_id, "my-plugin-run", { status: "ok" }),
  { data_dir: config.data_dir },
);

finalizeRun(
  run.run_id,
  "ok",
  { llm_calls: 1, tool_calls: 0, errors: 0, loop_warnings: 0 },
  { data_dir: config.data_dir },
);
```

Then run:

```bash
agentdbg view
```

## Exposed API

- **Types/schema:** `EventType`, `AgentDbgEvent`, `RunMeta`, `RunCounts`, `AgentDbgConfig`, `GuardrailParams`
- **Constants:** `SPEC_VERSION`, `REDACTED_MARKER`, `TRUNCATED_MARKER`, `DEPTH_LIMIT`, `defaultCounts`
- **Events:** `newEvent`, `utcNowIsoMsZ`, `ensureJsonSafe`
- **Storage (write-side):** `createRun`, `appendEvent`, `finalizeRun`, `validateRunId`
- **Config:** `loadConfig`
- **Redaction:** `redactAndTruncate`, `truncateString`, `keyMatchesRedact`, `normalizeUsage`, `buildErrorPayload`
- **Loop detect:** `computeSignature`, `detectLoop`, `patternKey`

## Limitations

- This package intentionally implements a **limited interface**.
- Read-side storage helpers (`listRuns`, `loadEvents`, `loadRunMeta`) are handled by Python viewer/CLI.
- Python-specific lifecycle internals are not ported.
- Compatibility target is Linux/macOS plugin environments.

## Development

```bash
npm install
npm run build
npm test
```

## License

Apache-2.0
