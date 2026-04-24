// Unified analyzer client: routes to LOCAL (in-process) or CLOUD (edge function).
import { supabase } from "@/integrations/supabase/client";
import {
  classifyLocal, encode as localEncode, decode as localDecode,
  detectEncoding, type AnalyzeResult, type EncType,
} from "./threatEngineCore";

export type EngineMode = "local" | "cloud";

const MAX_INPUT = 10_000;

export interface EncodeDecodeResult {
  status: "success";
  source: EngineMode;
  op: "encode" | "decode";
  type: EncType;
  output: string;
  message: string;
  ms: number;
}

export interface EngineError {
  status: "error";
  source: EngineMode;
  message: string;
  code?: string;
}

function validate(input: string): EngineError | null {
  if (!input.trim()) return { status: "error", source: "local", message: "Empty input", code: "E_EMPTY" };
  if (input.length > MAX_INPUT) return { status: "error", source: "local", message: `Input exceeds ${MAX_INPUT} chars`, code: "E_TOO_LARGE" };
  return null;
}

export async function analyze(input: string, mode: EngineMode): Promise<AnalyzeResult | EngineError> {
  const v = validate(input); if (v) return v;
  if (mode === "local") return classifyLocal(input);
  try {
    const { data, error } = await supabase.functions.invoke("analyze", { body: { op: "analyze", input } });
    if (error) return { status: "error", source: "cloud", message: error.message };
    if (data?.status === "error") return { status: "error", source: "cloud", message: data.message };
    return data as AnalyzeResult;
  } catch (e) {
    return { status: "error", source: "cloud", message: e instanceof Error ? e.message : "Cloud unreachable" };
  }
}

export async function transform(
  op: "encode" | "decode",
  input: string,
  type: EncType | "auto",
  mode: EngineMode,
): Promise<EncodeDecodeResult | EngineError> {
  const v = validate(input); if (v) return v;

  const resolvedType: EncType | null = type === "auto" ? detectEncoding(input) : type;
  if (!resolvedType) return { status: "error", source: mode, message: "Could not auto-detect encoding type", code: "E_DETECT" };

  if (mode === "local") {
    const t0 = performance.now();
    try {
      const output = op === "encode" ? localEncode(resolvedType, input) : localDecode(resolvedType, input);
      return {
        status: "success", source: "local", op, type: resolvedType, output,
        message: `${op === "encode" ? "Encoded" : "Decoded"} as ${resolvedType.toUpperCase()}`,
        ms: +(performance.now() - t0).toFixed(3),
      };
    } catch (e) {
      return { status: "error", source: "local", message: e instanceof Error ? e.message : "Transform failed" };
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke("analyze", {
      body: { op, input, type: resolvedType },
    });
    if (error) return { status: "error", source: "cloud", message: error.message };
    if (data?.status === "error") return { status: "error", source: "cloud", message: data.message };
    return data as EncodeDecodeResult;
  } catch (e) {
    return { status: "error", source: "cloud", message: e instanceof Error ? e.message : "Cloud unreachable" };
  }
}

export { detectEncoding };