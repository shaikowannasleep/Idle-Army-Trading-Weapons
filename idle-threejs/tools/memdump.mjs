// Memory breakdown of the game tab (Chrome memory-infra dump) after ~20 s of play.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
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
const cdp = await browser.target().createCDPSession();
const chunks = [];
cdp.on('Tracing.dataCollected', (e) => chunks.push(...e.value));
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], memoryDumpConfig: { triggers: [] } }, transferMode: 'ReportEvents' });
await new Promise((r) => setTimeout(r, 500));
const res = await cdp.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' });
await new Promise((r) => setTimeout(r, 500));
await cdp.send('Tracing.end');
await done;
await browser.close();
server.kill();
console.log('dump ok', res.success);
const procNames = new Map(chunks.filter((e) => e.name === 'process_name').map((e) => [e.pid, e.args.name]));
const labels = new Map(chunks.filter((e) => e.name === 'process_labels').map((e) => [e.pid, e.args.labels]));
for (const e of chunks.filter((e) => e.ph === 'v')) {
  const dumps = e.args?.dumps;
  if (!dumps?.allocators) continue;
  const name = procNames.get(e.pid) ?? e.pid;
  const rss = dumps.process_totals?.resident_set_bytes ? parseInt(dumps.process_totals.resident_set_bytes, 16) / 1048576 : 0;
  const top = Object.entries(dumps.allocators)
    .filter(([k]) => k.split('/').length <= 2)
    .map(([k, v]) => [k, v.attrs?.size ? parseInt(v.attrs.size.value, 16) / 1048576 : 0])
    .filter(([, v]) => v > 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 22);
  console.log(`\n== ${name} ${labels.get(e.pid) ?? ''} rss=${rss.toFixed(0)}MB`);
  for (const [k, v] of top) console.log('  ' + v.toFixed(1).padStart(7) + ' MB  ' + k);
}
