import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  stringToUint8Array,
  uint8ToBitArray,
  writeBitsToImageData,
  encryptMessage,
  generatePassword,
  calculateCapacity,
} from "@/lib/steganography";

interface EncodeTabProps {
  image: HTMLImageElement | null;
  onImageLoad: (img: HTMLImageElement) => void;
}

export default function EncodeTab({ image, onImageLoad }: EncodeTabProps) {
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState(0);
  const [encoding, setEncoding] = useState(false);
  const [encodedCanvas, setEncodedCanvas] = useState<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const capacity = image ? calculateCapacity(image.width, image.height) : 0;

  const loadImage = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        onImageLoad(img);
        URL.revokeObjectURL(url);
        toast.success(`Image loaded: ${img.width}×${img.height}`);
      };
      img.src = url;
    },
    [onImageLoad]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleGenerate = () => {
    setPassword(generatePassword());
    toast.success("Password generated");
  };

  const handleEncode = async () => {
    if (!image) {
      toast.error("Load an image first");
      return;
    }
    if (!message.trim()) {
      toast.error("Type a message to embed");
      return;
    }

    setEncoding(true);
    setProgress(0);

    try {
      let payloadStr = message;
      const pw = password.trim();

      if (pw) {
        payloadStr = await encryptMessage(pw, message);
        payloadStr = "ENC:" + payloadStr;
      } else {
        payloadStr = "PLAIN:" + payloadStr;
      }

      const payloadBytes = stringToUint8Array(payloadStr);
      const length = payloadBytes.length;

      if (length > capacity) {
        toast.error(`Message too long. Max: ${capacity} bytes`);
        setEncoding(false);
        return;
      }

      // Create length header (32-bit)
      const header = new Uint8Array(4);
      header[0] = (length >> 24) & 0xff;
      header[1] = (length >> 16) & 0xff;
      header[2] = (length >> 8) & 0xff;
      header[3] = length & 0xff;

      const combined = new Uint8Array(4 + payloadBytes.length);
      combined.set(header, 0);
      combined.set(payloadBytes, 4);

      const bits = uint8ToBitArray(combined);

      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          writeBitsToImageData(imgData, bits, (p) => setProgress(p));
          ctx.putImageData(imgData, 0, 0);
          resolve();
        }, 60);
      });

      setEncodedCanvas(canvas);
      toast.success("Encoding complete!");
    } catch (err) {
      toast.error("Encoding failed: " + (err as Error).message);
    } finally {
      setEncoding(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!encodedCanvas) return;

    encodedCanvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `stego-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Image downloaded");
      }
    }, "image/png");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-glass rounded-xl p-6">
        <Label className="text-sm text-muted-foreground mb-3 block">Upload Image</Label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`min-h-[200px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 ${
            dragOver
              ? "border-[hsl(var(--encode-accent))] bg-[hsl(var(--encode-accent))]/5 glow-encode"
              : "border-border/50 hover:border-[hsl(var(--encode-accent))]/50"
          }`}
        >
          <div className="text-muted-foreground">Drag & drop an image, or click to browse</div>
          <Button variant="outline" className="btn-encode" onClick={(e) => e.stopPropagation()}>
            Browse Image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {image && (
            <div className="text-sm text-muted-foreground">
              {image.width}×{image.height} ({Math.round((image.width * image.height) / 1000)}k px)
            </div>
          )}
        </div>
      </div>

      <div className="card-glass rounded-xl p-6 space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Secret Message</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type the message to hide..."
            className="min-h-[120px] bg-background/50"
          />
          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
            <span>
              {message.length} / {capacity} chars
            </span>
            <span>One bit per pixel (LSB blue channel)</span>
          </div>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Password (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to encrypt message"
              className="flex-1 bg-background/50"
            />
            <Button onClick={handleGenerate} variant="outline" className="btn-encode">
              Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {password
              ? "Password present — message will be encrypted"
              : "No password — message stored as plaintext"}
          </p>
        </div>

        {progress > 0 && (
          <div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button onClick={handleEncode} disabled={encoding || !image} className="btn-encode">
            {encoding ? "Encoding..." : "Encode"}
          </Button>
          {encodedCanvas && (
            <Button onClick={handleDownload} variant="outline" className="btn-encode">
              Download Image
            </Button>
          )}
        </div>
      </div>

      {encodedCanvas && (
        <div className="card-glass rounded-xl p-6">
          <Label className="text-sm text-muted-foreground mb-3 block">Encoded Result</Label>
          <canvas
            ref={(ref) => {
              if (ref && encodedCanvas) {
                ref.width = encodedCanvas.width;
                ref.height = encodedCanvas.height;
                const ctx = ref.getContext("2d");
                if (ctx) ctx.drawImage(encodedCanvas, 0, 0);
              }
            }}
            className="w-full rounded-lg border border-border/50"
          />
        </div>
      )}
    </div>
  );
}
