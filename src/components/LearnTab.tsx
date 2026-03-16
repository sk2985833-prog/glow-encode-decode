import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function LearnTab() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* What is Steganography */}
      <div className="card-glass rounded-xl p-5">
        <h2 className="text-sm font-bold mb-2 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} What is Steganography?
        </h2>
        <p className="text-muted-foreground leading-relaxed text-xs">
          Steganography is the practice of hiding secret information within an ordinary medium — 
          such as an image, audio file, or video — so that no one suspects the existence of the hidden message. 
          Unlike encryption, which makes data unreadable, steganography hides the very{" "}
          <span className="text-[hsl(var(--encode-accent))] font-semibold">existence</span> of the data.
        </p>
        <div className="mt-3 p-2 rounded-lg bg-background/50 border border-border/30 font-mono text-xs text-muted-foreground">
          <p className="text-[hsl(var(--decode-accent))]">// Etymology:</p>
          <p>steganos (στεγανός) = "covered"</p>
          <p>graphein (γράφειν) = "writing"</p>
        </div>
      </div>

      {/* LSB Explained */}
      <div className="card-glass rounded-xl p-5">
        <h2 className="text-sm font-bold mb-2 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} How LSB Encoding Works
        </h2>
        <p className="text-muted-foreground leading-relaxed text-xs mb-3">
          Each pixel stores color as 8-bit numbers (0-255). The last bit has minimal visual impact.
        </p>
        <div className="p-2 rounded-lg bg-background/50 border border-border/30 font-mono text-[10px]">
          <p className="text-[hsl(var(--decode-accent))] mb-1">// Hiding '1' in blue channel</p>
          <p>Original: <span className="text-[hsl(var(--encode-accent))]">1010110<span className="text-destructive font-bold">0</span></span> (172)</p>
          <p>Modified: <span className="text-[hsl(var(--encode-accent))]">1010110<span className="text-[hsl(var(--decode-accent))] font-bold">1</span></span> (173)</p>
          <p className="mt-1 text-muted-foreground">// Δ = 0.39% — invisible to human eye</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs mt-3">
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="w-6 h-6 mx-auto rounded mb-1" style={{ backgroundColor: "rgb(100,150,172)" }} />
            <p className="text-muted-foreground font-mono text-[10px]">Original</p>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="w-6 h-6 mx-auto rounded mb-1" style={{ backgroundColor: "rgb(100,150,173)" }} />
            <p className="text-muted-foreground font-mono text-[10px]">Modified</p>
          </div>
          <div className="p-2 rounded-lg bg-background/50 border border-border/30">
            <div className="text-lg mb-0.5">👁️</div>
            <p className="text-muted-foreground font-mono text-[10px]">Identical</p>
          </div>
        </div>
      </div>

      {/* StegLab Features */}
      <div className="card-glass rounded-xl p-5">
        <h2 className="text-sm font-bold mb-2 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} StegLab Capabilities
        </h2>
        <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
          {[
            { icon: "🔒", label: "AES-256 Encryption" },
            { icon: "📄", label: "File Hiding" },
            { icon: "🎲", label: "Random Pixel LSB" },
            { icon: "🔬", label: "Edge-based Embed" },
            { icon: "🔍", label: "Steganalysis Scanner" },
            { icon: "👁", label: "Pixel Visualization" },
            { icon: "📋", label: "EXIF Extraction" },
            { icon: "⚔", label: "Attack Simulator" },
            { icon: "🧹", label: "Metadata Cleaner" },
            { icon: "📊", label: "Entropy Analysis" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border/30">
              <span>{f.icon}</span>
              <span className="text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deep Dive */}
      <div className="card-glass rounded-xl p-5">
        <h2 className="text-sm font-bold mb-2 font-mono text-[hsl(var(--encode-accent))]">
          {'>'} Deep Dive
        </h2>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="algorithms" className="border-border/30">
            <AccordionTrigger className="text-xs hover:text-[hsl(var(--encode-accent))] font-mono">
              ⚙️ Encoding Algorithms Explained
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 font-mono">
              <p><strong className="text-[hsl(var(--encode-accent))]">LSB (Standard):</strong> Replaces the least significant bit of the blue channel. Fast, simple, but detectable by statistical analysis.</p>
              <p><strong className="text-[hsl(var(--encode-accent))]">Multi-bit LSB:</strong> Uses 2 bits per channel across R, G, B — 6× capacity but more visually detectable.</p>
              <p><strong className="text-[hsl(var(--encode-accent))]">Random Pixel:</strong> Uses a key-based pseudo-random pixel order. Same capacity as LSB but much harder to detect since the pattern isn't sequential.</p>
              <p><strong className="text-[hsl(var(--encode-accent))]">Edge-based:</strong> Embeds data only in high-contrast edges where modifications are least noticeable. Best steganalysis resistance.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="history" className="border-border/30">
            <AccordionTrigger className="text-xs hover:text-[hsl(var(--encode-accent))] font-mono">
              📜 History of Steganography
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 font-mono">
              <p><strong>440 BC:</strong> Histiaeus tattooed a message on a slave's shaved head.</p>
              <p><strong>WWII:</strong> Invisible ink (lemon juice, milk) between lines of letters.</p>
              <p><strong>Cold War:</strong> Microdots — photographs shrunk to the size of a period.</p>
              <p><strong>1990s+:</strong> Digital steganography in images, audio, video, and network protocols.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="steganalysis" className="border-border/30">
            <AccordionTrigger className="text-xs hover:text-[hsl(var(--encode-accent))] font-mono">
              🔍 Steganalysis Techniques
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 font-mono">
              <p><strong>Chi-Square Attack:</strong> Compares adjacent pixel value pairs (PoV). LSB embedding equalizes these pairs.</p>
              <p><strong>Entropy Analysis:</strong> Measures randomness in pixel values. Hidden data increases entropy toward 8.0.</p>
              <p><strong>LSB Flip Rate:</strong> Measures how often adjacent LSBs change. Random data produces ~50% flip rate.</p>
              <p><strong>Histogram Analysis:</strong> Visualizes value distribution. Stego images show suspiciously uniform even/odd pairs.</p>
              <p><strong>RS Analysis:</strong> Classifies pixel groups as Regular/Singular. Stego images shift the R/S ratio.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="security" className="border-border/30">
            <AccordionTrigger className="text-xs hover:text-[hsl(var(--encode-accent))] font-mono">
              ⚠️ Security Considerations
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 font-mono">
              <p><strong>Always encrypt:</strong> Steganography alone is NOT secure. AES-256 encryption is essential.</p>
              <p><strong>Compression risk:</strong> JPEG compression destroys LSB data. Use PNG only.</p>
              <p><strong>Metadata leaks:</strong> EXIF data reveals editing software, timestamps, GPS.</p>
              <p><strong>Capacity limits:</strong> Embedding more than ~10% creates detectable anomalies.</p>
              <p><strong>Social media:</strong> Platforms re-compress images, destroying hidden data.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ethics" className="border-border/30">
            <AccordionTrigger className="text-xs hover:text-[hsl(var(--encode-accent))] font-mono">
              ⚖️ Legal & Ethical Use
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 font-mono">
              <p><strong>Legitimate:</strong> Watermarking, copyright protection, secure whistleblowing, privacy, research.</p>
              <p><strong>Illegal:</strong> Hiding illegal content, bypassing monitoring, espionage.</p>
              <p className="text-[hsl(var(--decode-accent))] font-semibold">Always use responsibly and ethically.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="app" className="border-border/30">
            <AccordionTrigger className="text-xs hover:text-[hsl(var(--encode-accent))] font-mono">
              🛠️ How StegLab Works
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 font-mono">
              <p><strong>Pipeline:</strong> Message → AES-256 → Binary → LSB Embedding → PNG</p>
              <p><strong>Decryption:</strong> PBKDF2 (250k iterations) + AES-256-GCM</p>
              <p><strong>Algorithms:</strong> LSB, Multi-bit, Random Pixel, Edge-based</p>
              <p><strong>Analysis:</strong> Entropy, Chi-Square, Histogram, LSB flip rate</p>
              <p><strong>Privacy:</strong> 100% client-side. Zero data transmission.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
