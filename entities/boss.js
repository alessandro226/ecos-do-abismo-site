// ====================================================================
// entities/boss.js — Chefe com fases (transições por % de vida),
// resistência a AoE/projétil, e um ciclo de ataques básico. Diferente
// de Enemy: não vive em pool (só existe 1 por vez, raro o suficiente
// pra não precisar), e tem fases que mudam seu comportamento em tempo
// real conforme perde vida.
// ====================================================================

import { angleBetween, distance } from '../js/utils.js';

export class Boss {
  constructor({ renderer, data, x, y }) {
    this.data = data;
    this.x = x; this.y = y;
    this.maxHealth = data.hp;
    this.health = this.maxHealth;
    this.speed = data.spd;
    this.contactDamage = data.dmg;
    this.alive = true;
    this.isBoss = true;

    this.currentPhaseIndex = -1;
    this._attackCooldownMs = data.attackIntervalMs ?? 3000;
    this._invulnUntilMs = 0;
    this._speedMult = 1;
    this._dmgMult = 1;

    this._listeners = {};
    this._buildSprite(renderer);
    this._enterPhase(0);
  }

  on(event, fn) { (this._listeners[event] ??= []).push(fn); }
  _emit(event, ...args) { for (const fn of this._listeners[event] || []) fn(...args); }

  _buildSprite(renderer) {
    const PIXI = window.PIXI;
    const frame = renderer.getTexture('boss', this.data.id);
    this.sprite = new PIXI.Sprite(frame || PIXI.Texture.WHITE);
    this.sprite.anchor.set(0.5, 0.65);
    this.sprite.tint = this.data.color ?? 0xffffff;
    const scale = Math.min(1, (this.data.size ?? 64) / Math.max(this.sprite.texture.width, this.sprite.texture.height || 1));
    this.sprite.scale.set(scale);
    this.sprite.position.set(this.x, this.y);
    renderer.worldContainer.addChild(this.sprite);
  }

  update(dt, ctx) {
    if (!this.alive) return;
    const dtMs = dt * 1000;

    if (Date.now() < this._invulnUntilMs) {
      // fase de transição — imóvel e invulnerável por um instante,
      // dá tempo do jogador reagir ao aviso visual/textual.
      return;
    }

    this._checkPhaseTransition();

    if (this.data.behaviorStyle === 'ranged') {
      const dist = distance(this.x, this.y, ctx.player.x, ctx.player.y);
      if (dist < 260) {
        const angle = angleBetween(ctx.player.x, ctx.player.y, this.x, this.y);
        this.x += Math.cos(angle) * this.speed * this._speedMult * dt;
        this.y += Math.sin(angle) * this.speed * this._speedMult * dt;
      }
    } else {
      const angle = angleBetween(this.x, this.y, ctx.player.x, ctx.player.y);
      this.x += Math.cos(angle) * this.speed * this._speedMult * dt;
      this.y += Math.sin(angle) * this.speed * this._speedMult * dt;
    }
    this.sprite.position.set(this.x, this.y);

    this._attackCooldownMs -= dtMs;
    if (this._attackCooldownMs <= 0) {
      this._attackCooldownMs = this.data.attackIntervalMs ?? 3000;
      this._performAttack(ctx);
    }
  }

  _checkPhaseTransition() {
    const hpPct = this.health / this.maxHealth;
    const phases = this.data.phases || [];
    for (let i = 0; i < phases.length; i++) {
      if (hpPct <= phases[i].atHpPct && this.currentPhaseIndex < i + 1) {
        this._enterPhase(i + 1);
        break;
      }
    }
  }

  _enterPhase(phaseIndex) {
    this.currentPhaseIndex = phaseIndex;
    const phaseData = phaseIndex === 0 ? null : this.data.phases[phaseIndex - 1];

    if (phaseData) {
      this._speedMult = phaseData.speedMult ?? 1;
      this._dmgMult = phaseData.dmgMult ?? 1;
      this._invulnUntilMs = Date.now() + (phaseData.invulnMs ?? 0);
      this._emit('phaseChanged', phaseIndex, phaseData.message);
    } else {
      this._emit('spawned', this.data);
    }
  }

  // Ataque simples: dano em área ao redor do chefe (slam/barrage) — a
  // aplicação de dano de verdade é feita pelo DamageSystem checando
  // distância; aqui só emitimos a intenção do ataque.
  _performAttack(ctx) {
    // Ataque especial causa mais dano que o simples contato — senão não
    // parece um "golpe de verdade" do chefe, e sim a mesma coisa de
    // sempre. 1.8x é um valor de partida razoável pra sentir o peso.
    this._emit('attack', { x: this.x, y: this.y, radius: 70, damage: this.contactDamage * this._dmgMult * 1.8 });
  }

  takeDamage(rawDamage, { isAoE = false, isProjectile = false } = {}) {
    if (Date.now() < this._invulnUntilMs) return 0;
    let mitigated = rawDamage;
    if (isAoE) mitigated *= (1 - (this.data.resistAoE ?? 0));
    if (isProjectile) mitigated *= (1 - (this.data.resistProjectile ?? 0));

    this.health = Math.max(0, this.health - mitigated);
    if (this.health <= 0) {
      this.alive = false;
      this._emit('died', this.data);
    }
    return mitigated;
  }

  destroy() {
    this.sprite.destroy();
  }
}
