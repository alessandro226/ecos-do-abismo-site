// ====================================================================
// settings.js — Estado de configurações em runtime. Sincronizado com
// SaveManager.data.settings (a fonte persistida) — este módulo é só a
// "cópia de trabalho" em memória que o resto do jogo lê.
// ====================================================================

const DEFAULTS = {
  musicVolume: 0.7,
  sfxVolume: 0.8,
  joystickMode: 'fixed', // 'fixed' | 'floating'
  highContrast: false,
  particleIntensity: 1, // 0-1, reduz partículas em dispositivos fracos
  graphicsQuality: 'alto', // 'baixo' | 'medio' | 'alto' | 'ultra'
  showFps: false,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
  }

  loadFrom(savedSettings) {
    this.values = { ...DEFAULTS, ...(savedSettings || {}) };
    return this.values;
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    if (!(key in DEFAULTS)) {
      console.warn(`Settings: chave desconhecida "${key}"`);
    }
    this.values[key] = value;
  }

  toJSON() {
    return { ...this.values };
  }
}
