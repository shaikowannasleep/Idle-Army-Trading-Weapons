// Renders the 15 s ad trailer deterministically: steps the game by hand, screenshots each frame, encodes with ffmpeg-static.
// Usage: npm run build && node tools/trailer.mjs [stage=11] [out=dist-trailer] [fps=30]
import puppeteer from 'puppeteer-core';
import ffmpeg from 'ffmpeg-static';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const stage = +(process.argv[2] ?? 11);
const out = process.argv[3] ?? 'dist-trailer';
const fps = +(process.argv[4] ?? 30);
const LENGTH = 15;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/frames`, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 540, height: 960, deviceScaleFactor: 2 },
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('http://localhost:4174/?capture=1&audio=0&dpr=2&aa=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 400));
  const dt = 1 / fps;
  // pre-roll: staff the counter until a real firing line exists, then start the clock
  await page.evaluate((s) => { window.__game.initTrailer(s); window.__game.teleport(-3, 2.75); }, stage);
  for (let i = 0; i < 40 * fps; i++) {
    await page.evaluate((d) => window.__step(d), dt);
    if (i % fps === 0 && (await page.evaluate(() => window.__game.state().soldiers)) >= 8) break;
  }
  console.log('pre-roll state', JSON.stringify(await page.evaluate(() => window.__game.state())));
  await page.evaluate(() => window.__game.trailerStart());
  for (let f = 0; f < LENGTH * fps; f++) {
    await page.evaluate((d) => window.__step(d), dt);
    await page.screenshot({ path: `${out}/frames/${String(f).padStart(4, '0')}.png` });
  }
  console.log('end state', JSON.stringify(await page.evaluate(() => window.__game.state())));
} finally {
  await browser.close();
  server.kill();
}
execFileSync(ffmpeg, ['-y', '-framerate', String(fps), '-i', `${out}/frames/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', `${out}/silent.mp4`], { stdio: 'ignore' });
execFileSync('node', ['tools/trailer-audio.mjs', `${out}/silent.mp4`, `${out}/boss-armory-hook-15s.mp4`], { stdio: 'ignore' });
fs.copyFileSync(`${out}/frames/${String(Math.round(13.5 * fps)).padStart(4, '0')}.png`, `${out}/thumbnail.png`); // CTA beat: logo + army + button
console.log('done ->', `${out}/boss-armory-hook-15s.mp4`);
