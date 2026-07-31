// ====================================================================
// entities/projectile.js — Projétil genérico, vive em ObjectPool (não é
// criado/destruído durante o gameplay, só reciclado via reset()/release()).
// ====================================================================

export class Projectile {
  constructor(renderer, textureKey = 'bolt') {
    const PIXI = window.PIXI;
    this.sprite = new PIXI.Graphics();
    this.sprite.circle(0, 0, 4).fill({ color: 0x00d2ff });
    this.sprite.visible = false;
    renderer.worldContainer.addChild(this.sprite);

    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.damage = 0;
    this.pierceRemaining = 1;
    this.lifetimeMs = 0;
    this.ageMs = 0;
    this.isEnemyProjectile = false;
    this.hitTargets = new Set();
    this.active = false;
  }

  launch({ x, y, angle, speed, damage, pierce = 1, lifetimeMs = 2500, isEnemyProjectile = false, color = 0x00d2ff }) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.pierceRemaining = pierce;
    this.lifetimeMs = lifetimeMs;
    this.ageMs = 0;
    this.isEnemyProjectile = isEnemyProjectile;
    this.hitTargets.clear();
    this.sprite.tint = color;
    this.sprite.position.set(x, y);
    this.sprite.visible = true;
    this.active = true;
  }

  update(dtMs) {
    if (!this.active) return;
    const dtSec = dtMs / 1000;
    this.x += this.vx * dtSec;
    this.y += this.vy * dtSec;
    this.sprite.position.set(this.x, this.y);
    this.ageMs += dtMs;
    if (this.ageMs >= this.lifetimeMs) this.active = false;
  }

  // Retorna true se ainda pode acertar mais alguém (perfuração restante).
  registerHit(target) {
    this.hitTargets.add(target);
    this.pierceRemaining -= 1;
    if (this.pierceRemaining <= 0) this.active = false;
    return this.pierceRemaining > 0;
  }

  hasHit(target) {
    return this.hitTargets.has(target);
  }

  // ---- Callbacks do ObjectPool ----
  onSpawnFromPool() {
    this.active = true;
  }

  onReleaseToPool() {
    this.active = false;
    this.sprite.visible = false;
    this.sprite.position.set(-9999, -9999);
    this.hitTargets.clear();
  }
}
