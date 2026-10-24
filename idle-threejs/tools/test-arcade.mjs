// End-to-end tests for the arcade build: models, UI flow, gameplay logic (bot runs), perf.
// Usage: npm run build && node tools/test-arcade.mjs [shotsDir]
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const shots = process.argv[2] ?? 'test-shots';
fs.mkdirSync(shots, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: process.env.HEADFUL ? false : 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 414, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('response', (r) => r.status() >= 400 && errors.push(`[http ${r.status()}] ${r.url()}`));

let pass = 0;
let fail = 0;
const ok = (cond, name, info = '') => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const A = (fn, ...args) => page.evaluate(fn, ...args);
const ui = () => A(() => window.__arcade.ui());
const st = () => A(() => window.__arcade.state());
const shot = (n) => page.screenshot({ path: `${shots}/${n}.png` });
/** Fast-forward up to `secs` of sim time in 1/30 s steps; stops when the round ends. */
const ff = (secs) => A((n) => window.__arcade.tick(1 / 30, n), Math.round(secs * 30));

try {
  await page.goto('http://localhost:4175/', { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  await wait(1200);

  // ---------------- models ----------------
  const md = await A(() => window.__arcade.models());
  for (const c of ['Move', 'Attack_1', 'Attack_3', 'Idle']) ok(md.customer.includes(c), `model customer has clip ${c}`);
  for (const c of ['Idle', 'Jump forward', 'Attack 1', 'Die', 'Spawn', 'Combo']) ok(md.boss.includes(c), `model boss has clip ${c}`);
  for (const c of ['Idle', 'Move 1', 'Stun', 'Combo', 'Attack']) ok(md.staff.includes(c), `model staff has clip ${c}`);
  ok(md.menuCrowdH > 1 && md.menuCrowdH < 4, 'baked crowd height is sane', `h=${md.menuCrowdH.toFixed(2)}`);

  // ---------------- menu ----------------
  let u = await ui();
  ok(u.menu && u.cards === 3 && !u.hud, 'menu shows 3 game cards, HUD hidden', JSON.stringify(u));
  await shot('00_menu');

  const modes = [
    { id: 'rush', idx: 0 },
    { id: 'horde', idx: 1 },
    { id: 'merge', idx: 2 },
  ];
  for (const m of modes) {
    // launch from the real menu button
    await page.click(`.arc-mcard[data-id="${m.id}"]`);
    await wait(400);
    u = await ui();
    let s = await st();
    ok(!u.menu && u.hud && s.mode === m.id && s.outcome === 'play', `${m.id}: menu card opens the mode with HUD`, `level=${s.level}`);

    // real input for a few seconds
    if (m.id === 'rush') {
      await page.mouse.move(207, 600);
      await page.mouse.down();
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(207 - i * 6, 600);
        await wait(40);
      }
      await page.mouse.up();
      await wait(1500);
      const s2 = await st();
      ok(s2.z < 0, 'rush: squad advances along the road', `z=${s2.z}`);
    } else if (m.id === 'horde') {
      // run opener: 1-of-3 gun pick, rendered weapon art
      const pick = await A(() => [...document.querySelectorAll('.arc-cards.on .arc-card')].map((c) => [c.dataset.id, !!c.querySelector('img')?.src.startsWith('data:image/png')]));
      ok(pick.length === 3 && pick.every(([, art]) => art) && (await st()).paused, 'horde: run opens with a 3-gun pick (rendered art), game paused', JSON.stringify(pick));
      await shot('2_horde_gunpick');
      await page.click('.arc-card[data-id="shotgun"]');
      await wait(200);
      const g = await st();
      ok(g.gun === 'shotgun' && !g.paused, 'horde: picking a gun arms the hero and resumes', `gun=${g.gun}`);
      await page.mouse.move(207, 500);
      await page.mouse.down();
      await page.mouse.move(267, 500, { steps: 5 });
      await wait(1200);
      const joy = await A(() => document.querySelector('.arc-joy').classList.contains('on'));
      await page.mouse.up();
      const s2 = await st();
      ok(joy && s2.hero[0] > 2, 'horde: joystick shows and moves the hero right', `hero=${s2.hero}`);
    } else {
      await wait(300);
      await page.click('.arc-summon');
      await page.click('.arc-summon');
      await wait(200);
      const s2 = await st();
      ok(s2.slots.filter((l) => l === 1).length === 2 && s2.coins === 60 - 20 - 28, 'merge: SUMMON places 2 Lv1 troops and charges coins', `slots=${s2.slots} coins=${s2.coins}`);
      // drag one onto the other through the real pointer path
      const [a, b] = s2.slots.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
      const pa = await A((i) => window.__arcade.mode().slotScreen(i), a);
      const pb = await A((i) => window.__arcade.mode().slotScreen(i), b);
      await page.mouse.move(pa.x, pa.y + 10);
      await page.mouse.down();
      await page.mouse.move(pb.x, pb.y + 10, { steps: 8 });
      await page.mouse.up();
      await wait(200);
      const s3 = await st();
      ok(s3.slots.filter((l) => l === 2).length === 1 && s3.slots.filter((l) => l).length === 1, 'merge: dragging twin onto twin merges to Lv2', `slots=${s3.slots}`);
    }
    await wait(1200);
    await shot(`${m.idx + 1}a_${m.id}_play`);

    // bot plays the level out; mid-run screenshot
    await A(() => window.__arcade.bot(true));
    s = await ff(m.id === 'merge' ? 90 : 35);
    await wait(500);
    await shot(`${m.idx + 1}b_${m.id}_mid`);
    // merge can sample a gap between waves; kills prove the crowd was there
    ok(s.drawn > 0 || (m.id === 'merge' && s.kills > 0), `${m.id}: crowd instances drawn mid-run`, `drawn=${s.drawn} kills=${s.kills}`);
    if (m.id === 'horde') {
      const sk = s.skills;
      ok(s.lvl > 1 && sk.blades + sk.nova + sk.rockets > 0, 'horde: hero levelled up and picked skill cards', `lvl=${s.lvl} skills=${JSON.stringify(sk)}`);
    }
    if (m.id === 'merge') ok(Math.max(...s.slots) >= 3, 'merge: bot merged up to tier 3+', `slots=${s.slots} wave=${s.wave}`);
    s = await ff(600);
    if (s.boss > 0 || (m.id !== 'merge' && s.outcome === 'play')) await shot(`${m.idx + 1}c_${m.id}_boss`);
    ok(s.outcome === 'win', `${m.id}: bot clears level 1 through the real rules`, JSON.stringify(s));
    await A(() => window.__arcade.bot(false));
    await wait(1200);
    u = await ui();
    ok(u.end, `${m.id}: end panel shows after the round`);
    await shot(`${m.idx + 1}d_${m.id}_end`);

    // NEXT LEVEL
    await page.click('.arc-end [data-a="next"]');
    await wait(300);
    s = await st();
    ok(s.level === 2 && s.outcome === 'play', `${m.id}: NEXT LEVEL starts level 2`);
    // lose path via cheat, then RETRY, then MENU
    await A(() => window.__arcade.cheat('lose'));
    s = await ff(3);
    await wait(1000);
    u = await ui();
    ok(s.outcome === 'lose' && u.end, `${m.id}: losing shows the defeat panel`);
    await page.click('.arc-end [data-a="retry"]');
    await wait(300);
    s = await st();
    ok(s.level === 2 && s.outcome === 'play' && !(await ui()).end, `${m.id}: RETRY restarts the same level`);
    // win path via cheat
    await A(() => window.__arcade.cheat('win'));
    s = await ff(120);
    ok(s.outcome === 'win', `${m.id}: win cheat resolves through the boss/end path`, JSON.stringify(s));
    await wait(1000);
    // perf sample while playing real-time with the bot
    await page.click('.arc-end [data-a="retry"]');
    await A(() => window.__arcade.bot(true));
    await A(() => window.__arcade.tick(1 / 30, 30 * 25));
    await wait(3000);
    const p = await A(() => window.__perf());
    ok(p.frameMs < 20, `${m.id}: frame time under 20 ms mid-fight`, `frameMs=${p.frameMs.toFixed(1)} calls=${p.calls} tris=${p.tris}`);
    await A(() => window.__arcade.bot(false));
    await page.click('.arc-back');
    await wait(300);
    u = await ui();
    ok(u.menu && !u.hud, `${m.id}: menu button returns to the main menu`);
  }
  const lv = await A(() => window.__arcade.levels());
  ok(lv.rush >= 3 && lv.horde >= 3 && lv.merge >= 3, 'progress saved per mode', JSON.stringify(lv));
  ok(errors.length === 0, 'no console / page errors', errors.slice(0, 5).join(' | '));
} catch (e) {
  fail++;
  console.log('FAIL  harness threw: ' + e.stack);
  console.log(errors.slice(0, 10).join('\n'));
} finally {
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  server.kill();
  process.exit(fail ? 1 : 0);
}
