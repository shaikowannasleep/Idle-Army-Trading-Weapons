// Browser floor cost: a 60 fps WebGL canvas that only clears, same viewport/DPR as tools/perf.mjs.
import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
// macOS physical footprint (what Activity Monitor shows as Memory), in MB
const footprintMB = (pid) => { try { const m = execSync(`footprint ${pid} 2>/dev/null`).toString().match(/Footprint:\s+([\d.]+)\s*(KB|MB|GB)/); return m ? +(+m[1] * (m[2] === 'GB' ? 1024 : m[2] === 'KB' ? 1 / 1024 : 1)).toFixed(0) : 0; } catch { return 0; } };
const html = `<html><body style="margin:0"><canvas id=c style="width:100vw;height:100vh;display:block"></canvas><script>
const c=document.getElementById('c');c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio;
const gl=c.getContext('webgl2',{antialias:true});let t=0;
(function f(){t+=0.01;gl.clearColor(Math.sin(t)*0.5+0.5,0.3,0.3,1);gl.clear(gl.COLOR_BUFFER_BIT);requestAnimationFrame(f)})();
</script></body></html>`;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 414, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
await page.goto('data:text/html,' + encodeURIComponent(html));
const pid = browser.process().pid;
const parse = (t) => t.split(':').reduce((a, v) => a * 60 + parseFloat(v), 0);
const snap = () => Object.fromEntries(execSync('ps -o pid=,ppid=,rss=,time=,command= -ax').toString().trim().split('\n')
  .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/)).filter((m) => m && +m[2] === pid)
  .map((m) => [m[5].includes('gpu-process') ? 'gpu' : m[5].includes('Renderer') ? 'r' + m[1] : 'o' + m[1], { cpu: parse(m[4]), rss: footprintMB(m[1]) * 1024 }]));
await new Promise((r) => setTimeout(r, 3000));
const a = snap(); const t0 = Date.now();
await new Promise((r) => setTimeout(r, 10000));
const b = snap(); const dt = (Date.now() - t0) / 1000;
for (const k of Object.keys(b)) if (a[k]) console.log(k.padEnd(8), 'cpu', ((b[k].cpu - a[k].cpu) / dt * 100).toFixed(1) + '%', 'rss', (b[k].rss / 1024).toFixed(0) + 'MB');
await browser.close();
