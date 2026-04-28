import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { analyze, type EngineMode } from "@/lib/threatClient";
import type { AnalyzeResult, Stage } from "@/lib/threatEngineCore";
import ThreatReportCard from "./ThreatReportCard";
import PipelinePanel from "./PipelinePanel";
import EngineModeToggle from "./EngineModeToggle";
import InlineError from "@/components/InlineError";
import InlineWarning from "@/components/InlineWarning";
import { Play, Loader2 } from "lucide-react";
import type { LogEntry } from "@/components/SystemLog";

interface Props {
  mode: EngineMode;
  onModeChange: (m: EngineMode) => void;
  onLog: (level: LogEntry["level"], source: string, msg: string) => void;
  onHistoryAdd?: (e: { type: "analyze"; summary: string; detail?: string }) => void;
}

const SAMPLES = [
  { label: "XSS",    payload: `<script>alert(document.cookie)</script>` },
  { label: "SQLi",   payload: `' OR 1=1 -- ` },
  { label: "Cmd",    payload: `; cat /etc/passwd` },
  { label: "Path",   payload: `../../../../etc/shadow` },
  { label: "Clean",  payload: `Hello, this is a normal message.` },
];

export default function ThreatScanTab({ mode, onModeChange, onLog, onHistoryAdd }: Props) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastInputRef = useRef("");

  const MAX_INPUT = 10_000;
  const NEAR_LIMIT = 9_000;
  const nearLimit = input.length >= NEAR_LIMIT && input.length <= MAX_INPUT;
  const overLimit = input.length > MAX_INPUT;

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!input.trim()) { setResult(null); setStages([]); setErr(null); return; }
    debounceRef.current = window.setTimeout(() => { void run(input); }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, mode]);

  async function run(text: string) {
    if (text === lastInputRef.current && result) return;
    lastInputRef.current = text;
    setRunning(true); setErr(null); setStages([]);
    onLog("sys", "analyze", `OP-09 / THREAT-SCAN initiated · src=${mode} · len=${text.length}`);
    const t0 = performance.now();
    const r = await analyze(text, mode);
    if (r.status === "error") {
      setErr(r.message);
      onLog("err", "analyze", `${r.message} (src=${r.source})`);
      setRunning(false);
      return;
    }
    // animate stage reveal so pipeline feels live
    for (let i = 0; i < r.stages.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      await new Promise((res) => setTimeout(res, 60));
      setStages(r.stages.slice(0, i + 1));
    }
    setResult(r);
    setRunning(false);
    const ms = (performance.now() - t0).toFixed(2);
    onLog("ok", "analyze", `scan complete · threat=${r.threat} · sev=${r.severity} · ${ms}ms · src=${r.source}`);
    onHistoryAdd?.({
      type: "analyze",
      summary: `${r.threat} · ${r.severity} · ${Math.round(r.confidence * 100)}%`,
      detail: text,
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-glass rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            // operator input · live analysis (300ms debounce)
          </Label>
          <EngineModeToggle mode={mode} onChange={onModeChange} />
        </div>

        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste suspect payload, query string, form value, log line..."
          className="font-mono text-xs min-h-[140px] bg-background/50 border-border/40"
          maxLength={10000}
        />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground/60 self-center mr-1">samples:</span>
            {SAMPLES.map((s) => (
              <Button
                key={s.label} variant="outline" size="sm"
                onClick={() => setInput(s.payload)}
                className="h-6 px-2 text-[10px] font-mono border-border/40"
              >
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {input.length}/10000
            </span>
            <Button
              size="sm" onClick={() => void run(input)}
              disabled={!input.trim() || running}
              className="btn-encode h-7 text-[11px] gap-1.5"
            >
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              {running ? "PROCESSING" : "RE-RUN"}
            </Button>
          </div>
        </div>

        {err && <InlineError code="E_ANALYZE" title="ANALYZE FAILED" reason={err} />}

        {overLimit && (
          <InlineWarning
            code="W_OVER_LIMIT"
            title="INPUT EXCEEDS LIMIT"
            reason={`Input is ${input.length.toLocaleString()} / ${MAX_INPUT.toLocaleString()} chars. Backend will reject this payload.`}
            hint="Trim before re-running."
          />
        )}
        {nearLimit && (
          <InlineWarning
            code="W_NEAR_LIMIT"
            title="APPROACHING INPUT LIMIT"
            reason={`Input is ${input.length.toLocaleString()} / ${MAX_INPUT.toLocaleString()} chars (${Math.round((input.length / MAX_INPUT) * 100)}%).`}
          />
        )}
      </div>

      <PipelinePanel stages={stages} running={running} />

      {result && <ThreatReportCard result={result} />}
    </div>
  );
}