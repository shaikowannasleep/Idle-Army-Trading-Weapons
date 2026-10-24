// Renders one 15 s demo per arcade game: the level-1 coach marks, then real (bot) play and a payoff shot. Stepped deterministically.
// Usage: npm run build && node tools/demo-videos.mjs [modes=rush,horde,merge] [out=media] [fps=30]
import puppeteer from 'puppeteer-core';
import ffmpeg from 'ffmpeg-static';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const modes = (process.argv[2] ?? 'rush,horde,merge').split(',');
const out = process.argv[3] ?? 'media';
const fps = +(process.argv[4] ?? 30);
const L = 15;

// Storyboards: `setup` runs at the cut, `beats` [t, fn, caption] fire mid-shot, `sfx` [file, at, vol] cue the mix.
const DEMOS = {
  rush: {
    file: 'demo-squad-rush-15s',
    shots: [
      { at: 0, cap: 'SQUAD RUSH', sub: 'drag to steer your squad', color: '#7fd0ff', setup: () => {
        const A = window.__arcade; A.open('rush', 1); A.bot(false);
      }, beats: [[3.2, () => window.__arcade.bot(true), { cap: 'SHOOT THE GATES', sub: 'every soldier fires its own round', color: '#7fd0ff' }],
        [6.6, null, { cap: 'GRAB BOOSTERS', sub: 'gun up · airstrike · rapid fire', color: '#ffd34d' }]] },
      { at: 10.4, cap: 'CRUSH THE WARLORD', sub: '', color: '#ff7a4d', setup: () => {
        const A = window.__arcade; A.open('rush', 1); A.bot(true); A.mode().setArmy(400); A.cheat('win'); A.tick(1 / 30, 30);
      } },
    ],
    sfx: [['click1', 1.0, 1], ['sound-receive-coin', 4.5, 0.9], ['finish_order', 6.6, 1], ...Array.from({ length: 20 }, (_, i) => ['gun1', 10.6 + i * 0.2, 0.3]), ['death', 13.8, 1]],
  },
  horde: {
    file: 'demo-zombie-horde-15s',
    shots: [
      { at: 0, cap: 'ZOMBIE HORDE', sub: 'choose your gun', color: '#9cff6a', setup: () => {
        const A = window.__arcade; A.open('horde', 1); A.bot(false);
      }, beats: [
        [1.6, () => document.querySelector('.arc-card[data-id=shotgun]').click(), { cap: 'METEOR RAIN', sub: 'drag anywhere to move', color: '#ffb84d' }],
        [4.4, () => window.__arcade.bot(true), { cap: 'LURE THEM IN', sub: 'guns strike the glowing circles', color: '#ffb84d' }],
        [9.6, () => { const m = window.__arcade.mode(); for (const k of ['bolt', 'blades', 'nova', 'rockets']) m.grant(k, 4); m.setGod(true); m.surge(200, 8); },
          { cap: 'LEVEL UP · STACK SKILLS', sub: '1 hero vs the swarm', color: '#9cff6a' }],
      ] },
    ],
    sfx: [['click1', 1.6, 1], ['sound-receive-coin', 1.7, 0.9], ...Array.from({ length: 12 }, (_, i) => ['coin', 5 + i * 0.35, 0.4]), ['finish_order', 9.6, 1.1], ['boom', 10.2, 2.2], ['boom', 12.4, 2]],
  },
  merge: {
    file: 'demo-merge-defense-15s',
    shots: [
      { at: 0, cap: 'MERGE DEFENSE', sub: 'tap summon to deploy', color: '#c77dff', setup: () => {
        const A = window.__arcade; A.open('merge', 1); A.bot(false);
      }, beats: [
        [1.4, () => window.__arcade.mode().summon()],
        [2.6, () => window.__arcade.mode().summon(), { cap: 'DRAG TWIN ONTO TWIN', sub: 'to merge them', color: '#c77dff' }],
        [4.8, () => { const s = window.__arcade.state().slots; const [a, b] = s.map((l, i) => (l === 1 ? i : -1)).filter((i) => i >= 0); window.__arcade.mode().mergeAt(a, b); },
          { cap: 'MERGED!', sub: 'higher level = bigger gun', color: '#ffd34d' }],
        [7.6, () => window.__arcade.bot(true), { cap: 'HOLD THE WALL', sub: 'keep summoning & merging', color: '#c77dff' }],
      ] },
      { at: 10.6, cap: 'UNLOCK ROCKETS', sub: 'Lv4 + Lv4', color: '#ff7ad9', setup: () => {
        const A = window.__arcade; A.open('merge', 2); A.bot(false);
        const m = A.mode();
        m.setSlots([2, 2, 1, 1, 0, 0, 0, 0]);
        for (let i = 0; i < 40 && A.state().foes < 12; i++) A.tick(1 / 30, 30);
        m.setSlots([4, 4, 3, 3, 2, 2, 4, 1]);
      }, beats: [[0.7, () => window.__arcade.mode().mergeAt(0, 1)], [1.6, () => window.__arcade.mode().mergeAt(2, 3)], [2.3, () => window.__arcade.mode().mergeAt(3, 6)]] },
    ],
    sfx: [['click1', 1.4, 1], ['click1', 2.6, 1], ['finish_order', 4.8, 1.1], ['sound-receive-coin', 8.5, 0.8], ['finish_order', 11.3, 1.1], ['boom', 11.6, 2], ['boom', 12.9, 2.4]],
  },
};

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 540, height: 960, deviceScaleFactor: 2 },
});
fs.mkdirSync(out, { recursive: true });
try {
  for (const id of modes) {
    const D = DEMOS[id];
    const tmp = `dist-demo/${id}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(`${tmp}/frames`, { recursive: true });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto('http://localhost:4174/?capture=1&game=arcade&audio=0&dpr=2&aa=1', { waitUntil: 'load' });
    await page.waitForFunction('window.__ready === true', { timeout: 60000 });
    // demo caption sits under the HUD bar; game banners stay hidden so the coach marks read cleanly
    await page.evaluate(() => {
      const css = document.createElement('style');
      css.textContent = `
        #tr { position: fixed; inset: 0; pointer-events: none; z-index: 99; font-family: var(--font, sans-serif); text-align: center; }
        #tr .cap { position: absolute; left: 0; right: 0; top: 12%; }
        #tr h1 { margin: 0; font-size: 46px; line-height: 1; -webkit-text-stroke: 8px #1a1030; paint-order: stroke fill; }
        #tr p { margin: 6px 0 0; font-size: 22px; color: #fff; -webkit-text-stroke: 5px #1a1030; paint-order: stroke fill; }
        #tr .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
        .arc .banner, .arc .hint { visibility: hidden; }`;
      document.head.append(css);
      const tr = document.createElement('div');
      tr.id = 'tr';
      tr.innerHTML = '<div class="cap"><h1></h1><p></p></div><div class="flash"></div>';
      document.body.append(tr);
    });
    const show = (s, cut) =>
      page.evaluate(({ cap, sub, color }, cut) => {
        const tr = document.getElementById('tr');
        const h = tr.querySelector('h1');
        h.textContent = cap;
        h.style.color = color;
        tr.querySelector('p').textContent = sub;
        if (cut) tr.querySelector('.flash').animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
        tr.querySelector('.cap').animate([{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
      }, s, cut);

    const cut = D.shots.map((s) => Math.round(s.at * fps));
    let shot = -1;
    for (let f = 0; f < L * fps; f++) {
      const i = cut.indexOf(f);
      if (i >= 0) {
        shot = i;
        await page.evaluate(`(${D.shots[i].setup})()`);
        await show(D.shots[i], i > 0);
      }
      for (const [t, fn, cap] of D.shots[shot].beats ?? []) {
        if (f !== cut[shot] + Math.round(t * fps)) continue;
        if (fn) await page.evaluate(`(${fn})()`);
        if (cap) await show(cap, false);
      }
      await page.evaluate((d) => window.__step(d), 1 / fps);
      await page.screenshot({ path: `${tmp}/frames/${String(f).padStart(4, '0')}.png` });
    }
    console.log(id, JSON.stringify(await page.evaluate(() => window.__arcade.state())).slice(0, 160));
    await page.close();

    execFileSync(ffmpeg, ['-y', '-framerate', String(fps), '-i', `${tmp}/frames/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', `${tmp}/silent.mp4`], { stdio: 'ignore' });
    const whoosh = 'lavfi:aevalsrc=0.4*sin(2*PI*(300+1600*t/0.3)*t):d=0.3,afade=t=out:st=0.15:d=0.15';
    const boom = 'lavfi:anoisesrc=d=1.2:c=brown:a=1,lowpass=f=180,afade=t=out:st=0.05:d=1.15';
    const caps = [...D.shots.map((s) => s.at), ...D.shots.flatMap((s) => (s.beats ?? []).filter((b) => b[2]).map((b) => s.at + b[0]))];
    const cues = [...caps.map((at) => [whoosh, at, 0.5]), ...D.sfx.map(([n, at, v]) => [n === 'boom' ? boom : `src/assets/sfx/${n}.mp3`, at, v])];
    const inputs = ['-i', 'src/assets/sfx/bgM.mp3', '-i', `${tmp}/silent.mp4`];
    for (const [src] of cues) inputs.push(...(src.startsWith('lavfi:') ? ['-f', 'lavfi', '-i', src.slice(6)] : ['-i', src]));
    const fc = [`[0:a]volume=0.45,afade=t=in:d=0.3,afade=t=out:st=${L - 0.6}:d=0.6[m]`];
    cues.forEach(([, at, vol], i) => fc.push(`[${i + 2}:a]volume=${vol},adelay=${Math.round(at * 1000)}:all=1[c${i}]`));
    fc.push(`[m]${cues.map((_, i) => `[c${i}]`).join('')}amix=inputs=${cues.length + 1}:normalize=0,alimiter=limit=0.95,atrim=0:${L}[a]`);
    execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', fc.join(';'), '-map', '1:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(L), `${out}/${D.file}.mp4`], { stdio: 'ignore' });
    fs.copyFileSync(`${tmp}/frames/${String(Math.round(2.0 * fps)).padStart(4, '0')}.png`, `${out}/${D.file}-thumbnail.png`);
    console.log('done ->', `${out}/${D.file}.mp4`);
  }
} finally {
  await browser.close();
  server.kill();
}
