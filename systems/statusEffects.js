// ====================================================================
// systems/statusEffects.js — 4 status effects, valores EXATOS do
// Volume VII (Combat Systems Bible), seção 4.1. Anexável a qualquer
// entidade com `.health`/`.maxHealth` (Player ou Enemy).
// ====================================================================

const STATUS_SPECS = {
  burn: { durationMs: 4000, tickIntervalMs: 1000, dmgPercentOfBase: 0.15, maxStacks: 5 },
  freeze: { durationMs: 3000, speedReduction: 0.4, stacksToParalyze: 3, maxStacks: 3 },
  bleed: { durationMs: 5000, tickIntervalMs: 1000, dmgPercentMaxHp: 0.015, maxStacks: 1 },
  stun: { durationMs: 1500 },
};

export class StatusReceiver {
  constructor(entity) {
    this.entity = entity;
    this.active = {};
  }

  apply(statusName, { baseDamage = 0 } = {}) {
    const spec = STATUS_SPECS[statusName];
    if (!spec) return;

    const existing = this.active[statusName];
    if (existing) {
      existing.timeLeftMs = spec.durationMs;
      if (spec.maxStacks > 1) existing.stacks = Math.min(spec.maxStacks, existing.stacks + 1);
      if (baseDamage) existing.baseDamage = baseDamage;
    } else {
      this.active[statusName] = {
        timeLeftMs: spec.durationMs,
        stacks: 1,
        tickTimerMs: spec.tickIntervalMs ?? 0,
        baseDamage,
      };
    }

    if (statusName === 'freeze' && this.active.freeze.stacks >= STATUS_SPECS.freeze.stacksToParalyze) {
      this.apply('stun');
    }
  }

  isStunned() {
    return !!this.active.stun;
  }

  getSpeedMultiplier() {
    if (this.active.freeze) return 1 - STATUS_SPECS.freeze.speedReduction;
    return 1;
  }

  update(dt, onDamageTick) {
    const dtMs = dt * 1000;
    for (const name of Object.keys(this.active)) {
      const state = this.active[name];
      const spec = STATUS_SPECS[name];
      state.timeLeftMs -= dtMs;

      if (spec.tickIntervalMs) {
        state.tickTimerMs -= dtMs;
        if (state.tickTimerMs <= 0) {
          state.tickTimerMs = spec.tickIntervalMs;
          this._applyTick(name, state, spec, onDamageTick);
        }
      }

      if (state.timeLeftMs <= 0) delete this.active[name];
    }
  }

  _applyTick(name, state, spec, onDamageTick) {
    let dmg = 0;
    if (name === 'burn') {
      dmg = state.baseDamage * spec.dmgPercentOfBase * state.stacks;
    } else if (name === 'bleed') {
      dmg = (this.entity.maxHealth ?? 0) * spec.dmgPercentMaxHp;
    }
    if (dmg > 0) onDamageTick?.(dmg, name);
  }

  hasStatus(name) {
    return !!this.active[name];
  }

  clear() {
    this.active = {};
  }
}
