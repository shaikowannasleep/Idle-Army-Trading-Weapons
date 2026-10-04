// Runs the built game in Chrome, plays it with scripted input, reports errors + CPU / memory / frame time.
// Usage: npm run build && node tools/perf.mjs [url] [seconds] [shotsDir]
import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'node:child_process';
// macOS physical footprint (what Activity Monitor shows as Memory), in MB
const footprintMB = (pid) => { try { const m = execSync(`footprint ${pid} 2>/dev/null`).toString().match(/Footprint:\s+([\d.]+)\s*(KB|MB|GB)/); return m ? +(+m[1] * (m[2] === 'GB' ? 1024 : m[2] === 'KB' ? 1 / 1024 : 1)).toFixed(0) : 0; } catch { return 0; } };
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const seconds = +(process.argv[3] ?? 95);
const shots = process.argv[4];
if (shots) fs.mkdirSync(shots, { recursive: true });

const server = url.includes('4173') ? spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' }) : null;
await new Promise((r) => setTimeout(r, server ? 1500 : 0));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: process.env.HEADFUL ? false : 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=430,860'],
  defaultViewport: process.env.VIEWPORT ? { width: +process.env.VIEWPORT.split('x')[0], height: +process.env.VIEWPORT.split('x')[1], deviceScaleFactor: 1 } : { width: 414, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });
const cdp = await page.createCDPSession();
await cdp.send('Performance.enable');
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
const t0 = Date.now();

const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const key = async (k, ms) => { await page.keyboard.down(k); await new Promise((r) => setTimeout(r, ms)); await page.keyboard.up(k); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

// script: walk to the serve spot and keep serving; teleport onto pads to exercise purchases
const tp = (x, z) => page.evaluate(([x, z]) => window.__game.teleport(x, z), [x, z]);
const state = () => page.evaluate(() => window.__game.state());
const log = [];
const plan = async () => {
  await wait(3200);
  await shot('01_intro_end');
  await page.touchscreen.tap(200, 500); // unlock audio
  await key('a', 470);
  await wait(9000);
  await shot('02_serving');
  log.push(['before rifle pad', await state()]);
  await tp(0.9, 8.7); await wait(2500);
  await shot('03_pad');
  log.push(['after rifle pad', await state()]);
  await tp(-3, 2.75); await wait(8000);
  // sweep the loot zone
  for (const [x, z] of [[-4, -3], [-1, -3.5], [2, -1], [4, -3], [0, 0]]) { await tp(x, z); await wait(350); }
  await tp(-3, 2.75); await wait(6000);
  await shot('04_fight');
  log.push(['mid', await state()]);
  await tp(-6.4, 0.1); await wait(2500); // expand pad
  log.push(['after expand pad', await state()]);
  await tp(-3, 2.75); await wait(6000);
  await tp(3.7, 8.7); await wait(2500); // shotgun pad
  await shot('05_mid');
  log.push(['after shotgun pad', await state()]);
  await tp(-3, 2.75); await wait(15000);
  await shot('06_late');
  log.push(['late', await state()]);
};
const planP = plan();

// PROFILE=1: sample the JS profiler for 8s mid-game and print the hottest functions (self time)
if (process.env.PROFILE) {
  setTimeout(async () => {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    await wait(8000);
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map();
    const incl = new Map();
    const dt = profile.timeDeltas;
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const label = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
    profile.samples.forEach((id, i) => {
      const n = byId.get(id);
      self.set(label(n), (self.get(label(n)) ?? 0) + (dt[i] ?? 0));
      const seen = new Set();
      for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
        const k = label(byId.get(cur));
        if (seen.has(k)) continue;
        seen.add(k);
        incl.set(k, (incl.get(k) ?? 0) + (dt[i] ?? 0));
      }
    });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log('--- top self time (% of 8s wall) ---');
    [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log((v / 80000).toFixed(2).padStart(6) + '%  ' + k));
    console.log('--- top inclusive time (% of 8s wall) ---');
    [...incl.entries()].filter(([k]) => !k.startsWith('(')).sort((a, b) => b[1] - a[1]).slice(0, 45).forEach(([k, v]) => console.log((v / 80000).toFixed(2).padStart(6) + '%  ' + k));
    console.log('idle-adjusted total', (total / 80000).toFixed(1));
  }, +(process.env.PROFILE_AT ?? 24) * 1000);
}

const browserPid = browser.process().pid;
const parseTime = (t) => t.split(':').reduce((a, v) => a * 60 + parseFloat(v), 0);
function procStats() {
  const rows = execSync('ps -o pid=,ppid=,rss=,time=,command= -ax').toString().trim().split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/)).filter(Boolean)
    .filter((m) => +m[2] === browserPid);
  const renderers = rows.filter((m) => m[5].includes('Renderer')).sort((a, b) => +b[3] - +a[3]);
  const gpu = rows.find((m) => m[5].includes('--type=gpu-process'));
  return {
    rendererMB: renderers.length ? footprintMB(renderers[0][1]) : 0,
    rendererCpuS: renderers.length ? parseTime(renderers[0][4]) : 0,
    gpuCpuS: gpu ? parseTime(gpu[4]) : 0,
  };
}
const lastCpu = {};
function cpuPct(k, secs, now) {
  const prev = lastCpu[k];
  lastCpu[k] = { secs, now };
  return prev ? +(((secs - prev.secs) / ((now - prev.now) / 1000)) * 100).toFixed(1) : 0;
}

const samples = [];
let prev = await metric();
let prevT = Date.now();
while ((Date.now() - t0) / 1000 < seconds) {
  await wait(5000);
  const m = await metric();
  const now = Date.now();
  const cpu = ((m.TaskDuration - prev.TaskDuration) / ((now - prevT) / 1000)) * 100;
  const perf = await page.evaluate(() => window.__perf());
  // process-level numbers for this Chrome instance only: tab renderer RSS + CPU% of renderer and GPU processes
  const procs = procStats();
  perf.rendererMB = procs.rendererMB;
  perf.rendererCpu = cpuPct('r', procs.rendererCpuS, now);
  perf.gpuCpu = cpuPct('g', procs.gpuCpuS, now);
  samples.push({ t: Math.round((now - t0) / 1000), cpuMain: +cpu.toFixed(1), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), ...perf, frameMs: +perf.frameMs.toFixed(2) });
  prev = m; prevT = now;
}
await planP;
await shot('07_end');
const endVisible = await page.evaluate(() => document.querySelector('.endcard')?.classList.contains('on'));
// process-level memory (renderer + GPU processes of this Chrome instance)
const pid = browser.process().pid;
let procs = '';
try { procs = execSync(`ps -o pid,ppid,rss,%cpu,command -ax | awk '$2==${pid} || $1==${pid}' | sed -E 's/--.*//' `).toString(); } catch {}
log.push(['end', await state()]);
const steady = samples.filter((s) => s.t >= 15);
const avg = (k) => +(steady.reduce((a, s) => a + s[k], 0) / Math.max(1, steady.length)).toFixed(1);
const summary = { main: avg('cpuMain'), renderer: avg('rendererCpu'), gpu: avg('gpuCpu'), rssMB: avg('rendererMB'), heapMB: avg('heapMB'), calls: avg('calls') };
console.log('SUMMARY', JSON.stringify(summary));
console.log(JSON.stringify({ samples, endVisible, errors: errors.slice(0, 20), log }, null, 1));
console.log(procs);
await browser.close();
server?.kill();
