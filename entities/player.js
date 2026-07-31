// ====================================================================
// entities/player.js — Controlador do jogador. Movimento com curva de
// aceleração/desaceleração real (smoothstep, GDD 2.1), não velocidade
// instantânea. Sprite animado usando os frames reais do atlas.
// ====================================================================

import { smoothstep, clamp } from '../js/utils.js';
import { FrameAnimator } from '../js/animation.js';
import { StatusReceiver } from '../systems/statusEffects.js';

const ACCEL_TIME_SEC = 0.08; // GDD 2.1 — Tacc
const DECEL_TIME_SEC = 0.06; // GDD 2.1 — Tdec

export class Player {
  constructor({ renderer, input, stats }) {
    this.input = input;
    this.stats = stats;
    this.x = 0;
    this.y = 0;
    this.speed = stats.moveSpeed ?? 180;
    this.maxHealth = stats.maxHealth ?? 100;
    this.health = this.maxHealth;

    this.damageMult = 1;
    this.speedMult = 1;
    this.xpMult = 1;
    this.critChanceAdd = 0;
    this.armor = 0;
    this.magnetMult = 1;

    this._moveAccelT = 0;
    this._lastAngle = -Math.PI / 2; // olhando pra cima por padrão
    this.knockbackVX = 0;
    this.knockbackVY = 0;
    this.knockbackFriction = 0.88;
    this.regenPerSecond = 0;
    this.attackSpeedMult = 1;
    this.rangeMult = 1;
    this.thornsPct = 0;
    this.critDamageMult = 2;

    this._buildSprite(renderer);
    this.statusReceiver = new StatusReceiver(this);
  }

  _buildSprite(renderer) {
    const PIXI = window.PIXI;
    this.sprite = new PIXI.Sprite();
    this.sprite.anchor.set(0.5, 0.75); // ponto de ancoragem nos "pés"
    // NOTA: escala aproximada pra caber bem na resolução 640x360 do
    // Volume III — a arte em si ainda é o atlas antigo (frames de
    // ~76-101px), que não foi redesenhada pro canvas 48x48/bounding
    // box 24x32 que o Volume III especifica. Redesenhar a arte é
    // trabalho de pixel art, fora do que dá pra fazer em código.
    this.sprite.scale.set(0.42);

    const frames = renderer.atlasTextures.player;
    const animations = this._buildAnimations(frames);
    this.animator = new FrameAnimator(this.sprite, animations);
    this.animator.play('idle');

    renderer.worldContainer.addChild(this.sprite);
  }

  _buildAnimations(frames) {
    const counts = { idle: 9, walk_down: 6, walk_up: 7, walk_side: 7, attack: 4, cast: 3, hurt: 1, death: 4, victory: 2 };
    const speeds = { idle: 6, walk_down: 10, walk_up: 10, walk_side: 10, attack: 14, cast: 12, hurt: 8, death: 4, victory: 3 };
    const loop = { idle: true, walk_down: true, walk_up: true, walk_side: true, attack: false, cast: false, hurt: false, death: false, victory: true };

    const animations = {};
    for (const name of Object.keys(counts)) {
      const frameList = [];
      for (let i = 0; i < counts[name]; i++) {
        const tex = frames[`${name}_${i}`];
        if (tex) frameList.push(tex);
      }
      if (frameList.length > 0) {
        animations[name] = { frames: frameList, fps: speeds[name], loop: loop[name] };
      }
    }
    return animations;
  }

  update(dt, onParticles) {
    if (this._isDead) {
      this.animator.update(dt); // só a animação de morte continua, nada mais processa
      return;
    }

    this.statusReceiver.update(dt, (dmg) => {
      this.takeDamage(dmg);
      onParticles?.(this.x, this.y, dmg, { color: 0x8a2b3d, count: 4 });
    });
    this._updateStatusTint(); // sempre roda, mesmo se atordoado (return abaixo)

    if (this.regenPerSecond > 0 && this.health > 0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + this.regenPerSecond * dt);
    }

    if (this.statusReceiver.isStunned()) {
      this.sprite.position.set(this.x, this.y);
      this.animator.update(dt);
      return;
    }

    const statusSpeedMult = this.statusReceiver.getSpeedMultiplier();
    const dir = this.input.getDirection();
    const hasInput = dir.x !== 0 || dir.y !== 0;

    if (hasInput) {
      this._lastAngle = Math.atan2(dir.y, dir.x);
      this._moveAccelT = Math.min(1, this._moveAccelT + dt / ACCEL_TIME_SEC);
    } else {
      this._moveAccelT = Math.max(0, this._moveAccelT - dt / DECEL_TIME_SEC);
    }

    const speedFraction = smoothstep(this._moveAccelT);
    const speed = this.speed * this.speedMult * statusSpeedMult * speedFraction;

    this.x += Math.cos(this._lastAngle) * speed * dt;
    this.y += Math.sin(this._lastAngle) * speed * dt;

    // Knockback: somado por cima do movimento normal, decai sozinho
    // por atrito — não interrompe o controle do jogador, só empurra.
    if (Math.abs(this.knockbackVX) > 1 || Math.abs(this.knockbackVY) > 1) {
      this.x += this.knockbackVX * dt;
      this.y += this.knockbackVY * dt;
      this.knockbackVX *= this.knockbackFriction;
      this.knockbackVY *= this.knockbackFriction;
    } else {
      this.knockbackVX = 0;
      this.knockbackVY = 0;
    }

    this.sprite.position.set(this.x, this.y);
    this._updateAnimation(hasInput, dir);
    this.animator.update(dt);
  }

  _updateStatusTint() {
    if (Date.now() < (this._flashUntilMs ?? 0)) {
      this.sprite.tint = 0xffb3b3; // player já é branco por padrão, então "flash branco" seria invisível
      return;
    }
    if (this.statusReceiver.hasStatus('burn')) {
      this.sprite.tint = 0xff6b00;
    } else if (this.statusReceiver.hasStatus('freeze')) {
      this.sprite.tint = 0x00d2ff;
    } else if (this.statusReceiver.hasStatus('bleed')) {
      this.sprite.tint = 0x8a2b3d;
    } else {
      this.sprite.tint = 0xffffff;
    }
  }

  playAttackAnimation() {
    this._attackAnimUntilMs = Date.now() + 250; // curto o suficiente pra não travar o movimento por muito tempo
    this.animator.play('attack');
  }

  _updateAnimation(hasInput, dir) {
    if (Date.now() < (this._attackAnimUntilMs ?? 0)) {
      return; // animação de ataque tem prioridade — não deixa idle/walk sobrescrever antes de acabar
    }

    const isMoving = this._moveAccelT > 0.05;
    if (!isMoving) {
      this.animator.play('idle');
      return;
    }

    const angle = hasInput ? Math.atan2(dir.y, dir.x) : this._lastAngle;
    const angleDeg = (angle * 180) / Math.PI;
    let animName;
    if (Math.abs(angleDeg) < 40 || Math.abs(angleDeg) > 140) {
      animName = 'walk_side';
      this.sprite.scale.x = Math.cos(angle) < 0 ? -Math.abs(this.sprite.scale.x) : Math.abs(this.sprite.scale.x);
    } else if (angleDeg > 0) {
      animName = 'walk_down';
    } else {
      animName = 'walk_up';
    }
    this.animator.play(animName);
  }

  takeDamage(rawDamage) {
    if (this._isDead || this.isInvulnerable()) return 0;
    const reduction = this.armor > 0 ? this.armor / (this.armor + 200) : 0;
    const finalDamage = Math.max(1, rawDamage * (1 - reduction));
    this.health = Math.max(0, this.health - finalDamage);
    this._flashUntilMs = Date.now() + 50;
    this._invulnerableUntilMs = Date.now() + 400; // i-frames — GDD 2.2
    return finalDamage;
  }

  isInvulnerable() {
    return Date.now() < (this._invulnerableUntilMs ?? 0);
  }

  applyKnockback(vx, vy) {
    this.knockbackVX = vx;
    this.knockbackVY = vy;
  }

  isAlive() {
    return this.health > 0;
  }

  playDeathAnimation() {
    this._isDead = true;
    this.animator.play('death');
  }
}
