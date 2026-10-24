# Task 28 — Output

## Changes
| Area | What changed |
|---|---|
| Rush: per-soldier bullets | Each drawn soldier has its own cadence (`shotT[i]`) and fires a straight tracer up its own column. Soldiers beyond `MAX_DRAW` add damage to the rounds of the drawn ones (`dmg = n/drawn`). A gate grows +1 per 3 rounds (not scaled by damage) so it doesn't snowball. |
| Rush: boosters | A glowing crate + label + ring on the road, collected by steering over it. **GUN UP** (4 gun levels: damage 1/1.6/2.3/3, tracers change colour cyan→purple→red), **BOMB** (airstrike: 3 shells fall from the sky onto the nearest pack, radius 3.2), **RAPID** (fire rate ×2.5 for 6 s). One booster per horde/capsule segment; the first is always GUN UP. Uses its own rng so the gate/horde layout is unchanged. The bot steers into boosters. |
| Survival: guns | The hero **holds no gun**. The gun is an off-screen battery: each volley marks glowing circles (ring + fill that grows while charging) on the nearest foes. The round flies in from outside the screen along the gun's direction and blasts every foe inside the circle. A faint glowing ring around the hero shows the reach (11 m). Sniper Battery (1 precise circle), Meteor Rain (4 clustered meteor circles with fire trails and explosions), Gunship (a fast stream of small circles). The "Gun" skill card adds circles per volley. |

## Verification
- `npm run build && npm run test:arcade` → **57 passed, 0 failed**.
- `arcade-balance.mjs 5 rush` → L1–L5 win (army 260–430). Merge L1–L3 win.
- Horde (bot): rifle wins ~5/6 runs L1–L3 (L2 sometimes loses), Meteor/Gunship L1/L3 mostly win.
- Screenshots: Rush (per-soldier lines, AIRSTRIKE, GUN UP crate), Horde (Sniper and Meteor circles, hero holding nothing).

## Notes
- The trailer was not re-rendered.
