import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { transform, type EngineMode } from "@/lib/threatClient";
import { detectEncoding, type EncType } from "@/lib/threatEngineCore";
import EngineModeToggle from "./EngineModeToggle";
import InlineError from "@/components/InlineError";
import InlineWarning from "@/components/InlineWarning";
import { ArrowRightLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LogEntry } from "@/components/SystemLog";

interface Props {
  mode: EngineMode;
  onModeChange: (m: EngineMode) => void;
  onLog: (level: LogEntry["level"], source: string, msg: string) => void;
  onHistoryAdd?: (e: { type: "encode" | "decode"; summary: string; detail?: string }) => void;
}

const MAX_INPUT = 10_000;
const NEAR_LIMIT = 9_000;

const FORMAT_RX: Record<EncType, RegExp> = {
  base64: /^[A-Za-z0-9+/\s]+={0,2}$/,
  url:    /%[0-9a-fA-F]{2}/,
  hex:    /^[0-9a-fA-F\s]+$/,
  binary: /^[01\s]+$/,
};

/** Pre-flight check — runs locally before any backend dispatch. */
function preflight(input: string, op: "encode" | "decode", type: EncType | "auto"):
  | { kind: "limit"; pct: number }
  | { kind: "mismatch"; type: EncType; reason: string }
  | { kind: "undetectable" }
  | null
{
  const len = input.length;
  if (len >= NEAR_LIMIT) return { kind: "limit", pct: Math.round((len / MAX_INPUT) * 100) };

  // Format checks only meaningful when decoding; encoding accepts any text.
  if (op !== "decode" || !input.trim()) return null;

  if (type === "auto") {
    if (!detectEncoding(input)) return { kind: "undetectable" };
    return null;
  }

  const trimmed = input.trim();
  const rx = FORMAT_RX[type];
  if (!rx.test(trimmed)) {
    const map: Record<EncType, string> = {
      base64: "Contains characters outside the Base64 alphabet (A–Z, a–z, 0–9, +, /, =).",
      url:    "No percent-encoded sequences (%XX) found.",
      hex:    "Contains non-hex characters (expected 0–9, a–f).",
      binary: "Contains characters other than 0 and 1.",
    };
    return { kind: "mismatch", type, reason: map[type] };
  }
  // Length-modulo checks
  const stripped = trimmed.replace(/\s/g, "");
  if (type === "base64" && stripped.length % 4 !== 0)
    return { kind: "mismatch", type, reason: `Base64 length must be a multiple of 4 (got ${stripped.length}).` };
  if (type === "hex" && stripped.length % 2 !== 0)
    return { kind: "mismatch", type, reason: `Hex length must be even (got ${stripped.length}).` };
  if (type === "binary" && stripped.length % 8 !== 0)
    return { kind: "mismatch", type, reason: `Binary length must be a multiple of 8 (got ${stripped.length}).` };
  return null;
}

export default function EncodeDecodeTab({ mode, onModeChange, onLog, onHistoryAdd }: Props) {
  const [op, setOp] = useState<"encode" | "decode">("encode");
  const [type, setType] = useState<EncType | "auto">("auto");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [detected, setDetected] = useState<EncType | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const warning = preflight(input, op, type);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!input.trim()) { setOutput(""); setDetected(null); setErr(null); return; }
    setDetected(detectEncoding(input));
    // Skip backend dispatch if pre-flight produced a blocking-class warning
    // (mismatch / undetectable). Limit warnings are advisory only.
    const pre = preflight(input, op, type);
    if (pre && (pre.kind === "mismatch" || pre.kind === "undetectable")) {
      setOutput("");
      return;
    }
    debounceRef.current = window.setTimeout(() => { void run(); }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, op, type, mode]);

  async function run() {
    setRunning(true); setErr(null);
    onLog("sys", op, `OP-08 / ${op.toUpperCase()} initiated · src=${mode} · type=${type}`);
    const r = await transform(op, input, type, mode);
    setRunning(false);
    if (r.status === "error") {
      setErr(r.message); setOutput("");
      onLog("err", op, `${r.message} (src=${r.source})`);
      return;
    }
    setOutput(r.output);
    onLog("ok", op, `${op} ok · type=${r.type} · ${r.ms}ms · src=${r.source}`);
    onHistoryAdd?.({
      type: op,
      summary: `${op} · ${r.type.toUpperCase()} · ${input.length}→${r.output.length}`,
      detail: r.output,
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-glass rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            // codec ops · base64 / url / hex / binary
          </Label>
          <EngineModeToggle mode={mode} onChange={onModeChange} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border border-border/40 bg-background/40 p-0.5 font-mono text-[10px]">
            {(["encode","decode"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOp(o)}
                className={`px-3 py-1 rounded transition-colors ${
                  op === o
                    ? o === "encode"
                      ? "bg-[hsl(var(--encode-accent))]/20 text-[hsl(var(--encode-accent))]"
                      : "bg-[hsl(var(--decode-accent))]/20 text-[hsl(var(--decode-accent))]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.toUpperCase()}
              </button>
            ))}
          </div>

          <Select value={type} onValueChange={(v) => setType(v as EncType | "auto")}>
            <SelectTrigger className="h-7 w-[140px] font-mono text-[11px] bg-background/40 border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">auto-detect</SelectItem>
              <SelectItem value="base64">Base64</SelectItem>
              <SelectItem value="url">URL</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
            </SelectContent>
          </Select>

          {type === "auto" && (
            <span className="font-mono text-[10px] text-muted-foreground">
              detected: <span className="text-[hsl(var(--encode-accent))]">{detected ?? "—"}</span>
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {running && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{input.length}/10000</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1 block">// input</Label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={op === "encode" ? "Plain text to encode..." : "Encoded payload to decode..."}
              className="font-mono text-xs min-h-[160px] bg-background/50 border-border/40"
              maxLength={10000}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">// output</Label>
              <Button
                variant="ghost" size="sm"
                disabled={!output}
                onClick={() => { navigator.clipboard.writeText(output); toast.success("Copied"); }}
                className="h-5 px-2 text-[10px] font-mono gap-1"
              >
                <Copy className="h-3 w-3" /> copy
              </Button>
            </div>
            <Textarea
              value={output}
              readOnly
              placeholder="// awaiting input..."
              className="font-mono text-xs min-h-[160px] bg-background/30 border-border/40 text-[hsl(var(--decode-accent))]"
            />
          </div>
        </div>

        {warning && warning.kind === "limit" && (
          <InlineWarning
            code="W_NEAR_LIMIT"
            title="APPROACHING INPUT LIMIT"
            reason={`Input is ${input.length.toLocaleString()} / ${MAX_INPUT.toLocaleString()} chars (${warning.pct}%). Backend will reject anything over ${MAX_INPUT.toLocaleString()}.`}
            hint="Trim the payload or split it into smaller chunks."
          />
        )}
        {warning && warning.kind === "mismatch" && (
          <InlineWarning
            code="W_FORMAT_MISMATCH"
            title={`INPUT DOES NOT LOOK LIKE ${warning.type.toUpperCase()}`}
            reason={warning.reason}
            hint="Switch the codec to auto-detect or pick the matching format."
          />
        )}
        {warning && warning.kind === "undetectable" && (
          <InlineWarning
            code="W_NO_CODEC"
            title="UNRECOGNIZED CODEC"
            reason="Auto-detect could not match the input to Base64, URL, Hex, or Binary."
            hint="Pick the codec manually if you know the format."
          />
        )}

        {err && <InlineError code="E_CODEC" title={`${op.toUpperCase()} FAILED`} reason={err} />}

        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            // live transform · 300ms debounce
          </span>
          <Button
            size="sm" variant="outline"
            onClick={() => { setInput(output); setOp(op === "encode" ? "decode" : "encode"); }}
            disabled={!output}
            className="h-7 text-[11px] font-mono gap-1.5 border-border/40"
          >
            <ArrowRightLeft className="h-3 w-3" /> swap
          </Button>
        </div>
      </div>
    </div>
  );
}