import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { readBitsFromImageData, bitsToUint8Array, decryptMessage } from "@/lib/steganography";
import TerminalOutput from "./TerminalOutput";

export interface DecodeTabRef {
  clear: () => void;
}

const DecodeTab = forwardRef<DecodeTabRef>((props, ref) => {
  const [password, setPassword] = useState("");
  const [decodedMessage, setDecodedMessage] = useState("");
  const [decodedInfo, setDecodedInfo] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedFile, setDecodedFile] = useState<{ name: string; type: string; data: Uint8Array } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    setPassword("");
    setDecodedMessage("");
    setDecodedInfo("");
    setUploadedImage(null);
    setTerminalLines([]);
    setDecodedFile(null);
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

  const handleDownloadFile = () => {
    if (!decodedFile) return;
    const blob = new Blob([decodedFile.data.buffer as ArrayBuffer], { type: decodedFile.type || "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = decodedFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`File downloaded: ${decodedFile.name}`);
  };

  const handleDecode = async () => {
    const file = uploadedImage || fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Upload an image to decode");
      return;
    }

    setIsDecoding(true);
    setDecodedMessage("");
    setDecodedFile(null);
    setTerminalLines([
      "Initializing decoder...",
      `Loading image: ${file.name}`,
      "Scanning pixel data...",
    ]);

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

          setTerminalLines((prev) => [...prev, "Reading LSB header (32 bits)..."]);

          const headerBits = readBitsFromImageData(imgData, 32);
          const headerBytes = bitsToUint8Array(headerBits);
          const length =
            (headerBytes[0] << 24) |
            (headerBytes[1] << 16) |
            (headerBytes[2] << 8) |
            headerBytes[3];

          if (length <= 0 || length > 500_000) {
            setTerminalLines((prev) => [...prev, `ERROR: Invalid length header (${length})`, "No hidden data detected ✖"]);
            setIsDecoding(false);
            toast.error("No hidden data found in this image");
            return;
          }

          setTerminalLines((prev) => [
            ...prev,
            `Hidden data detected ✔ (${length.toLocaleString()} bytes)`,
            "Extracting hidden bits...",
          ]);

          const totalBits = (4 + length) * 8;
          const allBits = readBitsFromImageData(imgData, totalBits);
          const allBytes = bitsToUint8Array(allBits);
          const payload = new TextDecoder().decode(allBytes.slice(4));

          if (payload.startsWith("ENC:")) {
            setTerminalLines((prev) => [...prev, "Encrypted payload detected 🔒", "Attempting decryption..."]);
            const b64 = payload.slice(4);
            const pw = password.trim();
            if (!pw) {
              setTerminalLines((prev) => [...prev, "ERROR: Password required for decryption"]);
              setIsDecoding(false);
              toast.error("Message is encrypted. Provide password.");
              return;
            }
            try {
              const dec = await decryptMessage(pw, b64);
              // Check if decrypted content is a file
              if (dec.startsWith("FILE:")) {
                const parts = dec.split(":");
                const fileName = parts[1];
                const fileType = parts[2];
                const b64Data = dec.slice(`FILE:${fileName}:${fileType}:`.length);
                const binary = atob(b64Data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                setDecodedFile({ name: fileName, type: fileType, data: bytes });
                setDecodedInfo(`Decrypted hidden file: ${fileName}`);
                setTerminalLines((prev) => [...prev, `Decrypted file recovered: ${fileName}`, "Decode complete ✔"]);
              } else {
                setDecodedMessage(dec);
                setDecodedInfo("Decrypted using provided password");
                setTerminalLines((prev) => [...prev, "Decryption successful ✔", "Message recovered."]);
              }
              toast.success("Decoded successfully!");
            } catch {
              setTerminalLines((prev) => [...prev, "ERROR: Decryption failed — wrong password or corrupted data"]);
              setIsDecoding(false);
              toast.error("Decryption failed. Wrong password.");
              return;
            }
          } else if (payload.startsWith("FILE:")) {
            const parts = payload.split(":");
            const fileName = parts[1];
            const fileType = parts[2];
            const b64Data = payload.slice(`FILE:${fileName}:${fileType}:`.length);
            const binary = atob(b64Data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            setDecodedFile({ name: fileName, type: fileType, data: bytes });
            setDecodedInfo(`Hidden file recovered: ${fileName}`);
            setTerminalLines((prev) => [...prev, `File payload detected: ${fileName}`, "File extracted ✔"]);
            toast.success("Hidden file decoded!");
          } else if (payload.startsWith("PLAIN:")) {
            setDecodedMessage(payload.slice(6));
            setDecodedInfo("Plaintext message retrieved");
            setTerminalLines((prev) => [...prev, "Plaintext payload found", "Message recovered ✔"]);
            toast.success("Message decoded!");
          } else {
            setDecodedMessage(payload);
            setDecodedInfo("Raw payload (no marker found)");
            setTerminalLines((prev) => [...prev, "Raw data extracted (unknown format)", "Done."]);
            toast.success("Message decoded");
          }
        } catch (err) {
          setTerminalLines((prev) => [...prev, `ERROR: ${(err as Error).message}`]);
          toast.error("Decoding failed: " + (err as Error).message);
        } finally {
          setIsDecoding(false);
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
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </div>

        <div className="flex gap-3">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (if encrypted)"
            className="flex-1 bg-background/50"
          />
          <Button onClick={handleDecode} className="btn-decode" disabled={!uploadedImage || isDecoding}>
            {isDecoding ? "Decoding..." : "Decode"}
          </Button>
        </div>
      </div>

      {/* Terminal Output */}
      {terminalLines.length > 0 && (
        <div className="animate-fade-in">
          <TerminalOutput lines={terminalLines} />
        </div>
      )}

      {/* Decoded Message */}
      {decodedMessage && (
        <div className="card-glass rounded-xl p-6 space-y-4 animate-fade-in">
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Hidden Message</Label>
            <Textarea value={decodedMessage} readOnly className="min-h-[200px] bg-background/50" />
          </div>
          <div className="text-sm text-muted-foreground">{decodedInfo}</div>
        </div>
      )}

      {/* Decoded File */}
      {decodedFile && (
        <div className="card-glass rounded-xl p-6 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Hidden File Recovered</Label>
              <p className="font-mono text-[hsl(var(--decode-accent))]">{decodedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(decodedFile.data.length / 1024).toFixed(1)} KB • {decodedFile.type || "unknown"}
              </p>
            </div>
            <Button onClick={handleDownloadFile} className="btn-decode">
              ⬇️ Download File
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">{decodedInfo}</div>
        </div>
      )}
    </div>
  );
});

DecodeTab.displayName = "DecodeTab";

export default DecodeTab;
