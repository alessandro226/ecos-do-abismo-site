// ====================================================================
// audio.js — Todo o áudio é sintetizado via Web Audio API (osciladores),
// sem nenhum arquivo de som externo. Categorias com controle de volume
// independente (master/music/sfx/ui).
// ====================================================================

const SFX_CATALOG = {
  hit: [{ freq: 220, duration: 0.06, wave: 'square', volume: 0.25 }],
  hitCrit: [
    { freq: 440, duration: 0.05, wave: 'square', volume: 0.3 },
    { freq: 660, duration: 0.08, wave: 'triangle', volume: 0.25 },
  ],
  enemyDeath: [
    { freq: 180, duration: 0.09, wave: 'square', volume: 0.22 },
    { freq: 90, duration: 0.12, wave: 'triangle', volume: 0.2 },
  ],
  bossDeath: [
    { freq: 220, duration: 0.15, wave: 'square', volume: 0.4 },
    { freq: 140, duration: 0.2, wave: 'square', volume: 0.35 },
    { freq: 70, duration: 0.35, wave: 'triangle', volume: 0.4 },
  ],
  hurt: [{ freq: 140, duration: 0.15, wave: 'square', volume: 0.3 }],
  levelUp: [
    { freq: 523, duration: 0.1, wave: 'sine', volume: 0.3 },
    { freq: 659, duration: 0.1, wave: 'sine', volume: 0.3 },
    { freq: 784, duration: 0.18, wave: 'sine', volume: 0.35 },
  ],
  pickupCoin: [{ freq: 880, duration: 0.05, wave: 'triangle', volume: 0.2 }],
  chestOpen: [
    { freq: 330, duration: 0.08, wave: 'triangle', volume: 0.25 },
    { freq: 440, duration: 0.12, wave: 'sine', volume: 0.3 },
  ],
  bossSpawn: [
    { freq: 110, duration: 0.3, wave: 'square', volume: 0.4 },
    { freq: 82, duration: 0.4, wave: 'square', volume: 0.4 },
  ],
  uiClick: [{ freq: 660, duration: 0.03, wave: 'sine', volume: 0.15 }],
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.uiGain = null;
    this.volumes = { master: 1, music: 0.7, sfx: 0.8, ui: 0.8 };
    this.muted = false;
  }

  // Só pode criar o AudioContext depois de uma interação do usuário
  // (política de autoplay dos navegadores) — chamar isso no primeiro
  // toque/clique na tela.
  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.uiGain = this.ctx.createGain();
    this.uiGain.connect(this.masterGain);

    this._applyVolumes();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(category, value) {
    this.volumes[category] = Math.max(0, Math.min(1, value));
    this._applyVolumes();
  }

  setMuted(muted) {
    this.muted = muted;
    this._applyVolumes();
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.volumes.master;
    this.masterGain.gain.value = m;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.uiGain.gain.value = this.volumes.ui;
  }

  playSfx(name) {
    if (!this.ctx || !SFX_CATALOG[name]) return;
    const notes = SFX_CATALOG[name];
    const bus = name.startsWith('ui') ? this.uiGain : this.sfxGain;
    let delay = 0;
    for (const note of notes) {
      this._playTone(note.freq, note.duration, note.wave, note.volume, bus, delay);
      delay += note.duration * 0.7;
    }
  }

  _playTone(frequency, duration, waveform, volume, destination, delaySeconds = 0) {
    const startTime = this.ctx.currentTime + delaySeconds;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = waveform;
    osc.frequency.value = frequency;

    // Envelope: ataque instantâneo, decaimento linear.
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}
