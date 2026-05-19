This is a large, multi-system stabilization pass. Below is the concrete plan, scoped to the existing client-side architecture (no new backend), grouped by priority so each step is verifiable before moving to the next.

## Scope & Ground Rules

- Client-only changes (project is a Vite/React SPA on Lovable Cloud). True OS-level CPU snapshots are not exposed to browsers — the closest honest signal is event-loop drift from a main thread + Web Worker, which the app already uses. The audit will harden that path rather than fake `os.cpus()` deltas.
- No new dependencies. Reuse `src/lib/steganography.ts`, `src/lib/forensics.ts`, `src/lib/cpuProbe.ts`, `StatusBar`, `Index`, `EncodeTab`, `DecodeTab`, `AttackSimulatorTab`.
- Each section ends with a concrete verification step.

## 1. Telemetry Core (`StatusBar.tsx`, `cpuProbe.ts`)

- Move CPU + MEM sampling into a single `useTelemetry` hook so intervals can't duplicate across re-mounts.
- Single 1000 ms aggregation tick (current code mixes 200 ms and 1 s loops). Drift samples still collected at 200 ms but only *committed* to history once per second.
- Add EMA + deadband on CPU (already partly there) and guarantee history buffer length = 10.
- Guard against `Math` division-by-zero and `performance.memory` missing.
- Clean up worker + intervals in a single `useEffect` return.

Verify: leave tab idle 60 s → CPU sparkline drifts < 5 % band, no spike alerts; click TEST → spike fires within dwellMs then clears.

## 2. Operations Orchestrator (new `src/lib/ops.ts`)

Single source of truth for every operation across modules.

```ts
type OpRecord = {
  requestId: string;        // OP-#### monotonic
  rootRequestId: string;    // same as requestId unless child op
  module: "AES" | "STEG" | "ANALYSIS" | "EXPORT" | "SYSTEM";
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "running" | "ok" | "error";
  trace: { stage: string; at: number }[];
};
```

- `beginOp(module, parentId?)` → returns `{id, trace(stage)}`.
- `endOp(id, status)` records duration, emits to history + log.
- Index.tsx, EncodeTab, DecodeTab, AttackSimulatorTab all migrate to this. Removes the current ad-hoc OP-XX counters and timer refs.
- IDs are UUID-suffixed internally; display label remains `OP-01` style derived from a monotonic counter.

Verify: rapid 5× encode in a row → 5 distinct IDs, all complete, ACTIVE bar ramps and clears per op with 1.2 s dwell.

## 3. Steganography Hardening (`src/lib/steganography.ts`)

- Replace any string-length capacity math with `TextEncoder().encode(msg).byteLength`.
- Header layout (already largely present, audit & lock down): `[4B length][32B SHA-256][payload]`.
- Embed uses `pixel = (pixel & 0xFE) | bit` per RGB channel (skip alpha).
- Extract reads identical order, verifies SHA-256, throws `IntegrityError` on mismatch.
- Capacity check: `usableBits = pixels * 3 - (4 + 32) * 8`. Block embed if payload exceeds.
- Add unit tests under `src/lib/__tests__/steganography.test.ts` for: ASCII, "Hello🔥🙂தமிழ்", near-capacity, tampered byte.

Verify: `bunx vitest run src/lib/__tests__/steganography.test.ts` all green.

## 4. AES-GCM Hardening (audit in `src/lib/steganography.ts` or new `src/lib/crypto.ts`)

- AES-256-GCM via WebCrypto.
- PBKDF2-SHA256, **random 16 B salt**, 100 000 iters, 256-bit key.
- Random 12 B IV per encryption.
- Output struct: `{ ciphertext, iv, salt, iterations: 100000, alg: "AES-256-GCM" }` base64-encoded.
- Tests: same plaintext + same password → different ciphertext; flipping one byte of ciphertext → decrypt throws.

## 5. Red-Team Analyzer (`AttackSimulatorTab.tsx` + new `src/lib/threatEngine.ts`)

Replace any templated outputs with rule + weight scoring:

- Detectors: XSS (script/event handler/javascript:), SQLi (union/comment/tautology), HTML injection, event injection, obfuscation (hex, base64, char-code chains).
- Score = Σ(weight × confidence) clamped 0..100; severity buckets low/medium/high/critical.
- Output: `{ threatType, severity, confidence, complexity, vector, executionPoint, trigger, correlation }`.
- Temporal layer: keep last 20 analyses in memory; flag "repeated vector" / "escalation" when same vector seen ≥ 3× with rising severity.

## 6. Frontend Stability Sweep

- All fetch/async in EncodeTab/DecodeTab/AttackSimulatorTab wrapped with `AbortController`; abort on unmount or new submit.
- Debounce live forensics input at 300 ms (already partly in `InputForensics`, verify).
- Audit `useEffect` deps for stale closures (telemetry, ops, progress ramp).
- Single interval registry — no `setInterval` without a tracked ref + cleanup.
- Guard `setState` after unmount with `mountedRef`.

## 7. Export / Forensic Report

- New `src/lib/report.ts` builds report JSON: `{ meta:{requestId, rootRequestId, generatedAt, engineVersion}, ops:[…], analysis, systemSnapshot, integritySha256 }`.
- `integritySha256` computed over canonicalized JSON sans the field itself.
- All export buttons route through this builder.

## 8. Execution Trace Logs

- Each op pushes real stage entries via `trace("UTF-8 preprocessing")`, `trace("entropy analysis")`, etc., timestamped from actual code points — no `setTimeout` placeholders.
- SystemLog renders trace entries inline with the op ID.

## 9. Verification Pass

Run after each section:
1. `bunx vitest run` (new lib tests).
2. Manual: rapid 5× encode/decode, unicode payload, tampered ciphertext, idle 60 s telemetry drift, TEST spike, multi-tab open (5 tabs).
3. Browser console must be clean; no React key warnings, no unhandled rejections.

## Out of Scope

- Adding a real server-side `/api/system-stats` (would require a persistent Node server — not available in the static deploy target). Browser-local probe is the honest substitute and will be labeled as such in the UI tooltip.
- Visual redesign — this pass is purely correctness/stability.

## Order of Execution

1. Ops orchestrator (foundation everything else logs through)
2. Telemetry hook refactor
3. Steg + AES hardening with tests
4. Threat engine rewrite
5. Stability sweep + AbortControllers
6. Report builder + trace logs
7. Full verification pass

Estimated touch list: ~12 files modified, ~4 files added, ~2 test files added.