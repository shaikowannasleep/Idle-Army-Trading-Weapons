# Task 26 — Output

## Changes
| Area | What changed |
|---|---|
| Zombie texture | `tools/zombie-skin.py` (PIL/numpy, seed 7) repaints `skin_civilianA.webp` into `src/assets/ui/skin_zombie.webp`: rotting green skin with purple bruises, yellow eyes and red irises, grimy desaturated clothes, blood. Registered as `skinZombie` in `Assets.ts` and `ctx.skins.zombie`. |
| Enemies | Merge (walkers/biters) and Horde (`crowdM`) use the zombie skin. Tints changed to fit: Merge has normal/toxic-purple elites; Horde tiers are rotter/frozen/toxic/burning. |
| Merge balance | `FIRE_Z=-21` firing range, spawns in packs of 3–5, `10+wave*4+level` zombies per wave, HP `24*1.28^(w-1)`, speed 1.3 (elite 1.0), `SPAWN_Z=-36`, boss slams from `WALL_Z-4`. |
| UI art | `tools/ui-art.py` generates `src/assets/ui/zombie/{plate,card,splat}.webp` (rusted steel with rivets, cards with hazard stripes and blood, blood splat) and `weapon_grunge.webp`. |
| Zombie theme | `hud.begin(..., 'zombie')` sets `data-theme`. `arcade.css` gives HUD pills and the menu button a steel 9-slice border-image, a striped steel progress bar with a toxic fill, steel cards with a weapon window, a blood-splat heading, and a steel end panel. Squad Rush keeps its old theme. |
| Starting gun | Each Horde run opens on **CHOOSE YOUR GUN**: Assault Rifle (long-range tracers), Shotgun (5-pellet spread, short range), or Minigun (fast stream). Card art is rendered from the 3D models (`weaponPortraits`). The hero holds the gun on the `WPR` bone and turns toward the target. Bullets are coloured and sized per gun. The "Gun" skill card adds bullets to the gun you hold. |
| Weapon visuals | Procedural weapons keep their UVs and get the `weapon_grunge` map (brushed, worn metal) plus roughness 0.38 / metalness 0.55 with the env map. |

## Verification
- `npm run build && npm run test:arcade` → **57 passed, 0 failed** (new: 3-gun pick with rendered art and the game paused; picking a gun arms the hero and resumes).
- `node tools/arcade-balance.mjs 3` → the bot wins L1–L3 in all modes. Merge wall 76%, Horde HP 29–53.
- Horde L3 bot run per gun: rifle HP 39, shotgun HP 60, minigun HP 39, all wins.
- Screenshots checked: Merge wave 4/5 shows a zombie horde on the road; Horde gun pick and gameplay with the shotgun.

## Notes
- No image-generation skill or API is installed, so all art is procedural (PIL scripts that can be rerun, plus three.js renders of the weapons).
- The 15 s trailer (`media/army-arcade-hook-15s.mp4`) has not been re-rendered and still shows the old skins. Run `npm run trailer:arcade` to update it.
- New helper: `tools/arcade-shot.mjs <mode> <level> <secs> <out.png> [js]` takes a screenshot from the dev server on port 5173.
