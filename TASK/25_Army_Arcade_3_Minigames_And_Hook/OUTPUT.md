# Output
`idle-threejs/src/arcade/` — "Army Arcade", now the default entry (`?game=armory` opens the old idle game):
- `Arcade.ts`: main menu (3D boss + firing ring of troopers, 3 cards with LV badges, progress saved in localStorage), opening/closing modes, end panel, tracking (`startLevel`/`trackClick` through FlowManager, CHALLENGE_STARTED/ENDCARD_SHOWN through the SDK).
- `SquadRush.ts` (Last War): steer the squad, shoot gates to raise their values, +/× gates, hordes, rescue hero capsules, boss Warlord.
- `HordeSurvivor.ts` (Survivor.io): joystick, swarms of up to 380 enemies (instanced + spatial hash), XP gems, level-up cards (bolt/blades/nova/rockets/might/haste/swift/magnet/vitality), surges, boss Bone King.
- `MergeDefense.ts` (Infinite Defender): 8 slots, SUMMON + drag-merge up to tier 5 (Rocket Launcher), 10 waves, bosses on waves 5 and 10, barricade.
- Shared: `Mode.ts`, `Crowd.ts` (baked instanced crowds), `Brute.ts`, `ArcadeHud.ts`, `arcade.css`.

Tests: `npm run build && npm run test:arcade [shotsDir]` → **55/55 PASS** (model clips, menu, real input per mode, bot clears level 1 under the real rules, end panel, NEXT/RETRY/MENU, lose/win paths, frame time < 20 ms, progress saved, 0 console errors).
Balance: `node tools/arcade-balance.mjs 3 horde,merge` (Rush/Horde win L1–3; Merge wins L1–2, L3 is hard).

Hook video: `npm run build && npm run trailer:arcade [outDir] [fps]` → `idle-threejs/media/army-arcade-hook-15s.mp4` (1080x1920, 30 fps, AAC) + thumbnail.
Storyboard: 0–2.6s "1 SOLDIER… or 1000?" (gate +14) → 2.6–5s "×500 ARMY" crushes the Warlord → 5–9.4s "1 HERO VS 500" nova/blades sweep the swarm → 9.4–12.8s merge to "ROCKET LAUNCHER!" / "DOUBLE ROCKETS!" → 12.8–15s end card "BEAT ALL 3!" + PLAY NOW.
