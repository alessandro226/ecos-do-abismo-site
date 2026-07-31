// ====================================================================
// save.js — Persistência de progresso entre partidas via localStorage.
// ====================================================================

const SAVE_KEY = 'ecos_abismo_save_v1';

function defaultData() {
  return {
    totalGold: 0, bestLevel: 1, bestTimeMs: 0,
    totalPlaytimeMs: 0, totalRuns: 0, totalKills: 0, totalBosses: 0,
    hasSeenTutorial: false,
    achievements: {}, discoveredWeapons: {}, discoveredEnemies: {},
    discoveredBosses: {}, researchLevels: {},
    settings: {
      musicVolume: 0.7, sfxVolume: 0.8, joystickMode: 'fixed', joystickPosition: 'left',
      highContrast: false, particleIntensity: 1,
    },
  };
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (target[key] && typeof target[key] === 'object' && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export class SaveManager {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.storage = storage;
    this.data = defaultData();
    this._saveTimeout = null;
  }

  load() {
    let parsed = null;
    try {
      const raw = this.storage ? this.storage.getItem(SAVE_KEY) : null;
      parsed = raw ? JSON.parse(raw) : null;
    } catch (e) {
      parsed = null; // save corrompido ou storage indisponível — segue com os padrões
    }
    this.data = deepMerge(defaultData(), parsed || {});
    return this.data;
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('SaveManager: falha ao salvar', e);
    }
  }

  // Evita gravar a cada pequena mudança (ex: arrastar slider de volume).
  scheduleSave(delayMs = 800) {
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => this.save(), delayMs);
  }

  flushImmediately() {
    clearTimeout(this._saveTimeout);
    this.save();
  }
}
