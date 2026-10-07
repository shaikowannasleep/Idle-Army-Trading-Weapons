import type { WeaponId } from './Weapons';

export type GameMode = 'infinite' | 'classic';

export interface PlayerSaveData {
  version: number;
  mode: GameMode;
  currentStage: number; // 1 to 40
  highestStageUnlocked: number;
  coins: number;
  gems: number;
  wLevels: Record<WeaponId, number>;
  unlockedWeapons: WeaponId[];
  expanded: boolean;
  fortifyCount: number;
  dmgMult: number;
  rateMult: number;
}

const DEFAULT_CLASSIC_DATA: PlayerSaveData = {
  version: 1,
  mode: 'classic',
  currentStage: 1,
  highestStageUnlocked: 1,
  coins: 0,
  gems: 0,
  wLevels: { pistol: 1, rifle: 1, shotgun: 1, minigun: 1, rocket: 1 },
  unlockedWeapons: ['pistol'],
  expanded: false,
  fortifyCount: 0,
  dmgMult: 1,
  rateMult: 1,
};

const DEFAULT_INFINITE_DATA: PlayerSaveData = {
  version: 1,
  mode: 'infinite',
  currentStage: 1,
  highestStageUnlocked: 40,
  coins: 99999999,
  gems: 9999,
  wLevels: { pistol: 5, rifle: 5, shotgun: 5, minigun: 5, rocket: 5 },
  unlockedWeapons: ['pistol', 'rifle', 'shotgun', 'minigun', 'rocket'],
  expanded: true,
  fortifyCount: 10,
  dmgMult: 2.5,
  rateMult: 2.0,
};

export class SaveManager {
  private static readonly STORAGE_KEY = 'BOSS_ARMORY_IDLE_SAVE_V1';

  static load(): PlayerSaveData | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlayerSaveData;
      if (parsed.version === 1 && parsed.currentStage >= 1 && parsed.currentStage <= 40) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  static save(data: PlayerSaveData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('SaveManager failed to write to localStorage:', e);
    }
  }

  static createInitial(mode: GameMode): PlayerSaveData {
    const data = JSON.parse(JSON.stringify(mode === 'infinite' ? DEFAULT_INFINITE_DATA : DEFAULT_CLASSIC_DATA)) as PlayerSaveData;
    this.save(data);
    return data;
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('SaveManager failed to clear localStorage:', e);
    }
  }
}
