import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calculateCapacity } from "@/lib/steganography";

interface ImagePreviewProps {
  image: HTMLImageElement | null;
  onSampleLoad: () => void;
  onClear: () => void;
  activeTab: string;
}

export default function ImagePreview({ image, onSampleLoad, onClear, activeTab }: ImagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const maxW = 360;
      const scale = image.width > maxW ? maxW / image.width : 1;
      canvas.width = image.width * scale;
      canvas.height = image.height * scale;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else if (!image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [image]);

  const capacity = image ? calculateCapacity(image.width, image.height) : 0;
  const isEncode = activeTab === "encode";

  return (
    <div className="space-y-3">
      <div className="card-glass rounded-xl p-4">
        <Label className="text-xs text-muted-foreground mb-2 block font-mono uppercase tracking-wider">// Image Preview</Label>
        <div className="w-full aspect-[4/3] rounded-lg border border-border/50 bg-background/50 flex items-center justify-center overflow-hidden">
          <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" width={360} height={270} />
        </div>
        {image && (
          <div className="mt-3 p-2 rounded-lg bg-background/50 border border-border/30 font-mono text-xs space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Resolution</span>
              <span className="text-[hsl(var(--encode-accent))]">{image.width}×{image.height}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Capacity</span>
              <span className="text-[hsl(var(--encode-accent))]">{capacity.toLocaleString()} bytes</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Pixels</span>
              <span className="text-[hsl(var(--encode-accent))]">{(image.width * image.height).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card-glass rounded-xl p-4 space-y-2">
        <Label className="text-xs text-muted-foreground block font-mono uppercase tracking-wider">// Quick Actions</Label>
        <div className="flex flex-col gap-1.5">
          <Button onClick={onClear} variant="outline" size="sm" className={`font-mono text-xs ${isEncode ? "btn-encode" : "btn-decode"}`}>
            Clear All
          </Button>
          <Button onClick={onSampleLoad} variant="outline" size="sm" className={`font-mono text-xs ${isEncode ? "btn-encode" : "btn-decode"}`}>
            Load Sample Image
          </Button>
        </div>
      </div>

      {/* System info */}
      <div className="card-glass rounded-xl p-4">
        <Label className="text-xs text-muted-foreground block font-mono uppercase tracking-wider mb-2">// System Info</Label>
        <div className="space-y-1 text-xs font-mono text-muted-foreground/60">
          <p>Engine: Web Crypto API</p>
          <p>Encryption: AES-256-GCM</p>
          <p>KDF: PBKDF2 (250k iter)</p>
          <p>Processing: 100% client-side</p>
          <p className="text-[hsl(var(--decode-accent))]">● Secure connection</p>
        </div>
      </div>
    </div>
  );
}
