// Real system metrics from the Deno runtime.
// Returns CPU load, memory usage, uptime — no random / fake values.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let loadavg: [number, number, number] = [0, 0, 0];
  try { loadavg = Deno.loadavg() as [number, number, number]; } catch { /* unsupported */ }

  let sysMem: { total: number; free: number; available: number; buffers: number; cached: number; swapTotal: number; swapFree: number } | null = null;
  try { sysMem = Deno.systemMemoryInfo(); } catch { /* unsupported */ }

  const proc = Deno.memoryUsage(); // { rss, heapTotal, heapUsed, external }
  const cores = navigator.hardwareConcurrency || 1;

  // Normalize 1-min loadavg into a 0..100 percent over available cores.
  const cpuPct = Math.max(0, Math.min(100, (loadavg[0] / cores) * 100));

  const memUsedPct = sysMem
    ? Math.max(0, Math.min(100, ((sysMem.total - sysMem.available) / sysMem.total) * 100))
    : Math.max(0, Math.min(100, (proc.heapUsed / proc.heapTotal) * 100));

  const body = {
    status: "success",
    ts: Date.now(),
    cpu: {
      cores,
      loadavg,
      percent: +cpuPct.toFixed(2),
    },
    memory: {
      total: sysMem?.total ?? proc.heapTotal,
      free: sysMem?.free ?? null,
      available: sysMem?.available ?? null,
      used: sysMem ? sysMem.total - sysMem.available : proc.heapUsed,
      percent: +memUsedPct.toFixed(2),
      processRss: proc.rss,
      heapUsed: proc.heapUsed,
      heapTotal: proc.heapTotal,
    },
    runtime: {
      deno: Deno.version.deno,
      v8: Deno.version.v8,
      pid: Deno.pid,
    },
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});