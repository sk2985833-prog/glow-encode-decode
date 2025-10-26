import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { readBitsFromImageData, bitsToUint8Array, decryptMessage } from "@/lib/steganography";

export interface DecodeTabRef {
  clear: () => void;
}

const DecodeTab = forwardRef<DecodeTabRef>((props, ref) => {
  const [password, setPassword] = useState("");
  const [decodedMessage, setDecodedMessage] = useState("");
  const [decodedInfo, setDecodedInfo] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    setPassword("");
    setDecodedMessage("");
    setDecodedInfo("");
    setUploadedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useImperativeHandle(ref, () => ({
    clear: handleClear
  }));

  const loadImage = useCallback((file: File) => {
    setUploadedImage(file);
    toast.success("Image loaded for decoding");
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDecode = async () => {
    const file = uploadedImage || fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Upload an image to decode");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Read 32-bit length header
          const headerBits = readBitsFromImageData(imgData, 32);
          const headerBytes = bitsToUint8Array(headerBits);
          const length =
            (headerBytes[0] << 24) |
            (headerBytes[1] << 16) |
            (headerBytes[2] << 8) |
            headerBytes[3];

          if (length <= 0 || length > 10_000_000) {
            throw new Error("Invalid or suspicious message length: " + length);
          }

          const totalBits = (4 + length) * 8;
          const allBits = readBitsFromImageData(imgData, totalBits);
          const allBytes = bitsToUint8Array(allBits);
          const payload = new TextDecoder().decode(allBytes.slice(4));

          if (payload.startsWith("ENC:")) {
            const b64 = payload.slice(4);
            const pw = password.trim();
            if (!pw) {
              throw new Error("Message is encrypted. Provide password.");
            }
            try {
              const dec = await decryptMessage(pw, b64);
              setDecodedMessage(dec);
              setDecodedInfo("Decrypted using provided password");
              toast.success("Message decrypted successfully");
            } catch (err) {
              throw new Error("Decryption failed. Wrong password or corrupted data.");
            }
          } else if (payload.startsWith("PLAIN:")) {
            setDecodedMessage(payload.slice(6));
            setDecodedInfo("Plaintext message retrieved");
            toast.success("Message decoded successfully");
          } else {
            setDecodedMessage(payload);
            setDecodedInfo("Raw payload (no marker found)");
            toast.success("Message decoded");
          }
        } catch (err) {
          toast.error("Decoding failed: " + (err as Error).message);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-glass rounded-xl p-6">
        <Label className="text-sm text-muted-foreground mb-3 block">Upload Encoded Image</Label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`min-h-[180px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 mb-4 ${
            dragOver
              ? "border-[hsl(var(--decode-accent))] bg-[hsl(var(--decode-accent))]/5 glow-decode"
              : "border-border/50 hover:border-[hsl(var(--decode-accent))]/50"
          }`}
        >
          <div className="text-muted-foreground">
            {uploadedImage ? uploadedImage.name : "Drag & drop encoded image, or click to browse"}
          </div>
          <Button variant="outline" className="btn-decode" onClick={(e) => e.stopPropagation()}>
            Browse Image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="flex gap-3">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (if encrypted)"
            className="flex-1 bg-background/50"
          />
          <Button onClick={handleDecode} className="btn-decode" disabled={!uploadedImage}>
            Decode
          </Button>
        </div>
      </div>

      {decodedMessage && (
        <div className="card-glass rounded-xl p-6 space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Hidden Message</Label>
            <Textarea
              value={decodedMessage}
              readOnly
              className="min-h-[200px] bg-background/50"
            />
          </div>
          <div className="text-sm text-muted-foreground">{decodedInfo}</div>
        </div>
      )}
    </div>
  );
});

DecodeTab.displayName = "DecodeTab";

export default DecodeTab;
