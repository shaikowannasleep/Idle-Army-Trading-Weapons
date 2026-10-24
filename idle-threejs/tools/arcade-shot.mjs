// Screenshot one arcade mode after N bot-played seconds (dev server on :5173). Usage: node tools/arcade-shot.mjs <mode> <level> <secs> <out.png> [js]
import puppeteer from 'puppeteer-core';
const [mode, lvl, secs, out, extra] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'], defaultViewport: { width: 414, height: 800, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true } });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'load' });
await p.waitForFunction('window.__ready === true', { timeout: 20000 });
await p.evaluate(([m, l]) => (window.__arcade.open(m, +l), window.__arcade.bot(true)), [mode, lvl]);
if (extra) await p.evaluate(extra);
const s = await p.evaluate((n) => window.__arcade.tick(1 / 30, n), Math.round(+secs * 30));
await new Promise((r) => setTimeout(r, 700));
console.log(JSON.stringify(s).slice(0, 300));
await p.screenshot({ path: out });
await b.close();
