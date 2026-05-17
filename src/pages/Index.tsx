import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EncodeTab from "@/components/EncodeTab";
import DecodeTab, { DecodeTabRef } from "@/components/DecodeTab";
import ImagePreview from "@/components/ImagePreview";
import ImageComparison from "@/components/ImageComparison";
import LearnTab from "@/components/LearnTab";
import SteganalysisTab from "@/components/SteganalysisTab";
import PixelVisualizationTab from "@/components/PixelVisualizationTab";
import MetadataTab from "@/components/MetadataTab";
import AttackSimulatorTab from "@/components/AttackSimulatorTab";
import CyberGrid from "@/components/CyberGrid";
import StatusBar from "@/components/StatusBar";
import HistoryPanel, { HistoryEntry } from "@/components/HistoryPanel";
import OpsHeader from "@/components/OpsHeader";
import SystemLog, { LogEntry } from "@/components/SystemLog";
import AirgapIndicator from "@/components/AirgapIndicator";
import EnginePanel from "@/components/EnginePanel";
import { Button } from "@/components/ui/button";
import { Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { sha256Report } from "@/lib/forensics";

type TabValue = "encode" | "decode" | "analyze" | "visualize" | "metadata" | "attack" | "learn";

const TAB_CODES: Record<TabValue, { code: string; label: string; icon: string }> = {
  encode:    { code: "OP-01", label: "EMBED",    icon: "🔒" },
  decode:    { code: "OP-02", label: "EXTRACT",  icon: "🔓" },
  analyze:   { code: "OP-03", label: "ANALYZE",  icon: "🔍" },
  visualize: { code: "OP-04", label: "PIXELS",   icon: "👁" },
  metadata:  { code: "OP-05", label: "EXIF",     icon: "📋" },
  attack:    { code: "OP-06", label: "RED-TEAM", icon: "⚔" },
  learn:     { code: "OP-07", label: "DOCS",     icon: "🎓" },
};

const SOURCE_OPS: Record<string, string> = {
  embed: "OP-01",
  extract: "OP-02",
  analyze: "OP-03",
  visualize: "OP-04",
  metadata: "OP-05",
  attack: "OP-06",
  docs: "OP-07",
  wipe: "OP-99",
};

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("encode");
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanMs, setLastScanMs] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now());
  const [runtimeOp, setRuntimeOp] = useState("IDLE");
  const decodeTabRef = useRef<DecodeTabRef | null>(null);
  const lastOpStartRef = useRef<number | null>(null);
  const opClearTimerRef = useRef<number | null>(null);
  const requestIdCounter = useRef(0);

  const sessionId = useMemo(() => {
    const rand = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
    return `SL-${new Date().getFullYear()}-${rand}`;
  }, []);

  /** Generate a unique request ID for each operation. */
  const nextRequestId = useCallback(() => {
    requestIdCounter.current++;
    const seq = requestIdCounter.current.toString().padStart(4, "0");
    return `${sessionId}-${seq}`;
  }, [sessionId]);

  const pushLog = useCallback((level: LogEntry["level"], source: string, message: string) => {
    const sourceOp = SOURCE_OPS[source];
    const reqId = sourceOp ? nextRequestId() : undefined;
    const scheduleIdle = () => {
      if (opClearTimerRef.current) window.clearTimeout(opClearTimerRef.current);
      const elapsed = lastOpStartRef.current ? performance.now() - lastOpStartRef.current : 9999;
      const remaining = Math.max(0, 1200 - elapsed);
      opClearTimerRef.current = window.setTimeout(() => {
        setRuntimeOp("IDLE");
        opClearTimerRef.current = null;
      }, remaining);
    };
    if (level === "sys" && /initiated/i.test(message)) {
      if (opClearTimerRef.current) { window.clearTimeout(opClearTimerRef.current); opClearTimerRef.current = null; }
      lastOpStartRef.current = performance.now();
      setRuntimeOp(sourceOp || message.match(/OP-\d+/)?.[0] || "ACTIVE");
    }
    if (level === "ok" && /complete/i.test(message) && lastOpStartRef.current != null) {
      // Only reset to IDLE on final OP-XX complete messages, not intermediate completions
      if (!/^OP-\d+/i.test(message)) {
        // Intermediate completion (e.g. "bit-write complete") — keep current op
        setLastActivityAt(Date.now());
        setLogs((prev) => [
          ...prev,
          { id: crypto.randomUUID(), timestamp: Date.now(), level, source, message },
        ].slice(-80));
        return;
      }
      setLastScanMs(performance.now() - lastOpStartRef.current);
      scheduleIdle();
    } else if (level === "err") {
      scheduleIdle();
    } else if (sourceOp && ["info", "warn"].includes(level)) {
      setRuntimeOp(sourceOp);
    }
    setLastActivityAt(Date.now());
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: Date.now(), level, source, message },
    ].slice(-80));
  }, [nextRequestId]);

  /** Export full session report with metadata and SHA-256 integrity hash. */
  const handleExportReport = useCallback(async () => {
    pushLog("sys", "wipe", "generating session report…");
    const report = {
      meta: {
        requestId: nextRequestId(),
        sessionId,
        timestamp: new Date().toISOString(),
        engineVersion: "2.3.1-enterprise",
      },
      history: history.map((h) => ({ type: h.type, summary: h.summary, timestamp: new Date(h.timestamp).toISOString() })),
      logs: logs.slice(-50).map((l) => ({ level: l.level, source: l.source, message: l.message, timestamp: new Date(l.timestamp).toISOString() })),
      stats: { opCount: history.length, lastScanMs },
      integrity: "",
    };
    const body = JSON.stringify(report, null, 2);
    report.integrity = await sha256Report(body);
    const final = JSON.stringify(report, null, 2);
    const blob = new Blob([final], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `steglab-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    pushLog("ok", "wipe", "report exported with SHA-256 integrity hash");
    toast.success("Report exported");
  }, [sessionId, history, logs, lastScanMs, nextRequestId, pushLog]);

  // Boot sequence
  useEffect(() => {
    const cryptoOk = typeof window !== "undefined" && !!window.crypto?.subtle;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent.split(") ").pop() || "unknown" : "unknown";
    const seq: Array<[LogEntry["level"], string, string]> = [
      ["sys",  "kernel",  `Lithick Threat Engine v2.3.1 · runtime=${ua}`],
      ["info", "kernel",  `cores=${navigator.hardwareConcurrency || "?"} · memory=${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "?"}GB`],
      ["info", "crypto",  cryptoOk ? "window.crypto.subtle handshake → ok" : "WARN: subtlecrypto unavailable"],
      ["info", "crypto",  "registering AES-256-GCM · PBKDF2-SHA256(iter=250000)"],
      ["info", "engine",  "loading embed modes · lsb · multi-bit · random-pixel · edge-based"],
      ["info", "engine",  "loading detectors · entropy · χ² · LSB-randomness"],
      ["info", "airgap",  "patching window.fetch + XMLHttpRequest.open · audit attached"],
      ["ok",   "session", `session ${sessionId} established · channel=isolated · scope=client-only`],
      ["info", "monitor", "input watchers attached · ready for operator"],
    ];
    seq.forEach(([lvl, src, msg], i) => {
      setTimeout(() => pushLog(lvl, src, msg), 140 * (i + 1));
    });
  }, [pushLog, sessionId]);

  const addHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => [
      { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev,
    ].slice(0, 10));
    const levelMap: Record<string, LogEntry["level"]> = { encode: "ok", decode: "ok", analyze: "info", attack: "warn" };
    pushLog(levelMap[entry.type] || "info", entry.type, entry.summary);
    setScanCount((c) => c + 1);
  }, [pushLog]);

  // Log tab switches
  useEffect(() => {
    const t = TAB_CODES[activeTab];
    pushLog("info", "router", `→ ${t.code} / ${t.label}`);
  }, [activeTab, pushLog]);

  const handleSampleLoad = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, "#0a0f2b");
    gradient.addColorStop(1, "#022b3a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let i = 0; i < 2000; i++) {
      ctx.fillRect(Math.random() * 800, Math.random() * 600, 1, 1);
    }
    const url = canvas.toDataURL();
    const img = new Image();
    img.onload = () => {
      setImage(img);
      pushLog("ok", "loader", `sample cover loaded · ${img.width}×${img.height}px`);
      toast.success("Sample image loaded");
    };
    img.src = url;
  };

  const handleClear = () => {
    setImage(null);
    setEncodedCanvas(null);
    if (activeTab === "decode" && decodeTabRef.current) decodeTabRef.current.clear();
    pushLog("warn", "memory", "workspace flushed · all buffers cleared");
    toast.success("Cleared");
  };

  const handleWipeWorkspace = () => {
    pushLog("sys", "wipe",  "OP-99 / WIPE-WORKSPACE initiated");
    pushLog("info", "wipe", "zeroing image buffer · canvas → null");
    setImage(null);
    pushLog("info", "wipe", "discarding encoded canvas · pixel data released");
    setEncodedCanvas(null);
    if (decodeTabRef.current) {
      pushLog("info", "wipe", "clearing decode tab · password & payload buffers wiped");
      decodeTabRef.current.clear();
    }
    pushLog("info", "wipe", `purging history · ${history.length} entries`);
    setHistory([]);
    pushLog("ok", "wipe", "workspace zeroed · GC eligible · op complete");
    toast.success("Workspace wiped — all buffers zeroed");
  };

  const tabClass = (tab: TabValue) => {
    const active = activeTab === tab;
    if (!active) return "text-xs font-mono";
    if (tab === "encode") return "text-xs font-mono tab-active-encode";
    if (tab === "decode") return "text-xs font-mono tab-active-decode";
    return "text-xs font-mono tab-active-encode";
  };

  const opCount = history.length;
  const activeOpCode = runtimeOp;

  return (
    <div className="min-h-screen relative flex flex-col">
      <CyberGrid />
      <StatusBar opCount={opCount} activeOp={activeOpCode} lastActivityAt={lastActivityAt} />

      <div className="max-w-7xl mx-auto px-4 py-4 relative z-10 flex-1 w-full">
        <OpsHeader sessionId={sessionId} onNav={(t) => setActiveTab(t)} />

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
              <TabsList className="grid w-full grid-cols-7 mb-4 h-12 bg-card/60 backdrop-blur-sm border border-border/40 p-1">
                {(Object.keys(TAB_CODES) as TabValue[]).map((t) => {
                  const meta = TAB_CODES[t];
                  return (
                    <TabsTrigger
                      key={t}
                      value={t}
                      className={`${tabClass(t)} flex flex-col items-center justify-center gap-0 h-full leading-tight`}
                    >
                      <span className="text-[9px] tracking-widest opacity-70">{meta.code}</span>
                      <span className="text-[10px] font-bold tracking-wide">{meta.icon} {meta.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="encode" className="mt-0">
                <EncodeTab
                  image={image}
                  onImageLoad={setImage}
                  onEncoded={setEncodedCanvas}
                  onHistoryAdd={(e) => addHistory(e)}
                  onLog={pushLog}
                />
              </TabsContent>
              <TabsContent value="decode" className="mt-0">
                <DecodeTab ref={decodeTabRef} onHistoryAdd={(e) => addHistory(e)} onLog={pushLog} />
              </TabsContent>
              <TabsContent value="analyze" className="mt-0">
                <SteganalysisTab />
              </TabsContent>
              <TabsContent value="visualize" className="mt-0">
                <PixelVisualizationTab />
              </TabsContent>
              <TabsContent value="metadata" className="mt-0">
                <MetadataTab />
              </TabsContent>
              <TabsContent value="attack" className="mt-0">
                <AttackSimulatorTab />
              </TabsContent>
              <TabsContent value="learn" className="mt-0">
                <LearnTab />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="lg:sticky lg:top-6 h-fit space-y-4">
            <ImagePreview
              image={image}
              onSampleLoad={handleSampleLoad}
              onClear={handleClear}
              activeTab={activeTab}
            />
            <AirgapIndicator />
            <EnginePanel scanCount={scanCount} lastScanMs={lastScanMs} />
            <Button
              onClick={handleWipeWorkspace}
              variant="outline"
              className="w-full font-mono text-[11px] gap-2 h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              OP-99 / WIPE WORKSPACE
            </Button>
            <Button
              onClick={handleExportReport}
              variant="outline"
              className="w-full font-mono text-[11px] gap-2 h-9 border-[hsl(var(--encode-accent))]/40 text-[hsl(var(--encode-accent))] hover:bg-[hsl(var(--encode-accent))]/10"
            >
              <Download className="h-3 w-3" />
              EXPORT REPORT
            </Button>
            <SystemLog entries={logs} onClear={() => setLogs([])} />
            <HistoryPanel entries={history} onClearHistory={() => setHistory([])} />
          </aside>
        </div>

        {/* Image Comparison */}
        {encodedCanvas && image && activeTab === "encode" && (
          <div className="mt-4">
            <ImageComparison originalImage={image} encodedCanvas={encodedCanvas} />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 border-t border-border/30 pt-4 grid sm:grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground/60">
          <div>
            <span className="text-muted-foreground/40">// build</span><br />
            steglab/2.1.0 · enterprise · {new Date().getFullYear()}.{(new Date().getMonth() + 1).toString().padStart(2, "0")}
          </div>
          <div className="sm:text-center">
            <span className="text-muted-foreground/40">// runtime</span><br />
            client-side · zero-egress · webcrypto.subtle
          </div>
          <div className="sm:text-right">
            <span className="text-muted-foreground/40">// engineered by</span><br />
            <span className="text-[hsl(var(--encode-accent))]">LITHICKKUMAR</span> · research &amp; education
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
