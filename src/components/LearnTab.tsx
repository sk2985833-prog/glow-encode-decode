import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function LearnTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* What is Steganography */}
      <div className="card-glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} What is Steganography?
        </h2>
        <p className="text-muted-foreground leading-relaxed text-sm">
          Steganography is the practice of hiding secret information within an ordinary, non-secret medium — 
          such as an image, audio file, or video — so that no one, apart from the sender and intended recipient, 
          suspects the existence of the hidden message. Unlike encryption, which makes data unreadable, 
          steganography hides the very <span className="text-[hsl(var(--encode-accent))] font-semibold">existence</span> of the data.
        </p>
        <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/30 font-mono text-xs text-muted-foreground">
          <p className="text-[hsl(var(--decode-accent))]">// The word comes from Greek:</p>
          <p>steganos (στεγανός) = "covered" or "concealed"</p>
          <p>graphein (γράφειν) = "writing"</p>
        </div>
      </div>

      {/* LSB Explained */}
      <div className="card-glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} How LSB Encoding Works
        </h2>
        <p className="text-muted-foreground leading-relaxed text-sm mb-4">
          LSB (Least Significant Bit) is the most common steganography technique for images. 
          Each pixel in an image stores color values (Red, Green, Blue) as 8-bit numbers (0-255). 
          The last bit of each value has minimal impact on the visible color.
        </p>

        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-background/50 border border-border/30 font-mono text-xs">
            <p className="text-[hsl(var(--decode-accent))] mb-2">// Example: Hiding '1' in a blue channel</p>
            <p>Original pixel blue value: <span className="text-[hsl(var(--encode-accent))]">1010110<span className="text-destructive font-bold">0</span></span> (172)</p>
            <p>Modified pixel blue value: <span className="text-[hsl(var(--encode-accent))]">1010110<span className="text-[hsl(var(--decode-accent))] font-bold">1</span></span> (173)</p>
            <p className="mt-2 text-muted-foreground">// Difference: 1/255 = 0.39% — invisible to human eye</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <div className="w-8 h-8 mx-auto rounded mb-2" style={{ backgroundColor: "rgb(100,150,172)" }} />
              <p className="text-muted-foreground font-mono">Original</p>
              <p className="text-muted-foreground/60">Blue: 172</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <div className="w-8 h-8 mx-auto rounded mb-2" style={{ backgroundColor: "rgb(100,150,173)" }} />
              <p className="text-muted-foreground font-mono">Modified</p>
              <p className="text-muted-foreground/60">Blue: 173</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30">
              <div className="text-2xl mb-1">👁️</div>
              <p className="text-muted-foreground font-mono">Identical</p>
              <p className="text-muted-foreground/60">to humans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Dive */}
      <div className="card-glass rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} Deep Dive
        </h2>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="history" className="border-border/30">
            <AccordionTrigger className="text-sm hover:text-[hsl(var(--encode-accent))]">
              📜 History of Steganography
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Ancient Greece (440 BC):</strong> Histiaeus shaved a slave's head, tattooed a message, waited for hair to regrow, and sent him to deliver the message.</p>
              <p><strong>Invisible Ink (WWII):</strong> Spies used lemon juice, milk, and chemical compounds to write invisible messages between lines of ordinary letters.</p>
              <p><strong>Microdots (Cold War):</strong> Photographs were shrunk to the size of a period and embedded in documents.</p>
              <p><strong>Digital Era (1990s+):</strong> With the rise of digital media, steganography moved to hiding data in images, audio, video, and network protocols.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="types" className="border-border/30">
            <AccordionTrigger className="text-sm hover:text-[hsl(var(--encode-accent))]">
              🔧 Types of Digital Steganography
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Image Steganography (LSB):</strong> Hides data in pixel values. Most common. Used in this app.</p>
              <p><strong>Audio Steganography:</strong> Embeds data in audio samples using echo hiding or phase coding.</p>
              <p><strong>Video Steganography:</strong> Hides data across video frames using temporal redundancy.</p>
              <p><strong>Network Steganography:</strong> Hides data in network protocol headers or timing patterns.</p>
              <p><strong>Text Steganography:</strong> Uses zero-width characters, whitespace patterns, or synonym substitution.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="security" className="border-border/30">
            <AccordionTrigger className="text-sm hover:text-[hsl(var(--encode-accent))]">
              ⚠️ Security Considerations
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Steganalysis:</strong> Statistical analysis can detect LSB modifications. Tools like StegExpose can identify anomalies in pixel distributions.</p>
              <p><strong>Compression Risk:</strong> JPEG compression destroys LSB-hidden data. Always use lossless formats (PNG, BMP).</p>
              <p><strong>Encryption is Essential:</strong> Steganography alone is NOT secure. Always encrypt your message before hiding it.</p>
              <p><strong>Metadata Leaks:</strong> Image metadata (EXIF) can reveal editing software, timestamps, and GPS coordinates.</p>
              <p><strong>Capacity Limits:</strong> Hiding too much data creates detectable statistical anomalies. A safe limit is ~10% of available pixels.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ethics" className="border-border/30">
            <AccordionTrigger className="text-sm hover:text-[hsl(var(--encode-accent))]">
              ⚖️ Legal & Ethical Use
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Legitimate Uses:</strong> Digital watermarking, copyright protection, secure whistleblowing, privacy-preserving communication, academic research.</p>
              <p><strong>Illegal Uses:</strong> Hiding illegal content, bypassing monitoring systems for criminal purposes, corporate espionage.</p>
              <p><strong>Legal Status:</strong> Steganography itself is legal in most countries, but its misuse for illegal activities is prosecutable.</p>
              <p className="text-[hsl(var(--decode-accent))] font-semibold mt-2">Always use steganography responsibly and ethically.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="app" className="border-border/30">
            <AccordionTrigger className="text-sm hover:text-[hsl(var(--encode-accent))]">
              🛠️ How This App Works
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Encoding:</strong> Your message → (optional AES-256 encryption) → binary conversion → LSB embedding in blue channel → PNG output</p>
              <p><strong>Decoding:</strong> Read LSB blue channel → extract binary → convert to text → (optional AES-256 decryption) → original message</p>
              <p><strong>Encryption:</strong> AES-256-GCM with PBKDF2 key derivation (250,000 iterations). Random salt + IV for each encryption.</p>
              <p><strong>Privacy:</strong> All processing happens 100% in your browser. No data is ever sent to any server.</p>
              <p><strong>File Support:</strong> You can hide files (PDF, ZIP, TXT, images) — they are converted to binary and embedded the same way.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
