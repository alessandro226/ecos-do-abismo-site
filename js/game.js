// ====================================================================
// game.js — Estado central da partida (não é "o jogo inteiro", é o
// coordenador: tempo decorrido, dificuldade dinâmica, XP/nível, hit
// stop). Orquestra os sistemas (entities/systems) mas não conhece
// PixiJS diretamente — isso fica em main.js e renderer.js.
// ====================================================================

import { formatTime } from './utils.js';

// Volume IX (Progression & Economy Bible), substitui a fórmula do
// Volume I por decisão explícita — Volume IX é o documento mais novo.
// EXP_necessária(N) = floor(10.0 × N^1.65 + 15×N)
export function xpNeededForLevel(level) {
  return Math.floor(10 * Math.pow(level, 1.65) + 15 * level);
}

// GDD 3.1 — M(t) = 1.0 + (segundos/180)^1.2 × 0.25. Sem teto, de
// propósito — a dificuldade sobe indefinidamente (decisão de design
// documentada: o jogo deve continuar desafiador em runs longas).
export function difficultyMultiplier(elapsedMs) {
  const seconds = elapsedMs / 1000;
  return 1.0 + Math.pow(seconds / 180, 1.2) * 0.25;
}

// GDD 3.1 — R = Armadura / (Armadura + 200). Retorno decrescente.
export function armorReduction(armorValue) {
  if (armorValue <= 0) return 0;
  return armorValue / (armorValue + 200);
}

export function applyArmor(rawDamage, armorValue) {
  const reduction = armorReduction(armorValue);
  return Math.max(1, rawDamage * (1 - reduction));
}

export const GameState = Object.freeze({
  MENU: 'menu',
  RUNNING: 'running',
  PAUSED: 'paused',
  LEVEL_UP: 'level_up',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
});

export class Game {
  constructor() {
    this.state = GameState.MENU;
    this.elapsedMs = 0;
    this.level = 1;
    this.xp = 0;
    this.xpMultiplier = 1;
    this.gold = 0;

    this.stats = { kills: 0, damageDealt: 0, damageTaken: 0 };

    this._hitStopUntilMs = null; // timestamp real (Date.now()), não afetado por timeScale
    this.timeScale = 1;

    this._listeners = {};
  }

  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
  }

  _emit(event, ...args) {
    for (const fn of this._listeners[event] || []) fn(...args);
  }

  startRun() {
    this.state = GameState.RUNNING;
    this.elapsedMs = 0;
    this.level = 1;
    this.xp = 0;
    this.gold = 0;
    this.stats = { kills: 0, damageDealt: 0, damageTaken: 0 };
    this._emit('runStarted');
  }

  endRun() {
    this.state = GameState.GAME_OVER;
    this._emit('runEnded', { level: this.level, elapsedMs: this.elapsedMs, ...this.stats });
  }

  winRun() {
    this.state = GameState.VICTORY;
    this._emit('runWon', { level: this.level, elapsedMs: this.elapsedMs, ...this.stats });
  }

  pause() {
    if (this.state === GameState.RUNNING) this.state = GameState.PAUSED;
  }

  resume() {
    if (this.state === GameState.PAUSED) this.state = GameState.RUNNING;
  }

  isRunning() {
    return this.state === GameState.RUNNING;
  }

  getDifficultyMultiplier() {
    return difficultyMultiplier(this.elapsedMs);
  }

  addXP(amount) {
    this.xp += amount * this.xpMultiplier;
    let needed = xpNeededForLevel(this.level);
    let leveledUp = false;
    // while: permite subir vários níveis de uma vez com uma gema grande.
    while (this.xp >= needed) {
      this.xp -= needed;
      this.level += 1;
      needed = xpNeededForLevel(this.level);
      leveledUp = true;
      this._emit('levelUp', this.level);
    }
    this._emit('xpChanged', this.xp, needed, this.level);
    return leveledUp;
  }

  addGold(amount) {
    this.gold += amount;
    this._emit('goldChanged', this.gold);
  }

  registerKill() {
    this.stats.kills += 1;
  }

  registerDamageDealt(amount) {
    this.stats.damageDealt += amount;
  }

  registerDamageTaken(amount) {
    this.stats.damageTaken += amount;
  }

  // ---- Hit Stop (GDD 2.2) ----
  // Usa Date.now() (tempo real) pra saber quando acabar, não o tempo do
  // jogo (que o próprio hit stop está desacelerando) — senão o hit stop
  // pausaria a si mesmo e nunca terminaria.
  triggerHitStop(durationMs, scale, nowFn = Date.now) {
    if (this._hitStopUntilMs !== null) return; // já em hit stop, não empilha
    this.timeScale = scale;
    this._hitStopUntilMs = nowFn() + durationMs;
  }

  // Chamado a cada frame, ANTES de aplicar timeScale ao dt do resto do
  // jogo — decide se o hit stop já deve terminar.
  updateHitStop(nowFn = Date.now) {
    if (this._hitStopUntilMs !== null && nowFn() >= this._hitStopUntilMs) {
      this.timeScale = 1;
      this._hitStopUntilMs = null;
    }
  }

  // dt real (não escalado) em ms — atualiza o cronômetro da partida.
  // O timer NÃO é afetado por timeScale (hit stop não deveria fazer o
  // relógio da run "parecer" parar).
  tick(realDtMs) {
    this.updateHitStop();
    if (this.isRunning()) {
      this.elapsedMs += realDtMs;
    }
  }

  getFormattedTime() {
    return formatTime(this.elapsedMs);
  }
}
