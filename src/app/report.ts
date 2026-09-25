// Timing collection and the copyable JSON report (spec 16). Everything stays on the device.

const timings = new Map<string, number[]>();
const events: string[] = [];
const MAX_SAMPLES = 2000;

export function log(message: string) {
  events.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (events.length > 200) events.shift();
}

export function record(name: string, ms: number) {
  let list = timings.get(name);
  if (!list) timings.set(name, (list = []));
  list.push(Math.round(ms));
  if (list.length > MAX_SAMPLES) list.shift();
}

export function medianOf(name: string): number | null {
  const v = timings.get(name);
  if (!v?.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, median: s[Math.floor(s.length / 2)], p90: s[Math.floor(s.length * 0.9)], min: s[0], max: s.at(-1) };
}

export function buildReport(extra: Record<string, unknown>) {
  const summary = Object.fromEntries([...timings].map(([k, v]) => [k, stats(v)]));
  return { at: new Date().toISOString(), app: 'm1', ...extra, timings: summary, log: events.slice(-100) };
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', e => log(`Unhandled: ${e.message} ${e.filename ?? ''}:${e.lineno ?? ''}`));
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    log(`Unhandled: ${r?.message ?? String(e.reason)} ${r?.stack?.split('\n')[1]?.trim() ?? ''}`);
  });
}
