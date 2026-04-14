import { useState, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Shield, Terminal, Lock, Search, Zap } from "lucide-react";

type TabValue = "encode" | "decode" | "analyze" | "visualize" | "metadata" | "attack" | "learn";

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("encode");
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const decodeTabRef = useRef<DecodeTabRef | null>(null);

  const addHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory((prev) => [
      { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev,
    ].slice(0, 10));
  }, []);

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
    img.onload = () => { setImage(img); toast.success("Sample image loaded"); };
    img.src = url;
  };

  const handleClear = () => {
    setImage(null);
    setEncodedCanvas(null);
    if (activeTab === "decode" && decodeTabRef.current) decodeTabRef.current.clear();
    toast.success("Cleared");
  };

  const tabClass = (tab: TabValue) => {
    const active = activeTab === tab;
    if (!active) return "text-xs font-mono";
    if (tab === "encode") return "text-xs font-mono tab-active-encode";
    if (tab === "decode") return "text-xs font-mono tab-active-decode";
    return "text-xs font-mono tab-active-encode";
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <CyberGrid />
      <StatusBar />

      <div className="max-w-7xl mx-auto px-4 py-6 relative z-10 flex-1">
        {/* Hero Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--encode-accent))] to-[hsl(var(--decode-accent))] flex items-center justify-center shadow-lg shadow-[hsl(var(--encode-accent))]/20">
                <Shield className="h-6 w-6 text-background" />
              </div>
              <div>
                <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-2">
                  StegLab
                  <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--encode-accent))]/10 text-[hsl(var(--encode-accent))] border border-[hsl(var(--encode-accent))]/20 animate-pulse">
                    v2.1
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground font-mono">Cyber Intelligence & Steganography Command Center</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/50">
              <Terminal className="h-3 w-3" />
              <span className="hidden sm:inline">Client-side • AES-256 • Multi-algorithm</span>
            </div>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setActiveTab("encode")}
              className="btn-encode font-mono text-sm gap-2 px-6 py-5 shadow-lg shadow-[hsl(var(--encode-accent))]/20 hover:shadow-[hsl(var(--encode-accent))]/40 transition-all"
            >
              <Lock className="h-4 w-4" />
              🚀 Try Encode
            </Button>
            <Button
              onClick={() => setActiveTab("decode")}
              className="btn-decode font-mono text-sm gap-2 px-6 py-5 shadow-lg shadow-[hsl(var(--decode-accent))]/20 hover:shadow-[hsl(var(--decode-accent))]/40 transition-all"
            >
              <Search className="h-4 w-4" />
              🔍 Decode Secret
            </Button>
            <Button
              onClick={() => setActiveTab("attack")}
              variant="outline"
              className="font-mono text-sm gap-2 px-6 py-5 border-destructive/40 text-destructive hover:bg-destructive/10 shadow-lg hover:shadow-destructive/20 transition-all"
            >
              <Zap className="h-4 w-4" />
              ⚔ Test Security
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-4">
          <div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
              <TabsList className="grid w-full grid-cols-7 mb-4 h-10 bg-card/60 backdrop-blur-sm">
                <TabsTrigger value="encode" className={tabClass("encode")}>🔒 Encode</TabsTrigger>
                <TabsTrigger value="decode" className={tabClass("decode")}>🔓 Decode</TabsTrigger>
                <TabsTrigger value="analyze" className={tabClass("analyze")}>🔍 Analyze</TabsTrigger>
                <TabsTrigger value="visualize" className={tabClass("visualize")}>👁 Pixels</TabsTrigger>
                <TabsTrigger value="metadata" className={tabClass("metadata")}>📋 EXIF</TabsTrigger>
                <TabsTrigger value="attack" className={tabClass("attack")}>⚔ Attack</TabsTrigger>
                <TabsTrigger value="learn" className={tabClass("learn")}>🎓 Learn</TabsTrigger>
              </TabsList>

              <TabsContent value="encode" className="mt-0">
                <EncodeTab
                  image={image}
                  onImageLoad={setImage}
                  onEncoded={setEncodedCanvas}
                  onHistoryAdd={(e) => addHistory(e)}
                />
              </TabsContent>
              <TabsContent value="decode" className="mt-0">
                <DecodeTab ref={decodeTabRef} onHistoryAdd={(e) => addHistory(e)} />
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
        <footer className="mt-10 text-center text-xs text-muted-foreground space-y-1 font-mono">
          <p>© 2025 StegLab — Advanced Steganography & Steganalysis Toolkit</p>
          <p className="text-muted-foreground/50">⚠ Use responsibly. Respect privacy and legal regulations.</p>
          <p className="mt-2">
            Developed by <span className="font-semibold text-[hsl(var(--encode-accent))]">Lithickkumar</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
