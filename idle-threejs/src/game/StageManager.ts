export interface StageConfig {
  stage: number; // 1 to 40
  chapter: number; // 1 to 4
  chapterName: string;
  bossName: string;
  bossHp: number;
  bossWallDmg: number;
  attackInterval: number;
  coinReward: number;
  gemReward: number;
  tierColor: string;
  isApex: boolean;
}

export function calculateStageConfig(stage: number): StageConfig {
  const s = Math.max(1, Math.min(40, Math.floor(stage)));

  // Chapters & Boss Theme
  let chapter = 1;
  let chapterName = 'Desert Outpost';
  let bossName = 'VOID SCORPION';
  let tierColor = '#c47dff';

  if (s <= 10) {
    chapter = 1;
    chapterName = 'Desert Outpost';
    bossName = s === 10 ? 'ELITE VOID SCORPION' : 'VOID SCORPION';
    tierColor = '#9fd4ff';
  } else if (s <= 20) {
    chapter = 2;
    chapterName = 'Magma Canyon';
    bossName = s === 20 ? 'ELITE DREAD SCORPION' : 'DREAD SCORPION';
    tierColor = '#ff7a3d';
  } else if (s <= 30) {
    chapter = 3;
    chapterName = 'Toxic Abyss';
    bossName = s === 30 ? 'ANCIENT ABYSS TYRANT' : 'ABYSS TYRANT';
    tierColor = '#c45cff';
  } else {
    chapter = 4;
    chapterName = 'Apex Void';
    bossName = s === 40 ? 'APEX WORLD EATER' : 'WORLD EATER';
    tierColor = '#ff2a14';
  }

  // Mathematically calibrated progression curve from Task 21
  const bossHp = Math.round(350 * Math.pow(1.135, s - 1) + 120 * s * Math.log10(s + 1));
  const bossWallDmg = +(2.5 + 0.55 * Math.pow(s, 1.15)).toFixed(1);
  const attackInterval = Math.max(2.2, +(4.2 - 0.045 * s).toFixed(2));

  const coinReward = 60 * s + (s % 5 === 0 ? 300 : 0);
  const gemReward = 1 + Math.floor(s / 5);
  const isApex = s === 40;

  return {
    stage: s,
    chapter,
    chapterName,
    bossName,
    bossHp,
    bossWallDmg,
    attackInterval,
    coinReward,
    gemReward,
    tierColor,
    isApex,
  };
}

export const TOTAL_STAGES = 40;
