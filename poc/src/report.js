// Timing collection and on-screen log. Everything stays on the device.
const timings = {};
const events = [];
let logEl = null;

export function initLog(el) { logEl = el; }

export function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  events.push(line);
  console.log(line);
  if (logEl) {
    logEl.textContent = events.slice(-150).join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

export function record(name, ms, quiet = false) {
  const list = (timings[name] ??= []);
  list.push(Math.round(ms));
  if (list.length > 2000) list.shift();
  if (!quiet) log(`${name}: ${Math.round(ms)} ms`);
}

export async function timed(name, fn) {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    record(name, performance.now() - start);
  }
}

export function median(name) {
  const v = timings[name];
  if (!v?.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, median: s[Math.floor(s.length / 2)], p90: s[Math.floor(s.length * 0.9)], min: s[0], max: s.at(-1) };
}

export function buildReport(extra) {
  const summary = Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, stats(v)]));
  return { at: new Date().toISOString(), ...extra, timings: summary, log: events.slice(-100) };
}
