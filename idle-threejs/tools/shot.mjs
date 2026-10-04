// Screenshot helper: node tools/shot.mjs <url> <out.png> [w] [h] [waitMs]
import puppeteer from 'puppeteer-core';
const [url, out, w = 540, h = 960, wait = 2500] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || process.env.LOG) console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });
await new Promise((r) => setTimeout(r, +wait));
await page.screenshot({ path: out });
await browser.close();
