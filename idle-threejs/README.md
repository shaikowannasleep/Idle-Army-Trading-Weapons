# Boss Armory Idle ⚔️

[![Build & Bundle](https://img.shields.io/badge/Build-Single--File%20HTML%20(4.88%20MB)-4dff88?style=flat-square&logo=three.js)](https://github.com/shaikowannasleep)
[![Three.js](https://img.shields.io/badge/Three.js-r186-000000?style=flat-square&logo=three.js)](https://threejs.org/)
[![FPS](https://img.shields.io/badge/FPS-60%20Locked-brightgreen?style=flat-square)](https://github.com/shaikowannasleep)

> 🎮 **Live Demo**: [https://shaikowannasleep.github.io/](https://github.com/shaikowannasleep)

A fast, juice-packed 3D idle action defense game for web and mobile, built with **Three.js (r186)**, **TypeScript**, and **Vite**.

You manage a frontline weapon depot: serve customers, equip them into soldiers, defend the sandbag barricade against evolving bosses, and advance through a 40-stage campaign across hostile alien worlds.

---

## Run

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server with hot reload
npm run dev            # http://localhost:5173 (reachable on mobile LAN)

# 3. Standard multi-file production build
npm run build          # static files in dist/

# 4. Self-contained single-file HTML bundle for Ad Networks & offline play
npm run build:single   # single index.html in dist-single/ (~4.88 MB, zero external requests)
```

**Controls**: Drag anywhere on screen (floating joystick), tap ground to pathfind, or use WASD / Arrow keys on desktop.  
**URL Query Flags**: `?debug=1` (DevTools HUD), `?dpr=1`, `?shadows=0`, `?aa=0|1`, `?audio=0`.

---

## Game

- **40-Stage Campaign**: Battle through 4 distinct chapters:
  - **Tier 1 (Stages 1–10)**: *Desert Outpost* — Unlock Pistol, Rifle, and Shotgun against the Void Scorpion.
  - **Tier 2 (Stages 11–20)**: *Magma Canyon* — Ground-shockwaves, Dread Scorpion armor, Minigun unlocks.
  - **Tier 3 (Stages 21–30)**: *Toxic Abyss* — High-rate Abyss Tyrant, Rocket Launchers, wall fortifications.
  - **Tier 4 (Stages 31–40)**: *Apex Void* — Full 18-soldier firing line vs the unstoppable Apex World Eater.
- **Two Game Modes (Select on Start)**:
  - 👑 **Infinite God Mode**: 99M Coins, 9K Gems, all 5 weapons maxed, instant camp expansion — perfect for testing combat feel and blasting all 40 stages.
  - ⚔️ **Classic Grinding Mode**: Start from scratch (0 Coins, Pistol Lv.1), tactical economy, earn every upgrade.
- **Persistent Army Across Stages**: Soldiers stationed behind the barricade persist when clearing a stage; the wall automatically heals 50% HP upon victory.
- **Weapon Armory**: 5 distinct weapons (Pistol, Assault Rifle, Shotgun, Minigun, Rocket Launcher) with procedural muzzle flashes, tracers, bullet spreads, and explosive rocket arcs.
- **Economy & Ground Pads**: Step on glowing circular pads to unlock weapons, upgrade damage, hire an assistant (Camp Expansion), or fortify walls.
- **Physical Loot & Magnet**: Defeated bosses burst coins, gems, and permanent army buff chests (Damage +25%, Fire Rate +20%, Wall Repair +30%). Walk near to magnetize, or let them fly into your backpack automatically after 10 seconds.
- **Saved Progress**: Local storage saves coins, gems, weapon levels, current stage, and selected mode (`SaveManager`).
- **In-Game DevTools**: Press **`~`** (Backquote) or add `?debug=1` to open the debug overlay: Realtime Draw Calls / Tris / Geometries, `+100K Coins`, `+1K Gems`, `Kill Boss`, `Stage Jumper`, and `Speed Slider (1x / 2x / 5x)`.
- **3-Layer Playable Tracking**: Built-in `PlayableAdsFlowManager` and `PlayableAdsSDK` supporting MRAID, Google ExitApi, SuperHTML, and App Store redirection.

---

## Why it stays cool on phones

- **Zero Allocations in Render Loop (Zero-GC)**: All temporary math objects (`THREE.Vector3`, `Matrix4`, `Quaternion`, `Color`) are pre-allocated class/file-scoped scratch variables. No garbage collection stutters.
- **Shared Skeletal Armatures**: 26 active characters (customers, staff, troopers) share the base skeleton and animation clip instances. Stationary troopers throttle animation matrix updates to 30 Hz.
- **CPU ImageBitmap Cleanup**: All decoded texture bitmaps (~25 MB CPU RAM) are closed (`img.close()`) immediately following GPU texture compilation.
- **InstancedMesh Everywhere**: Bullets, smoke particles, sparks, coin drops, gems, and blob shadows are rendered via `THREE.InstancedMesh` with dynamic buffer updates (0 runtime heap allocations).
- **Hard 60 FPS Cap**: RAF loop throttles frame presentation on 120 Hz displays; rendering pauses 100% when the browser tab loses focus.
- **Throttled Shadow Mapping**: Main directional shadow map updates at 30 Hz; soldiers use projected textured blob shadows.
- **Compositor-Only DOM HUD**: Health bars, damage numbers, and floating currency text manipulate CSS `transform: translate3d()` and `opacity` only, preventing DOM layout thrashing.
- **Pre-compiled Shaders (Up-front Warmup)**: Compiles all materials and pipeline variants via `renderer.compileAsync()` before the game reveals, eliminating first-combat hitching.

---

## Layout

```text
src/
  core/       Engine loop (60 fps cap, adaptive DPR, tab pause), asset loader, WebAudio mixer, joystick & DevTools
  game/       Game director, 40-stage manager, SaveManager, Actors (staff/units), Boss AI, Loot, Weapons, Props
  vfx/        Instanced billboard particles, muzzle flashes, bullet tracers, shockwave rings, blob shadows
  ui/         DOM HUD (transform-only Web Animations), modal dialogs, and game mode styles
  tracking/   PlayableAdsSDK & PlayableAdsFlowManager (3-layer lifecycle and tap quota tracking)
tools/
  sim-balance.mjs    Analytical 40-stage progression balancer (<10ms simulation)
  build-assets.mjs   gltf-transform pipeline: meshopt + WebP conversion
  convert_fbx.py     Blender headless: FBX to GLB with relinked textures
  perf.mjs           Headless Chrome profiling script (FPS, RAM, CPU footprint)
```

---

## Rebuilding 3D Assets

To re-process raw FBX models from the Cocos source assets:
```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/convert_fbx.py -- ../assets raw
npm run assets
```
