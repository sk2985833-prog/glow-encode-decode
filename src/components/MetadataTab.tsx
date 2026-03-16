import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { extractEXIF } from "@/lib/steganography";
import TerminalOutput from "./TerminalOutput";

export default function MetadataTab() {
  const [image, setImage] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [fileInfo, setFileInfo] = useState<Record<string, string> | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback(async (file: File) => {
    setImage(file);
    setTerminalLines([
      "$ metadata-extract --deep",
      `Target: ${file.name}`,
      `Size: ${(file.size / 1024).toFixed(1)} KB`,
      `Type: ${file.type}`,
      "Scanning file headers...",
    ]);

    const info: Record<string, string> = {
      'File Name': file.name,
      'File Size': `${(file.size / 1024).toFixed(1)} KB`,
      'MIME Type': file.type,
      'Last Modified': file.lastModified ? new Date(file.lastModified).toISOString() : 'Unknown',
    };
    setFileInfo(info);

    const buffer = await file.arrayBuffer();
    const exif = extractEXIF(buffer);
    setMetadata(exif);

    const lines = Object.entries(exif).map(([k, v]) => `  ${k}: ${v}`);
    setTerminalLines((prev) => [
      ...prev,
      "EXIF data extracted:",
      ...lines,
      "ANALYSIS COMPLETE ✔",
    ]);

    toast.success("Metadata extracted");
  }, []);

  const handleCleanMetadata = () => {
    if (!image) return;
    // Re-encode through canvas to strip metadata
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `clean-${image.name.replace(/\.\w+$/, '')}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success("Clean image downloaded (metadata stripped)");
          }
        }, "image/png");
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(image);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-glass rounded-xl p-5">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Metadata Intelligence</Label>
        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`min-h-[120px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 mb-3 ${
            dragOver ? "border-orange-500 bg-orange-500/5" : "border-border/50 hover:border-orange-500/50"
          }`}
        >
          <div className="text-muted-foreground text-sm font-mono">
            {image ? `> ${image.name}` : "> Drop image to extract metadata"}
          </div>
          <Button variant="outline" className="text-xs font-mono border-orange-500/50 hover:bg-orange-500/10" onClick={(e) => e.stopPropagation()}>
            Browse Image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); }} className="hidden" />
        </div>

        {image && (
          <Button onClick={handleCleanMetadata} className="w-full font-mono text-xs bg-gradient-to-r from-orange-600 to-red-800 hover:opacity-90">
            🧹 Strip Metadata & Download Clean Image
          </Button>
        )}
      </div>

      {terminalLines.length > 0 && <TerminalOutput lines={terminalLines} />}

      {fileInfo && (
        <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// File Information</Label>
          <div className="space-y-1">
            {Object.entries(fileInfo).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs font-mono p-2 rounded bg-background/50 border border-border/30">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-[hsl(var(--encode-accent))]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {metadata && (
        <div className="card-glass rounded-xl p-5 space-y-3 animate-fade-in">
          <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">// EXIF Metadata</Label>
          <div className="space-y-1">
            {Object.entries(metadata).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs font-mono p-2 rounded bg-background/50 border border-border/30">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-[hsl(var(--encode-accent))]">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            ⚠ Metadata can reveal camera, location, and editing history
          </p>
        </div>
      )}
    </div>
  );
}
