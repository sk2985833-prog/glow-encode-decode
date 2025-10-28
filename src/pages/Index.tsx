import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import EncodeTab from "@/components/EncodeTab";
import DecodeTab, { DecodeTabRef } from "@/components/DecodeTab";
import ImagePreview from "@/components/ImagePreview";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [activeTab, setActiveTab] = useState<"encode" | "decode">("encode");
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
    img.onload = () => {
      setImage(img);
      toast.success("Sample image loaded");
    };
    img.src = url;
  };

  const handleClear = () => {
    setImage(null);
    if (activeTab === "decode" && decodeTabRef.current) {
      decodeTabRef.current.clear();
    }
    toast.success("Cleared");
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Steganography Online</h1>
            <p className="text-muted-foreground">Hide secrets in images with LSB encoding</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.open("https://how-lsb-work.lovable.app/", "_blank")}
            className="flex-shrink-0"
          >
            Learn How It Works
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          <div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "encode" | "decode")}>
              <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
                <TabsTrigger
                  value="encode"
                  className={`text-base transition-all duration-300 ${
                    activeTab === "encode" ? "tab-active-encode" : ""
                  }`}
                >
                  Encode
                </TabsTrigger>
                <TabsTrigger
                  value="decode"
                  className={`text-base transition-all duration-300 ${
                    activeTab === "decode" ? "tab-active-decode" : ""
                  }`}
                >
                  Decode
                </TabsTrigger>
              </TabsList>

              <TabsContent value="encode" className="mt-0">
                <EncodeTab image={image} onImageLoad={setImage} />
              </TabsContent>

              <TabsContent value="decode" className="mt-0">
                <DecodeTab ref={decodeTabRef} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="lg:sticky lg:top-8 h-fit">
            <ImagePreview
              image={image}
              onSampleLoad={handleSampleLoad}
              onClear={handleClear}
              activeTab={activeTab}
            />
          </aside>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground space-y-2">
          <p className="text-sm">© 2025 LSB Steganography Project. Created for educational purposes.</p>
          <p className="text-sm">⚠️ Use responsibly and ethically. Respect privacy and legal regulations.</p>
          <p className="text-base mt-3">
            Developed by <span className="font-semibold text-cyan-400">Lithickkumar</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
