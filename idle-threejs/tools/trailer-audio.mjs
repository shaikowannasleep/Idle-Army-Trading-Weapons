// Mixes the trailer soundtrack from the game's own sfx + synthesized booms, and muxes it into the silent video.
// Usage: node tools/trailer-audio.mjs <video-in.mp4> <video-out.mp4>   (cue times match src/game/Trailer.ts)
import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';

const [vin, vout] = process.argv.slice(2);
const sfx = (n) => `src/assets/sfx/${n}.mp3`;
const boom = (d) => `anoisesrc=d=${d}:c=brown:a=1,lowpass=f=180,afade=t=out:st=0.05:d=${d - 0.05}`;
const L = 15;

// [source (file or lavfi), start s, volume]
const cues = [
  ['lavfi:' + boom(1.3), 0.9, 2.2], ['lavfi:' + boom(1.5), 1.7, 2.8],                              // hook: boss slams the wall
  ['lavfi:aevalsrc=0.5*sin(2*PI*(1800-1500*t/0.6)*t):d=0.6,afade=t=out:st=0.4:d=0.2', 2.35, 0.7],    // rewind sweep
  [sfx('click1'), 3.0, 1], [sfx('click1'), 3.95, 1], [sfx('click1'), 4.9, 1],                       // SELL / ARM / DEFEND stamps
  [sfx('finish_order'), 3.5, 0.9], [sfx('sound-receive-coin'), 4.4, 0.8], [sfx('finish_order'), 5.5, 0.9],
  ...Array.from({ length: 34 }, (_, i) => [sfx('gun1'), 6.3 + i * 0.12, 0.35]),                       // barrage
  ['lavfi:' + boom(2), 10.4, 3], [sfx('death'), 10.5, 1],                                          // kill
  ...Array.from({ length: 8 }, (_, i) => [sfx('coin'), 10.8 + i * 0.2, 0.7]),                       // loot
  [sfx('finish_order'), 12.5, 1.2], [sfx('Coin_Tip'), 13.2, 1],                                    // logo + button
];

const inputs = ['-i', sfx('bgM'), '-i', vin];
for (const [src] of cues) inputs.push(...(src.startsWith('lavfi:') ? ['-f', 'lavfi', '-i', src.slice(6)] : ['-i', src]));
const fc = [`[0:a]volume=0.45,afade=t=in:d=0.3,afade=t=out:st=${L - 0.6}:d=0.6[m]`];
cues.forEach(([, at, vol], i) => fc.push(`[${i + 2}:a]volume=${vol},adelay=${Math.round(at * 1000)}:all=1[c${i}]`));
fc.push(`[m]${cues.map((_, i) => `[c${i}]`).join('')}amix=inputs=${cues.length + 1}:normalize=0,alimiter=limit=0.95,atrim=0:${L}[a]`);
execFileSync(ffmpeg, ['-y', ...inputs, '-filter_complex', fc.join(';'), '-map', '1:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(L), vout], { stdio: 'inherit' });
