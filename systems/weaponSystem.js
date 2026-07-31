// ====================================================================
// systems/weaponSystem.js — Ataque automático (o personagem ataca
// sozinho — jogador só se posiciona). Auto-aim melhorado: prioriza o
// inimigo mais próximo, mas com um viés leve pra manter o alvo atual
// se ainda estiver no alcance (evita "trocar de alvo" freneticamente
// quando dois inimigos estão quase equidistantes).
// ====================================================================

import { ObjectPool } from '../js/objectPool.js';
import { Projectile } from '../entities/projectile.js';
import { distanceSquared } from '../js/utils.js';

export class Inventory {
  constructor({ renderer, maxWeaponSlots = 6 }) {
    this.renderer = renderer;
    this.maxWeaponSlots = maxWeaponSlots;
    this.weaponSystems = []; // WeaponSystem[]
  }

  hasFreeWeaponSlot() {
    return this.weaponSystems.length < this.maxWeaponSlots;
  }

  getWeaponLevel(weaponId) {
    const ws = this.weaponSystems.find((w) => w.weaponData.id === weaponId);
    return ws ? ws.level : 0;
  }

  addOrLevelUpWeapon(weaponData) {
    const existing = this.weaponSystems.find((w) => w.weaponData.id === weaponData.id);
    if (existing) {
      existing.level += 1;
      return existing;
    }
    if (!this.hasFreeWeaponSlot()) return null;
    const ws = new WeaponSystem({ renderer: this.renderer, weaponData });
    this.weaponSystems.push(ws);
    return ws;
  }
}

export class WeaponSystem {
  constructor({ renderer, weaponData, poolSize = 40 }) {
    this.renderer = renderer;
    this.weaponData = weaponData;
    this.level = 1;
    this.cooldownRemainingMs = 0;
    this._currentTargetRef = null;

    this.pool = new ObjectPool(
      () => new Projectile(renderer),
      poolSize,
      {
        onAcquire: (p) => p.onSpawnFromPool(),
        onRelease: (p) => p.onReleaseToPool(),
      }
    );
  }

  update(dtMs, { ownerX, ownerY, enemies, damageMult = 1, attackSpeedMult = 1, rangeMult = 1, particles = null, onFire = null }) {
    this.cooldownRemainingMs -= dtMs;

    // atualiza todos os projéteis ativos
    this.pool.forEachActive((p) => {
      p.update(dtMs);
      if (!p.active) { this.pool.release(p); return; }

      // Trail: solta uma partícula pequena a cada ~30ms de voo — dá
      // sensação de velocidade sem precisar de um shader de verdade.
      p._trailTimerMs = (p._trailTimerMs ?? 0) + dtMs;
      if (particles && p._trailTimerMs >= 30) {
        p._trailTimerMs = 0;
        particles.burst({ x: p.x, y: p.y, count: 1, color: 0x00d2ff, speedMin: 0, speedMax: 15, lifetimeMs: 180, sizeMin: 1, sizeMax: 2 });
      }
    });

    // Reavalia o alvo TODO frame (barato: só checa se o atual ainda é
    // válido, só busca um novo se precisar) — não gatear isso atrás do
    // cooldown, senão um alvo morto fica com a referência presa até o
    // próximo disparo, mesmo sem nenhum motivo pra isso.
    const target = this._findTarget(ownerX, ownerY, enemies, rangeMult);

    if (this.cooldownRemainingMs > 0) return;
    if (!target) return; // sem alvo à vista — guarda o "tiro" pro próximo frame

    // attackSpeedMult > 1 = ataca mais rápido -> cooldown menor.
    this.cooldownRemainingMs = this._getCooldownMs() / Math.max(0.1, attackSpeedMult);
    this._fire(ownerX, ownerY, target, damageMult);
    onFire?.();
  }

  _getCooldownMs() {
    const arr = this.weaponData.cooldown_ms_per_level || this.weaponData.cooldownMsPerLevel;
    if (arr) return arr[Math.min(this.level - 1, arr.length - 1)];
    // Formato real dos dados (data/weapons.js): cooldown fixo, reduz
    // 4% por nível (retorno decrescente, nunca abaixo de 50% do original).
    const base = this.weaponData.cooldown ?? 1200;
    return base * Math.max(0.5, 1 - (this.level - 1) * 0.04);
  }

  _getDamage() {
    const arr = this.weaponData.damage_per_level || this.weaponData.damagePerLevel;
    if (arr) return arr[Math.min(this.level - 1, arr.length - 1)];
    // +18% de dano por nível acima do 1o — curva de crescimento
    // razoável já que os dados não têm array de progressão embutido.
    const base = this.weaponData.baseDamage ?? 20;
    return base * (1 + (this.level - 1) * 0.18);
  }

  _getProjectileCount() {
    const arr = this.weaponData.projectile_count_per_level || this.weaponData.projectileCountPerLevel;
    if (arr) return arr[Math.min(this.level - 1, arr.length - 1)];
    const base = this.weaponData.count ?? 1;
    return base + Math.floor((this.level - 1) / 3); // +1 projétil a cada 3 níveis
  }

  _getPierce() {
    const arr = this.weaponData.pierce_per_level || this.weaponData.piercePerLevel;
    if (arr) return arr[Math.min(this.level - 1, arr.length - 1)];
    const base = this.weaponData.pierce ?? 1;
    return base + Math.floor((this.level - 1) / 2); // +1 perfuração a cada 2 níveis
  }

  // Auto-aim melhorado: se o alvo atual ainda está vivo e dentro do
  // alcance, mantém ele (evita "vibrar" entre dois inimigos quase à
  // mesma distância a cada disparo) — só re-avalia se o alvo sumiu.
  _findTarget(ownerX, ownerY, enemies, rangeMult = 1) {
    const maxRangeSq = (260 * rangeMult) * (260 * rangeMult);

    if (this._currentTargetRef && this._currentTargetRef.alive) {
      const d = distanceSquared(ownerX, ownerY, this._currentTargetRef.x, this._currentTargetRef.y);
      if (d <= maxRangeSq) return this._currentTargetRef;
    }

    let nearest = null;
    let nearestDistSq = Infinity;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const d = distanceSquared(ownerX, ownerY, enemy.x, enemy.y);
      if (d <= maxRangeSq && d < nearestDistSq) { nearestDistSq = d; nearest = enemy; }
    }
    this._currentTargetRef = nearest;
    return nearest;
  }

  _fire(x, y, target, damageMult) {
    const count = this._getProjectileCount();
    const baseAngle = Math.atan2(target.y - y, target.x - x);
    const spreadRad = (12 * Math.PI) / 180;
    const startAngle = baseAngle - (spreadRad * (count - 1)) / 2;

    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) break;
      p.launch({
        x, y,
        angle: startAngle + spreadRad * i,
        speed: 420,
        damage: this._getDamage() * damageMult,
        pierce: this._getPierce(),
      });
    }
  }
}
