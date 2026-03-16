import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ViewMode = "rgb" | "red" | "green" | "blue" | "lsb-map" | "lsb-blue";

const VIEWS: { key: ViewMode; label: string; color: string }[] = [
  { key: "rgb", label: "RGB", color: "text-foreground" },
  { key: "red", label: "R", color: "text-red-400" },
  { key: "green", label: "G", color: "text-green-400" },
  { key: "blue", label: "B", color: "text-blue-400" },
  { key: "lsb-map", label: "LSB Map", color: "text-yellow-400" },
  { key: "lsb-blue", label: "LSB Blue", color: "text-[hsl(var(--encode-accent))]" },
];

export default function PixelVisualizationTab() {
  const [image, setImage] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("rgb");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  const loadImage = useCallback((file: File) => {
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => { setImgEl(img); renderView(img, viewMode); };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    toast.success("Image loaded");
  }, [viewMode]);

  const renderView = useCallback((img: HTMLImageElement, mode: ViewMode) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    if (mode === "rgb") return; // Show original

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      switch (mode) {
        case "red":
          data[i + 1] = 0; data[i + 2] = 0;
          break;
        case "green":
          data[i] = 0; data[i + 2] = 0;
          break;
        case "blue":
          data[i] = 0; data[i + 1] = 0;
          break;
        case "lsb-map": {
          const lsbR = data[i] & 1;
          const lsbG = data[i + 1] & 1;
          const lsbB = data[i + 2] & 1;
          data[i] = lsbR * 255;
          data[i + 1] = lsbG * 255;
          data[i + 2] = lsbB * 255;
          break;
        }
        case "lsb-blue": {
          const lsb = data[i + 2] & 1;
          data[i] = lsb * 0;
          data[i + 1] = lsb * 255;
          data[i + 2] = lsb * 255;
          data[i + 3] = 255;
          break;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, []);

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (imgEl) renderView(imgEl, mode);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Pixel Visualization</Label>
        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) loadImage(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`min-h-[120px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 mb-3 ${
            dragOver ? "border-purple-500 bg-purple-500/5" : "border-border/50 hover:border-purple-500/50"
          }`}
        >
          <div className="text-muted-foreground text-sm font-mono">
            {image ? `> ${image.name}` : "> Drop image to visualize"}
          </div>
          <Button variant="outline" className="text-xs font-mono border-purple-500/50 hover:bg-purple-500/10" onClick={(e) => e.stopPropagation()}>
            Browse Image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); }} className="hidden" />
        </div>

        {/* View mode buttons */}
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Button
              key={v.key}
              variant={viewMode === v.key ? "default" : "outline"}
              size="sm"
              onClick={() => handleViewChange(v.key)}
              className={`font-mono text-xs ${viewMode === v.key ? "bg-gradient-to-r from-purple-600 to-indigo-800" : ""}`}
            >
              <span className={v.color}>{v.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {imgEl && (
        <div className="card-glass rounded-xl p-5 space-y-2 animate-fade-in">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              // View: {VIEWS.find((v) => v.key === viewMode)?.label}
            </Label>
            <span className="text-xs text-muted-foreground font-mono">{imgEl.width}×{imgEl.height}</span>
          </div>
          <canvas ref={canvasRef} className="w-full rounded-lg border border-border/50" />
          <p className="text-xs text-muted-foreground font-mono">
            {viewMode === "lsb-map" && "Each pixel shows R/G/B least significant bits as full color channels"}
            {viewMode === "lsb-blue" && "Cyan = LSB bit is 1 • Black = LSB bit is 0 (blue channel only)"}
            {viewMode === "rgb" && "Original unmodified image"}
            {(viewMode === "red" || viewMode === "green" || viewMode === "blue") && `Isolated ${viewMode} channel`}
          </p>
        </div>
      )}
    </div>
  );
}
