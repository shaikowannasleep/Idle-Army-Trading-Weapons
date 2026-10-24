# Task 27 — Output

## Changes
| Area | What changed |
|---|---|
| Map props (Blender) | `tools/map-props.py` (headless Blender) loads map.glb, separates it into loose parts, clusters them by bounding box, picks one cluster per type and exports `src/assets/models/props.glb` (143 KB): tree_a/b/pair/bush, log, log_cut, stump, stump_mush, grass, rock, stake, fence, tent, campfire. The origin of each is at its bottom centre. |
| Prop helper | `Mode.props(items)` uses one InstancedMesh per prop and 24 m chunk, so off-screen chunks are frustum-culled. `groundTex()` generates a seamless canvas texture (patches + specks) in place of flat colours. |
| Squad Rush BG | Road texture with cracks, edge lines and centre dashes. Grass ground texture. Fences every 2 m, trees, logs and stumps on both sides, so the scrolling shows motion. The castle walls were removed. |
| Squad Rush gameplay | `MAX_DRAW` 180→48 (the crowd no longer overflows the screen), `PACK` .36. Fire is **straight** (hit only inside its own column, no homing). Softer hordes: `min(30, 4+2L+s)`, picket `2+(L>>1)+(s>>1)`, capsule horde `4+L`. Boss HP `160+130L`. |
| Squad Rush VFX | Muzzle flash, warm tracers, hit sparks, green goo splats with shockwaves on kills, a ring when passing a gate, dust behind the squad. |
| Horde | The gun is mounted on the `WPR` bone using the inverse of the Idle pose plus -90° Y, so it is held at chest height and points where the hero faces. Grass-textured arena with trees around the edge and clutter inside. Muzzle flash, splats on kills, hit sparks. Shotgun life .65. |
| Merge | Gunmetal material on the pistol (`Weapons.ts`), because the FBX's vertex colours were white. Textured ground, a dirt road, a plank deck, fences/trees/tents in place of the spikes. Kill splats and hit sparks. |
| VFX | `Fx.shocks` uses the shockwave flipbook from Test00 (`explosion_spritesheet_3x3.png` → `src/assets/vfx/shock.webp`). `fx.splat()` = droplets + smoke + shock. `explosion()` also spawns a shock. |

## Verification
- `npm run build && npm run test:arcade` → **57 passed, 0 failed**.
- `node tools/arcade-balance.mjs 5 rush`: L1–L4 win, L5 lose (hard, intended). `arcade-balance 3`: Horde and Merge win L1–L3.
- Render+update cost measured separately: rush 1.1 ms/frame, horde 0.3, merge 0.2.
- Screenshots of all 3 modes checked (gun pose, white pistol fixed, new BG).

## Notes
- The 15 s hook trailer has not been re-rendered (`npm run trailer:arcade` when needed).
