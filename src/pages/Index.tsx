import { useState, useRef } from "react";
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
import { toast } from "sonner";
import { Shield, Terminal } from "lucide-react";

type TabValue = "encode" | "decode" | "analyze" | "visualize" | "metadata" | "attack" | "learn";

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("encode");
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const decodeTabRef = useRef<DecodeTabRef | null>(null);

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
    <div className="min-h-screen relative">
      <CyberGrid />

      <div className="max-w-7xl mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--encode-accent))] to-[hsl(var(--decode-accent))] flex items-center justify-center">
              <Shield className="h-5 w-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
                StegLab
                <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--encode-accent))]/10 text-[hsl(var(--encode-accent))] border border-[hsl(var(--encode-accent))]/20">
                  v2.0
                </span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono">Advanced Steganography & Steganalysis Toolkit</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/50">
            <Terminal className="h-3 w-3" />
            <span className="hidden sm:inline">Client-side • AES-256 • Multi-algorithm</span>
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
                <EncodeTab image={image} onImageLoad={setImage} onEncoded={setEncodedCanvas} />
              </TabsContent>
              <TabsContent value="decode" className="mt-0">
                <DecodeTab ref={decodeTabRef} />
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
