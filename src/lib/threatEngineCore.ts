// Local mirror of the edge function's classifier.
// Kept in sync intentionally; Deno can't import from src/, so duplication is by design.

export type EncType = "base64" | "url" | "hex" | "binary";
export type ThreatType =
  | "XSS" | "SQLi" | "HTML_INJECTION" | "EVENT_HANDLER"
  | "COMMAND_INJECTION" | "PATH_TRAVERSAL" | "SSRF" | "SUSPICIOUS" | "NONE";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "NONE";

export interface SigHit { id: string; name: string; weight: number; match: string }
export interface Stage  { name: string; ms: number; detail: string }

export interface AnalyzeResult {
  status: "success";
  source: "local" | "cloud";
  threat: ThreatType;
  severity: Severity;
  confidence: number;
  analysis: string;
  impact: string;
  recommendation: string;
  hits: SigHit[];
  stages: Stage[];
  signaturesLoaded: number;
  totalMs: number;
}

interface Signature { id: string; name: string; threat: Exclude<ThreatType,"NONE">; weight: number; pattern: RegExp }

const SIGNATURES: Signature[] = [
  { id: "xss.script",         name: "<script> tag",         threat: "XSS",               weight: 0.9,  pattern: /<\s*script[\s>]/i },
  { id: "xss.svg-onload",     name: "SVG onload payload",   threat: "XSS",               weight: 0.85, pattern: /<\s*svg[^>]*\bon\w+\s*=/i },
  { id: "xss.javascript-uri", name: "javascript: URI",      threat: "XSS",               weight: 0.8,  pattern: /javascript\s*:/i },
  { id: "xss.iframe-src",     name: "<iframe src=...>",     threat: "XSS",               weight: 0.7,  pattern: /<\s*iframe[^>]*\bsrc\s*=/i },
  { id: "xss.img-onerror",    name: "<img onerror>",        threat: "XSS",               weight: 0.85, pattern: /<\s*img[^>]*\bonerror\s*=/i },
  { id: "evt.handler",        name: "Inline event handler", threat: "EVENT_HANDLER",     weight: 0.7,  pattern: /\bon(?:click|load|error|mouseover|focus|blur|submit)\s*=/i },
  { id: "sql.union",          name: "UNION SELECT",         threat: "SQLi",              weight: 0.9,  pattern: /\bunion\b\s+\bselect\b/i },
  { id: "sql.tautology",      name: "OR 1=1 tautology",     threat: "SQLi",              weight: 0.85, pattern: /\bor\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i },
  { id: "sql.comment",        name: "Inline SQL comment",   threat: "SQLi",              weight: 0.5,  pattern: /(--\s|\/\*|\*\/|#\s)/ },
  { id: "sql.drop",           name: "DROP/TRUNCATE",        threat: "SQLi",              weight: 0.8,  pattern: /\b(drop|truncate)\s+(table|database)/i },
  { id: "sql.sleep",          name: "Time-based payload",   threat: "SQLi",              weight: 0.75, pattern: /\b(sleep|benchmark|waitfor\s+delay)\s*\(/i },
  { id: "html.tags",          name: "Raw HTML tags",        threat: "HTML_INJECTION",    weight: 0.4,  pattern: /<\s*(div|span|p|a|h[1-6]|table|form)[\s>]/i },
  { id: "cmd.shell",          name: "Shell metachars",      threat: "COMMAND_INJECTION", weight: 0.7,  pattern: /[;&|`$]\s*(ls|cat|whoami|id|uname|curl|wget|nc)\b/i },
  { id: "path.traversal",     name: "../ traversal",        threat: "PATH_TRAVERSAL",    weight: 0.8,  pattern: /\.\.[\\/]/ },
  { id: "ssrf.localhost",     name: "Localhost / metadata", threat: "SSRF",              weight: 0.7,  pattern: /\b(127\.0\.0\.1|localhost|169\.254\.169\.254|0\.0\.0\.0)\b/i },
  { id: "susp.eval",          name: "eval()/Function()",    threat: "SUSPICIOUS",        weight: 0.6,  pattern: /\b(eval|Function)\s*\(/ },
  { id: "susp.entity",        name: "HTML entity obfusc.",  threat: "SUSPICIOUS",        weight: 0.4,  pattern: /&#x?[0-9a-f]+;/i },
];

const THREAT_META: Record<Exclude<ThreatType,"NONE">, { impact: string; recommendation: string }> = {
  XSS:               { impact: "Client-side script execution; session hijack, DOM rewriting, credential theft.", recommendation: "Sanitize via DOMPurify, output-encode by context, enforce strict CSP (script-src 'self')." },
  SQLi:              { impact: "Unauthorized data read/write, schema disclosure, full DB compromise.",           recommendation: "Use parameterized queries / prepared statements; never concatenate user input into SQL." },
  HTML_INJECTION:    { impact: "Defacement, phishing overlays, layout hijack.",                                  recommendation: "Escape <, >, &, \", ' on output. Avoid innerHTML; prefer textContent." },
  EVENT_HANDLER:     { impact: "Arbitrary JS execution via inline handlers (onclick, onerror, etc.).",           recommendation: "Strip on* attributes; whitelist allowed attributes if HTML must be rendered." },
  COMMAND_INJECTION: { impact: "OS command execution on the host; full server takeover possible.",               recommendation: "Never pass input to shell. Use language-native APIs with explicit arg arrays." },
  PATH_TRAVERSAL:    { impact: "Read of files outside intended directory (config, secrets, /etc/passwd).",      recommendation: "Resolve and verify path stays within an allow-listed root before file ops." },
  SSRF:              { impact: "Server reaches internal services / cloud metadata; credential theft.",          recommendation: "Block RFC1918 + link-local + metadata IPs at the egress layer; use allow-list." },
  SUSPICIOUS:        { impact: "Possible obfuscation or evasion technique; not conclusive on its own.",         recommendation: "Treat as elevated risk. Combine with other signals; log for review." },
};

export const SIGNATURES_LOADED = SIGNATURES.length;

function shannon(s: string): number {
  if (!s) return 0;
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  let h = 0;
  for (const k in freq) { const p = freq[k] / s.length; h -= p * Math.log2(p); }
  return h;
}

export function classifyLocal(input: string): AnalyzeResult {
  const stages: Stage[] = [];
  const t0 = performance.now();

  const tNorm = performance.now();
  stages.push({ name: "normalize", ms: +(performance.now() - tNorm).toFixed(3),
                detail: `len=${input.length} · entropy=${shannon(input).toFixed(3)}` });

  const tSig = performance.now();
  const hits: SigHit[] = [];
  const threatScores: Partial<Record<Exclude<ThreatType,"NONE">, number>> = {};
  for (const sig of SIGNATURES) {
    const m = input.match(sig.pattern);
    if (m) {
      hits.push({ id: sig.id, name: sig.name, weight: sig.weight, match: m[0].slice(0, 80) });
      threatScores[sig.threat] = (threatScores[sig.threat] ?? 0) + sig.weight;
    }
  }
  stages.push({ name: "signature_scan", ms: +(performance.now() - tSig).toFixed(3),
                detail: `signatures=${SIGNATURES.length} · hits=${hits.length}` });

  const tCls = performance.now();
  let topThreat: ThreatType = "NONE";
  let topScore = 0;
  for (const [k, v] of Object.entries(threatScores) as [Exclude<ThreatType,"NONE">, number][]) {
    if (v > topScore) { topScore = v; topThreat = k; }
  }
  const confidence = topThreat === "NONE" ? 0 : Math.min(0.99, topScore / 1.5);
  let severity: Severity = "NONE";
  if (topThreat !== "NONE") {
    if (confidence >= 0.85) severity = "CRITICAL";
    else if (confidence >= 0.65) severity = "HIGH";
    else if (confidence >= 0.4)  severity = "MEDIUM";
    else severity = "LOW";
  }
  stages.push({ name: "classify", ms: +(performance.now() - tCls).toFixed(3),
                detail: `threat=${topThreat} · severity=${severity}` });

  const tRpt = performance.now();
  const meta = topThreat === "NONE"
    ? { impact: "No known attack patterns detected.", recommendation: "Continue normal validation; treat untrusted input with care." }
    : THREAT_META[topThreat];
  const analysis = topThreat === "NONE"
    ? "Input scanned against all loaded signatures. No matches."
    : `${hits.length} signature${hits.length === 1 ? "" : "s"} matched indicating ${topThreat}. Highest-weight: "${[...hits].sort((a,b)=>b.weight-a.weight)[0].name}".`;
  stages.push({ name: "report", ms: +(performance.now() - tRpt).toFixed(3), detail: "payload built" });

  return {
    status: "success",
    source: "local",
    threat: topThreat,
    severity,
    confidence: +confidence.toFixed(2),
    analysis,
    impact: meta.impact,
    recommendation: meta.recommendation,
    hits,
    stages,
    signaturesLoaded: SIGNATURES.length,
    totalMs: +(performance.now() - t0).toFixed(3),
  };
}

// ---------- ENCODING ----------
export function detectEncoding(s: string): EncType | null {
  const t = s.trim();
  if (!t) return null;
  if (/^[01\s]+$/.test(t) && t.replace(/\s/g, "").length % 8 === 0) return "binary";
  if (/^[0-9a-fA-F\s]+$/.test(t) && t.replace(/\s/g, "").length % 2 === 0 && t.length >= 4) return "hex";
  if (/%[0-9a-fA-F]{2}/.test(t)) return "url";
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(t) && t.length % 4 === 0 && t.length >= 4) return "base64";
  return null;
}

export function encode(type: EncType, s: string): string {
  switch (type) {
    case "base64": return btoa(unescape(encodeURIComponent(s)));
    case "url":    return encodeURIComponent(s);
    case "hex":    return Array.from(new TextEncoder().encode(s)).map(b => b.toString(16).padStart(2,"0")).join("");
    case "binary": return Array.from(new TextEncoder().encode(s)).map(b => b.toString(2).padStart(8,"0")).join(" ");
  }
}

export function decode(type: EncType, s: string): string {
  switch (type) {
    case "base64": {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length % 4 !== 0) throw new Error("Invalid Base64 format");
      return decodeURIComponent(escape(atob(s)));
    }
    case "url": return decodeURIComponent(s);
    case "hex": {
      const c = s.replace(/\s/g, "");
      if (!/^[0-9a-fA-F]+$/.test(c) || c.length % 2 !== 0) throw new Error("Invalid Hex format");
      const bytes = new Uint8Array(c.length / 2);
      for (let i = 0; i < c.length; i += 2) bytes[i / 2] = parseInt(c.substr(i, 2), 16);
      return new TextDecoder().decode(bytes);
    }
    case "binary": {
      const c = s.replace(/\s/g, "");
      if (!/^[01]+$/.test(c) || c.length % 8 !== 0) throw new Error("Invalid Binary format");
      const bytes = new Uint8Array(c.length / 8);
      for (let i = 0; i < c.length; i += 8) bytes[i / 8] = parseInt(c.substr(i, 8), 2);
      return new TextDecoder().decode(bytes);
    }
  }
}