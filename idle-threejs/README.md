# Boss Armory Idle (Three.js)

A ~90-second idle playable built from the Cocos project's art, audio and UI assets. You sell weapons, customers become soldiers, the soldiers fight an evolving boss, and the boss keeps evolving until it breaks the camp. The end card then offers **CONTINUE**, which opens github.com/shaikowanansleep, or **RETRY**.

## Run

```bash
npm install
npm run dev            # play at http://localhost:5173
npm run build          # dist/            (multi-file web build)
npm run build:single   # dist-single/     (one self-contained HTML, ~4.9 MB, for ad networks)
```

Controls: drag anywhere to move (floating joystick), or use WASD / arrow keys on desktop.

Quality flags you can add to the URL: `?dpr=1`, `?shadows=0`, `?aa=0|1`, `?audio=0`.

## Gameplay loop

1. Stand in the glowing ring behind the counter. Each customer is served in 0.8 s: a weapon flies over from its crate, the customer changes into a soldier, and the coins fly to the HUD.
2. The soldiers take their slots behind the sandbag wall and shoot the boss. Weapons: pistol, M4, shotgun, minigun and rocket launcher.
3. When the boss dies it drops coins, gems and equipment chests. Walk near the drops to collect them. Anything left on the ground flies into the bag after 10 s.
4. Stand on the ground pads to spend coins and gems. Pads can unlock or level up a weapon, expand the camp (a second counter with an assistant), or fortify the wall. **Every purchase makes the boss evolve.**
5. The boss also evolves over time. At about 78 s it reaches its final form. The wall falls at about 88 s, the game slows down and shakes, and the end card appears.

## Layout

```
src/
  core/      Engine (60 fps cap, adaptive DPR, tab pause), asset loader, WebAudio mixer, joystick input
  game/      Game (director/economy), Actors (customer→soldier, staff), Boss, Loot, Props, Weapons, layout
  vfx/       instanced billboard particles, bullet tracers, shockwaves/pillars, blob shadows
  ui/        DOM HUD (transform-only updates) + styles
  tracking/  PlayableAdsSDK / PlayableAdsFlowManager (TS port of assets/Scripts/Tracking)
tools/
  convert_fbx.py     Blender headless: FBX → GLB with re-linked textures   (writes raw/)
  build-assets.mjs   gltf-transform: meshopt + WebP, copies audio/UI       (writes src/assets/)
  perf.mjs           scripted full play-through: CPU / footprint / FPS (+ PROFILE=1)
  baseline.mjs, memdump.mjs, trace.mjs, endflow.mjs   measurement and end-card checks
```

To regenerate the assets from the Cocos sources:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/convert_fbx.py -- ../assets raw
npm run assets
```

## Performance (Chrome, M1 Pro, 414×800 @2x, full ~100 s session)

| Metric | Result |
|---|---|
| Frame rate | locked at 60 fps; no frame above 16.7 ms on average |
| Tab memory (physical footprint) | ~131 MB |
| JS heap | 12–24 MB |
| Main thread | ~16% of one core. Game JS is about 9% of that; the rest is the browser's own work for a 60 fps canvas. |

The CPU figure does not meet the 10% target. For comparison, an empty WebGL page of the same size that only clears the screen at 60 fps already uses about 6–9% CPU in the renderer process and 10–14% in the GPU process.
