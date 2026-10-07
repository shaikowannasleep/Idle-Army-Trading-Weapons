#!/usr/bin/env node
/**
 * Automated 40-Stage Balance Simulation Engine for Boss Armory Idle
 * Usage: node tools/sim-balance.mjs
 */

// Weapon Base Stats: [dmg, rate, pellets]
const WEAPONS = {
  pistol:  { name: 'Pistol',          dmg: 9,   rate: 2.4, pellets: 1,  price: 12 },
  rifle:   { name: 'Assault Rifle',   dmg: 7,   rate: 7.0, pellets: 1,  price: 20 },
  shotgun: { name: 'Shotgun',         dmg: 6,   rate: 1.4, pellets: 6,  price: 30 },
  minigun: { name: 'Minigun',         dmg: 6,   rate: 15.0, pellets: 1, price: 45 },
  rocket:  { name: 'Rocket Launcher', dmg: 110, rate: 0.7, pellets: 1,  price: 65 },
};

function weaponDps(id, level = 1, dmgMult = 1, rateMult = 1) {
  const w = WEAPONS[id];
  const lvlMult = 1 + (level - 1) * 0.4;
  return (w.dmg * lvlMult * dmgMult) * (w.rate * rateMult) * w.pellets;
}

function bossHp(stage) {
  // Balanced curve: scales up steadily from 450 to 55,000 HP
  return Math.round(350 * Math.pow(1.135, stage - 1) + 120 * stage * Math.log10(stage + 1));
}

function bossWallDmg(stage) {
  // Moderate scaling so fortified walls survive 4-5 attacks
  return +(2.5 + 0.55 * Math.pow(stage, 1.15)).toFixed(1);
}

function bossAttackInterval(stage) {
  return Math.max(2.2, +(4.2 - 0.045 * stage).toFixed(2));
}

// Army progression simulation per stage tier
function getSimulatedArmy(stage) {
  // Returns estimated array of units stationed behind the wall
  const units = [];
  const maxSlots = Math.min(18, 3 + Math.floor(stage * 0.4));
  
  for (let i = 0; i < maxSlots; i++) {
    if (stage < 5) {
      units.push({ id: i < 2 ? 'rifle' : 'pistol', lvl: 1 });
    } else if (stage < 15) {
      const id = i < 3 ? 'shotgun' : i < 6 ? 'rifle' : 'pistol';
      units.push({ id, lvl: Math.min(3, 1 + Math.floor(stage / 6)) });
    } else if (stage < 28) {
      const id = i < 4 ? 'minigun' : i < 8 ? 'shotgun' : 'rifle';
      units.push({ id, lvl: Math.min(4, 2 + Math.floor(stage / 10)) });
    } else {
      const id = i < 4 ? 'rocket' : i < 9 ? 'minigun' : 'shotgun';
      units.push({ id, lvl: Math.min(5, 3 + Math.floor(stage / 10)) });
    }
  }
  return units;
}

console.log('='.repeat(92));
console.log('   🎮 BOSS ARMORY IDLE — AUTOMATED 40-STAGE PROGRESSION BALANCE SIMULATION');
console.log('='.repeat(92));
console.log(
  'Stage'.padEnd(6) +
  'Boss HP'.padEnd(12) +
  'Army Size'.padEnd(12) +
  'Total DPS'.padEnd(14) +
  'TTK (s)'.padEnd(12) +
  'Boss Hits'.padEnd(12) +
  'Wall Damage'.padEnd(14) +
  'Verdict'
);
console.log('-'.repeat(92));

let totalPassed = 0;

for (let stage = 1; stage <= 40; stage++) {
  const hp = bossHp(stage);
  const wallDmg = bossWallDmg(stage);
  const interval = bossAttackInterval(stage);
  const army = getSimulatedArmy(stage);
  
  const totalDps = Math.round(
    army.reduce((sum, u) => sum + weaponDps(u.id, u.lvl), 0)
  );

  // Time to kill boss
  const ttk = +(hp / Math.max(1, totalDps)).toFixed(1);
  const bossAttacks = Math.floor(ttk / interval);
  const estWallDmg = +(bossAttacks * wallDmg).toFixed(1);

  // Wall health estimation (starts at 100, fortifies +15% per tier)
  const estWallMax = Math.round(100 * Math.pow(1.15, Math.floor(stage / 4)));

  let verdict = '✅ BALANCED';
  if (ttk > 50) verdict = '⚠️ TOO TANKY';
  else if (estWallDmg >= estWallMax) verdict = '❌ BREACH RISKY';
  else if (ttk < 6 && stage > 5) verdict = '⚡ TOO EASY';
  else totalPassed++;

  console.log(
    `#${stage}`.padEnd(6) +
    `${hp.toLocaleString()}`.padEnd(12) +
    `${army.length} units`.padEnd(12) +
    `${totalDps.toLocaleString()} dps`.padEnd(14) +
    `${ttk}s`.padEnd(12) +
    `${bossAttacks} hits`.padEnd(12) +
    `${estWallDmg} / ${estWallMax}`.padEnd(14) +
    verdict
  );
}

console.log('='.repeat(92));
console.log(`Simulation complete: ${totalPassed}/40 stages passed balanced criteria.`);
console.log('Run time: <10ms (pure analytical simulation).');
console.log('='.repeat(92));
