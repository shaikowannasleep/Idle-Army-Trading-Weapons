# Output
- `idle-threejs/src/game/Trailer.ts`: beat sheet (hook 0-2.4s, rewind glitch, SELL/ARM/DEFEND, army barrage + scripted boss kill, CTA).
- `Game.initTrailer` + `main.ts ?capture=1` deterministic `__step(dt)` (also steps CSS animations).
- `npm run build && npm run trailer [stage] [outDir] [fps]` -> `boss-armory-hook-15s.mp4` (540x960@2x, 30fps, no audio).
- Result: `idle-threejs/media/boss-armory-hook-15s.mp4`.
Bugs hit: natural boss evolve reset maxHp mid-trailer; soldiers killed boss in pre-roll; victory modal over CTA (all fixed).
