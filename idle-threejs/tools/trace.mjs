// Records a Chrome trace mid-game and sums main-thread time per event type.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:4173/';
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 414, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await page.touchscreen.tap(200, 500);
await page.evaluate(() => window.__game.teleport(-3, 2.75));
await new Promise((r) => setTimeout(r, 20000));
const file = '/tmp/claude-trace.json';
await page.tracing.start({ path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink', 'cc', 'gpu', 'toplevel'] });
await new Promise((r) => setTimeout(r, 4000));
await page.tracing.stop();
await browser.close();
server.kill();
const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents;
const names = new Map(ev.filter((e) => e.name === 'thread_name').map((e) => [`${e.pid}:${e.tid}`, e.args.name]));
const per = new Map();
const threadTot = new Map();
for (const e of ev) {
  if (e.ph !== 'X' || !e.dur) continue;
  const th = names.get(`${e.pid}:${e.tid}`) ?? '?';
  const k = `${th} | ${e.name}`;
  per.set(k, (per.get(k) ?? 0) + e.dur);
  if (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'RunTask') threadTot.set(th, (threadTot.get(th) ?? 0) + e.dur);
}
console.log('--- busy per thread (RunTask, % of 4s) ---');
[...threadTot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log((v / 40000).toFixed(1).padStart(6) + '%  ' + k));
console.log('--- top events (inclusive, % of 4s) ---');
[...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 45).forEach(([k, v]) => console.log((v / 40000).toFixed(1).padStart(6) + '%  ' + k));
fs.unlinkSync(file);
