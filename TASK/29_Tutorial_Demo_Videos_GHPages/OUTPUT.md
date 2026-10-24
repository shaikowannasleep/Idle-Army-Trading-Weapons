# Task 29 — Output

## 1. Coach marks (dim + cutout spotlight), level 1 of each game
- `ArcadeHud.spot({x,y,r,text,drag?})`: `.arc-tut` overlay; the `.hole` box-shadow dims everything except a pulsing circle, with a 👆 hand (tap or drag animation) and a tip. `Mode.spotWorld()` projects a world point + radius.
- **Squad Rush**: drag to steer → slow-mo on the blue gate → booster ("GRAB THE GUN UP BOOSTER") → hero capsule.
- **Zombie Horde**: drag to move → slow-mo on the first strike circle ("guns fire from off-screen… lure zombies in") → first gem ("walk over gems to level up & pick skills").
- **Merge Defense**: tap SUMMON → summon one more → drag twin onto twin → "MERGED! higher level = bigger gun".
- Off whenever the bot or god mode is on; pointer-events none (see TASK_ERROR #29).

## 2. Demo videos (540×960 @2x, 30 fps, 15 s, music + sfx)
- `idle-threejs/media/demo-squad-rush-15s.mp4`, `demo-zombie-horde-15s.mp4`, `demo-merge-defense-15s.mp4` (+ `-thumbnail.png`)
- Re-render: `npm run build && node tools/demo-videos.mjs [rush,horde,merge]` (~10 min per video)

## 3. GitHub Pages
- `dist/` force-pushed to branch `gh-pages` → https://shaikowannasleep.github.io/Idle-Army-Trading-Weapons/ (HTTP 200, serves this build).
- Source on `main` is NOT pushed (still uncommitted locally).

## Verify
- `npm run test:arcade`: 57/57.
