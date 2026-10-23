// Renders the 15 s "Army Arcade" hook video: real gameplay of all 3 modes, stepped deterministically, plus captions + sfx mix.
// Usage: npm run build && node tools/arcade-trailer.mjs [out=dist-trailer-arcade] [fps=30]
import puppeteer from 'puppeteer-core';
import ffmpeg from 'ffmpeg-static';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const out = process.argv[2] ?? 'dist-trailer-arcade';
const fps = +(process.argv[3] ?? 30);
const L = 15;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(`${out}/frames`, { recursive: true });

// Storyboard. `setup` runs in the page at the cut (pre-roll with tick = no render); `beats` fire mid-shot.
const SHOTS = [
  { at: 0, cap: '1 SOLDIER…', sub: 'or 1000?', color: '#ffd34d', setup: () => {
    const A = window.__arcade; A.open('rush', 1); A.bot(true); A.mode().setArmy(1); A.tick(1 / 30, 120);
  }, beats: [[1.7, null, { cap: 'GROW YOUR ARMY', sub: 'pick the right gate', color: '#7fd0ff' }]] },
  { at: 2.6, cap: '×500 ARMY', sub: 'vs the Warlord', color: '#7fd0ff', setup: () => {
    const A = window.__arcade; A.open('rush', 1); A.bot(true); A.mode().setArmy(500); A.cheat('win'); A.tick(1 / 30, 30);
  } },
  { at: 5.0, cap: '1 HERO VS 500', sub: 'stack skills · survive', color: '#9cff6a', setup: () => {
    const A = window.__arcade; A.open('horde', 1); A.bot(true);
    const m = A.mode();
    for (const k of ['bolt', 'blades', 'nova', 'rockets', 'haste']) m.grant(k, 5);
    m.setGod(true); A.tick(1 / 30, 20); m.surge(220, 7);
  }, beats: [[1.9, () => window.__arcade.mode().surge(220, 6)]] },
  { at: 9.4, cap: 'MERGE → ROCKETS', sub: 'hold the wall', color: '#c77dff', setup: () => {
    const A = window.__arcade; A.open('merge', 2); A.bot(false);
    const m = A.mode();
    // let the wave walk in, then hand the player a board one merge away from rockets
    m.setSlots([2, 2, 1, 1, 0, 0, 0, 0]);
    for (let i = 0; i < 40 && A.state().foes < 12; i++) A.tick(1 / 30, 30);
    m.setSlots([4, 4, 3, 3, 2, 2, 4, 1]);
  }, beats: [
    [0.7, () => window.__arcade.mode().mergeAt(0, 1), { cap: 'ROCKET LAUNCHER!', sub: 'Lv4 + Lv4', color: '#c77dff' }],
    [1.6, () => window.__arcade.mode().mergeAt(2, 3)],
    [2.3, () => window.__arcade.mode().mergeAt(3, 6), { cap: 'DOUBLE ROCKETS!', sub: 'nothing gets through', color: '#ff7ad9' }],
  ] },
  { at: 12.8, cap: 'BEAT ALL 3!', sub: '', color: '#ffffff', cta: true, top: '63%', setup: () => {
    window.__arcade.bot(false); window.__arcade.menu();
  } },
];

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
  await page.goto('http://localhost:4174/?capture=1&game=arcade&audio=0&dpr=2&aa=1', { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  // trailer-only overlay: caption, cut flash, CTA button (Web Animations, so __step advances them frame-exactly)
  await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = `
      #tr { position: fixed; inset: 0; pointer-events: none; z-index: 99; font-family: var(--font, sans-serif); text-align: center; }
      #tr .cap { position: absolute; left: 0; right: 0; top: 17%; }
      #tr h1 { margin: 0; font-size: 58px; line-height: 1; letter-spacing: 1px; -webkit-text-stroke: 9px #1a1030; paint-order: stroke fill; }
      #tr p { margin: 8px 0 0; font-size: 26px; color: #fff; -webkit-text-stroke: 6px #1a1030; paint-order: stroke fill; }
      #tr .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
      #tr .cta { position: absolute; left: 50%; bottom: 17%; transform: translateX(-50%); padding: 22px 44px; border-radius: 26px; opacity: 0;
        background: linear-gradient(#6dff8f, #20c25a); color: #fff; font-size: 44px; white-space: nowrap; box-shadow: 0 8px 0 #12823a, 0 0 40px #4dff7a88;
        -webkit-text-stroke: 7px #0d5a27; paint-order: stroke fill; }
      #tr .hand { position: absolute; right: -34px; bottom: -48px; font-size: 64px; }
      .arc .banner, .arc .hint { visibility: hidden; }
      body.tr-cta .arc-mcard, body.tr-cta .arc-menu .foot { visibility: hidden; }`;
    document.head.append(css);
    const tr = document.createElement('div');
    tr.id = 'tr';
    tr.innerHTML = '<div class="cap"><h1></h1><p></p></div><div class="cta">PLAY NOW<span class="hand">👆</span></div><div class="flash"></div>';
    document.body.append(tr);
  });
  const show = (s, cut = true) =>
    page.evaluate(({ cap, sub, color, cta, top }, cut) => {
      const tr = document.getElementById('tr');
      const h = tr.querySelector('h1');
      h.textContent = cap;
      h.style.color = color;
      tr.querySelector('p').textContent = sub;
      tr.querySelector('.cap').style.top = top ?? '17%';
      if (cut) tr.querySelector('.flash').animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
      tr.querySelector('.cap').animate(
        [{ opacity: 0, transform: 'scale(2.2) rotate(-6deg)' }, { opacity: 1, transform: 'scale(0.92) rotate(-2deg)', offset: 0.5 }, { opacity: 1, transform: 'scale(1) rotate(-2deg)' }],
        { duration: 280, easing: 'ease-out', fill: 'forwards' },
      );
      if (!cut) return;
      document.body.classList.toggle('tr-cta', !!cta);
      if (cta) {
        const b = tr.querySelector('.cta');
        b.animate([{ opacity: 0, transform: 'translateX(-50%) scale(0.3)' }, { opacity: 1, transform: 'translateX(-50%) scale(1.1)' }], { duration: 300, delay: 250, fill: 'forwards', easing: 'ease-out' });
        b.animate([{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], { duration: 600, delay: 550, iterations: Infinity });
      }
    }, s, cut);

  const dt = 1 / fps;
  const cut = SHOTS.map((s) => Math.round(s.at * fps));
  let shot = -1;
  for (let f = 0; f < L * fps; f++) {
    const i = cut.indexOf(f);
    if (i >= 0) {
      shot = i;
      await page.evaluate(`(${SHOTS[i].setup})()`);
      await show(SHOTS[i]);
      console.log(`shot ${i} @${SHOTS[i].at}s`, JSON.stringify(await page.evaluate(() => window.__arcade.state())).slice(0, 200));
    }
    for (const [t, fn, cap] of SHOTS[shot].beats ?? []) {
      if (f !== cut[shot] + Math.round(t * fps)) continue;
      if (fn) await page.evaluate(`(${fn})()`);
      if (cap) await show(cap, false);
    }
    await page.evaluate((d) => window.__step(d), dt);
    await page.screenshot({ path: `${out}/frames/${String(f).padStart(4, '0')}.png` });
  }
} finally {
  await browser.close();
  server.kill();
}

execFileSync(ffmpeg, ['-y', '-framerate', String(fps), '-i', `${out}/frames/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', `${out}/silent.mp4`], { stdio: 'ignore' });

// soundtrack: bgm + game sfx + synthesized booms, cued to the storyboard
const sfx = (n) => `src/assets/sfx/${n}.mp3`;
const boom = (d) => `lavfi:anoisesrc=d=${d}:c=brown:a=1,lowpass=f=180,afade=t=out:st=0.05:d=${d - 0.05}`;
const whoosh = 'lavfi:aevalsrc=0.4*sin(2*PI*(300+1600*t/0.3)*t):d=0.3,afade=t=out:st=0.15:d=0.15';
const cues = [
  ...SHOTS.map((s) => [whoosh, s.at, 0.6]),
  [sfx('click1'), 0.6, 1], [sfx('sound-receive-coin'), 1.2, 0.9], [sfx('finish_order'), 1.9, 1],            // gates multiply
  [boom(1.2), 2.6, 2.4], ...Array.from({ length: 18 }, (_, i) => [sfx('gun1'), 2.8 + i * 0.12, 0.3]),       // army vs warlord
  [sfx('death'), 4.6, 1],
  [boom(1), 5.0, 2], ...Array.from({ length: 16 }, (_, i) => [sfx('coin'), 5.5 + i * 0.22, 0.5]),           // horde xp shower
  [boom(1.4), 6.9, 2.6],
  [sfx('click1'), 10.1, 1], [sfx('finish_order'), 10.15, 1.1], [boom(1), 11.2, 2], [sfx('finish_order'), 11.7, 1.1], [boom(1.2), 11.9, 2.4],  // merges + rockets
  [boom(1.5), 12.8, 2.8], [sfx('Coin_Tip'), 13.1, 1], [sfx('finish_order'), 13.6, 1.2],                    // end card
];
const inputs = ['-i', sfx('bgM'), '-i', `${out}/silent.mp4`];
for (const [src] of cues) inputs.push(...(src.startsWith('lavfi:') ? ['-f', 'lavfi', '-i', src.slice(6)] : ['-i', src]));
const fc = [`[0:a]volume=0.45,afade=t=in:d=0.3,afade=t=out:st=${L - 0.6}:d=0.6[m]`];
cues.forEach(([, at, vol], i) => fc.push(`[${i + 2}:a]volume=${vol},adelay=${Math.round(at * 1000)}:all=1[c${i}]`));
fc.push(`[m]${cues.map((_, i) => `[c${i}]`).join('')}amix=inputs=${cues.length + 1}:normalize=0,alimiter=limit=0.95,atrim=0:${L}[a]`);
execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', fc.join(';'), '-map', '1:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(L), `${out}/army-arcade-hook-15s.mp4`], { stdio: 'ignore' });
fs.copyFileSync(`${out}/frames/${String(Math.round(13.8 * fps)).padStart(4, '0')}.png`, `${out}/thumbnail.png`);
console.log('done ->', `${out}/army-arcade-hook-15s.mp4`);
