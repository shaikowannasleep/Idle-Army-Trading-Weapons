// Bot-plays every arcade mode at levels 1..N in fast-forward and prints the outcome (balance check).
// Usage: npm run build && node tools/arcade-balance.mjs [levels=3]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const levels = +(process.argv[2] ?? 3);
const modes = (process.argv[3] ?? 'rush,horde,merge').split(',');
const server = spawn('npx', ['vite', 'preview', '--port', '4176', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'], defaultViewport: { width: 414, height: 800 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:4176/', { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
for (const m of modes)
  for (let l = 1; l <= levels; l++) {
    await page.evaluate(([m, l]) => (window.__arcade.bot(true), window.__arcade.open(m, l)), [m, l]);
    let s;
    const t0 = Date.now();
    let frames = 0;
    // chunks keep each CDP call short; stop at the end of the round
    for (let k = 0; k < 60; k++) {
      s = await page.evaluate(() => window.__arcade.tick(1 / 30, 300));
      frames += 300;
      if (s.outcome !== 'play') break;
    }
    s.msPerFrame = +((Date.now() - t0) / frames).toFixed(2);
    console.log(m, 'L' + l, s.outcome, JSON.stringify(s));
  }
await browser.close();
server.kill();
