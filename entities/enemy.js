// ====================================================================
// entities/enemy.js — Controlador de inimigo data-driven. O MESMO
// script serve pra qualquer tipo (17 no total), porque o "sabor"
// específico vem de EnemyData (data/enemies.js) + o campo `behavior`,
// que decide qual função de IA roda. Cada behavior tem personalidade
// própria — nenhum deles é só "perseguir e encostar".
// ====================================================================

import { distance, angleBetween, clamp } from '../js/utils.js';
import { SecondaryMotion } from '../js/animation.js';
import { StatusReceiver } from '../systems/statusEffects.js';

export class Enemy {
  constructor({ renderer, data, x, y }) {
    this.data = data;
    this.x = x;
    this.y = y;
    this.maxHealth = data.hpMult * 40;
    this.health = this.maxHealth;
    this.speed = data.spdMult * 110;
    this.contactDamage = data.dmgMult * 8;
    this.alive = true;
    this.shieldHp = 0;
    this.knockbackVX = 0;
    this.knockbackVY = 0;
    this.stunnedUntilMs = 0;

    // Estado específico de comportamento — cada behavior usa só os
    // campos que precisa; ficam todos aqui pra não precisar de uma
    // classe por tipo de inimigo.
    this.behaviorState = {
      shootCooldownMs: 0,
      healCooldownMs: 0,
      summonCooldownMs: 0,
      phaseTimerMs: 0,
      isPhased: false,
      castTelegraphMs: 0,
      isCasting: false,
      facingAngle: 0,
      chargeCooldownMs: 0,
      isCharging: false,
    };

    this._buildSprite(renderer);
    this.statusReceiver = new StatusReceiver(this);
  }

  _buildSprite(renderer) {
    const PIXI = window.PIXI;
    const frame = renderer.getTexture('enemy', this.data.id);
    this.sprite = new PIXI.Sprite(frame || PIXI.Texture.WHITE);
    this.sprite.anchor.set(0.5, 0.65);
    this.sprite.tint = this.data.color ?? 0xffffff;
    const scale = Math.min(1, (this.data.size ?? 24) / Math.max(this.sprite.texture.width, this.sprite.texture.height || 1));
    this.sprite.scale.set(scale); // "scale" já normaliza a textura real pro data.size — sem multiplicador extra
    this.sprite.position.set(this.x, this.y);
    renderer.worldContainer.addChild(this.sprite);

    this.secondaryMotion = new SecondaryMotion(this.sprite, { breathingSpeed: 2 + Math.random() });

    // Raio de colisão real, calculado das dimensões RENDERIZADAS do
    // sprite (não do valor bruto data.size) — sprites largos/não
    // quadrados (como a arte real do Rastejante, 724×505) tinham um
    // raio maior que a área visível de fato, causando dano "do nada".
    const apparentWidth = this.sprite.texture.width * this.sprite.scale.x;
    const apparentHeight = this.sprite.texture.height * this.sprite.scale.y;
    this.collisionRadius = Math.max(6, Math.min(apparentWidth, apparentHeight) * 0.4);
  }

  // ---- Ponto de entrada único de update — despacha pro comportamento certo ----
  update(dt, ctx) {
    if (!this.alive) return;

    this.statusReceiver.update(dt, (dmg, statusName) => {
      this.takeDamage(dmg, { fromAngle: null });
      const color = statusName === 'burn' ? 0xff6b00 : 0x8a2b3d;
      if (ctx.statusDamageFn) {
        ctx.statusDamageFn(this.x, this.y, dmg, color);
      } else {
        ctx.particlesFn?.(this.x, this.y, { color, count: 4 });
      }
    });
    this._updateStatusTint(); // sempre roda aqui — os returns antecipados abaixo (atordoamento/flinch) não devem pular isso

    if (this.statusReceiver.isStunned()) {
      // Atordoado (GDD/Volume VII): zera intenção de movimento, só
      // sofre o conhecimento físico que já estava rolando.
      this._applyKnockback(dt);
      this.sprite.position.set(this.x, this.y);
      this.secondaryMotion.update(dt);
      return;
    }

    if (Date.now() < this.stunnedUntilMs) {
      this._applyKnockbackOnly(dt);
      this.secondaryMotion.update(dt);
      return;
    }

    const speedFromStatus = this.statusReceiver.getSpeedMultiplier();
    const behaviorFn = BEHAVIORS[this.data.behavior] || BEHAVIORS.chase;
    behaviorFn(this, dt * speedFromStatus, ctx);

    this._applyKnockback(dt);
    this.sprite.position.set(this.x, this.y);
    this.secondaryMotion.update(dt);
  }

  // Feedback visual dos status effects — sobrepõe a cor normal do
  // inimigo enquanto o efeito está ativo, sem precisar de um sprite
  // extra por status.
  _updateStatusTint() {
    if (Date.now() < (this._flashUntilMs ?? 0)) {
      this.sprite.tint = 0xffffff;
      return;
    }
    if (this.statusReceiver.hasStatus('burn')) {
      this.sprite.tint = 0xff6b00;
    } else if (this.statusReceiver.hasStatus('freeze')) {
      this.sprite.tint = 0x00d2ff;
    } else if (this.statusReceiver.hasStatus('bleed')) {
      this.sprite.tint = 0x8a2b3d;
    } else {
      this.sprite.tint = this.data.color ?? 0xffffff;
    }
  }

  _applyKnockback(dt) {
    if (Math.abs(this.knockbackVX) > 1 || Math.abs(this.knockbackVY) > 1) {
      this.x += this.knockbackVX * dt;
      this.y += this.knockbackVY * dt;
      this.knockbackVX *= 0.9;
      this.knockbackVY *= 0.9;
    }
  }

  _applyKnockbackOnly(dt) {
    this.x += this.knockbackVX * dt;
    this.y += this.knockbackVY * dt;
    this.knockbackVX *= 0.9;
    this.knockbackVY *= 0.9;
    this.sprite.position.set(this.x, this.y);
  }

  moveToward(targetX, targetY, dt, speedMult = 1) {
    const angle = angleBetween(this.x, this.y, targetX, targetY);
    this.behaviorState.facingAngle = angle;
    this.x += Math.cos(angle) * this.speed * speedMult * dt;
    this.y += Math.sin(angle) * this.speed * speedMult * dt;
    this.sprite.scale.x = Math.cos(angle) < 0 ? -Math.abs(this.sprite.scale.x) : Math.abs(this.sprite.scale.x);
  }

  moveAway(targetX, targetY, dt, speedMult = 1) {
    const angle = angleBetween(targetX, targetY, this.x, this.y);
    this.x += Math.cos(angle) * this.speed * speedMult * dt;
    this.y += Math.sin(angle) * this.speed * speedMult * dt;
  }

  takeDamage(rawDamage, { fromAngle = null } = {}) {
    let finalDamage = rawDamage;

    // Sentinela Blindada: mitiga 80% na frente, normal na retaguarda
    // (Volume VIII, "Guardião de Ferro" — mesmo padrão de design).
    if (this.data.behavior === 'shielded' && fromAngle !== null) {
      const facing = this.behaviorState.facingAngle;
      let diff = Math.abs(fromAngle - facing);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      const isFrontHit = diff < Math.PI / 2;
      if (isFrontHit) finalDamage *= 0.2;
    }

    // Escudo do Elite Corrompido: absorve dano antes de chegar na vida
    // de verdade. Existia a atribuição do valor, mas nada consumia —
    // o "escudo" não protegia nada até agora.
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, finalDamage);
      this.shieldHp -= absorbed;
      finalDamage -= absorbed;
    }

    this.health = Math.max(0, this.health - finalDamage);
    this.secondaryMotion.playHitSquash();
    this.stunnedUntilMs = Date.now() + 120; // flinch curto, não trava o combate
    this._flashUntilMs = Date.now() + 50; // ~3 frames a 60fps — flash branco de impacto (GDD 2.3)

    if (this.health <= 0) this.alive = false;
    return finalDamage;
  }

  applyKnockback(vx, vy) {
    if (this.data.knockbackResist >= 1) return;
    const resist = this.data.knockbackResist ?? 0;
    this.knockbackVX = vx * (1 - resist);
    this.knockbackVY = vy * (1 - resist);
  }

  destroy() {
    this.sprite.destroy();
  }
}

// ====================================================================
// Cada behavior recebe (enemy, dt, ctx) e decide o movimento/ação.
// `ctx` = { player, enemies, spawnEnemyFn, fireProjectileFn, particlesFn }
// — injetado pelo SpawnSystem, não importado direto (evita import
// circular entre enemy.js e os systems que o gerenciam).
// ====================================================================
const BEHAVIORS = {
  // Perseguição direta — usada por trash mobs simples (grunt, runner,
  // tank, swarm, brute, insect, rare). Ainda tem personalidade via
  // speed/hp multiplicadores bem diferentes entre si (ver data/enemies.js).
  // Perseguição direta — usada por trash mobs simples (grunt, runner,
  // tank, swarm, brute, insect, rare). Tem separação leve dos vizinhos
  // mais próximos (não é flocking completo como o splitter, só o
  // suficiente pra não empilhar sprites perfeitamente um em cima do
  // outro — importante pro swarm/insect, que aparecem em quantidade).
  chase(enemy, dt, ctx) {
    const toPlayerAngle = angleBetween(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    let moveX = Math.cos(toPlayerAngle), moveY = Math.sin(toPlayerAngle);

    const nearby = ctx.enemyGrid ? ctx.enemyGrid.queryNearby(enemy.x, enemy.y) : null;
    if (nearby) {
      let sepX = 0, sepY = 0, count = 0;
      for (const other of nearby) {
        if (other === enemy || !other.alive) continue;
        const d = distance(enemy.x, enemy.y, other.x, other.y);
        if (d < 22 && d > 0) {
          sepX += (enemy.x - other.x) / d;
          sepY += (enemy.y - other.y) / d;
          count++;
        }
      }
      if (count > 0) {
        moveX += (sepX / count) * 0.6; // peso bem menor que o splitter — só desempilha, não vira flocking
        moveY += (sepY / count) * 0.6;
      }
    }

    const mag = Math.hypot(moveX, moveY) || 1;
    enemy.x += (moveX / mag) * enemy.speed * dt;
    enemy.y += (moveY / mag) * enemy.speed * dt;
    enemy.behaviorState.facingAngle = toPlayerAngle;
    enemy.sprite.scale.x = Math.cos(toPlayerAngle) < 0 ? -Math.abs(enemy.sprite.scale.x) : Math.abs(enemy.sprite.scale.x);
  },

  // Atirador (shooter/archer): mantém distância, dispara projéteis.
  // Personalidade: foge se o jogador chegar perto, ao contrário do chase.
  ranged(enemy, dt, ctx) {
    const dist = distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    const preferredRange = 220;
    if (dist < preferredRange - 30) {
      enemy.moveAway(ctx.player.x, ctx.player.y, dt, 0.8);
    } else if (dist > preferredRange + 30) {
      enemy.moveToward(ctx.player.x, ctx.player.y, dt, 0.6);
    } else {
      enemy.behaviorState.facingAngle = angleBetween(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    }

    enemy.behaviorState.shootCooldownMs -= dt * 1000;
    if (enemy.behaviorState.shootCooldownMs <= 0 && dist < preferredRange + 60) {
      enemy.behaviorState.shootCooldownMs = 1800;
      ctx.fireProjectileFn?.(enemy, ctx.player.x, ctx.player.y);
    }
  },

  archer: (enemy, dt, ctx) => BEHAVIORS.ranged(enemy, dt, ctx), // mesma lógica, cooldown/dano vêm de enemy.data

  // Curandeiro: fica perto de outros inimigos e os cura periodicamente,
  // foge do jogador em vez de atacar — prioridade é apoio, não dano.
  healer(enemy, dt, ctx) {
    enemy.moveAway(ctx.player.x, ctx.player.y, dt, 0.7);
    enemy.behaviorState.healCooldownMs -= dt * 1000;
    if (enemy.behaviorState.healCooldownMs <= 0) {
      enemy.behaviorState.healCooldownMs = 3000;
      const nearby = ctx.enemyGrid ? ctx.enemyGrid.queryNearby(enemy.x, enemy.y) : ctx.enemies;
      for (const other of nearby) {
        if (other === enemy || !other.alive) continue;
        if (distance(enemy.x, enemy.y, other.x, other.y) < 150) {
          other.health = Math.min(other.maxHealth, other.health + other.maxHealth * 0.15);
        }
      }
    }
  },

  // Sentinela Blindada: avança devagar sempre de frente pro jogador —
  // takeDamage() já lida com a mitigação de 80% na frente.
  shielded(enemy, dt, ctx) {
    enemy.moveToward(ctx.player.x, ctx.player.y, dt, 0.6);
  },

  // Espectro: alterna entre fase sólida (perseguindo) e fase intangível
  // (atravessa o jogador sem dano de contato, mas também não pode ser
  // acertado) — personalidade de "hostil por rajadas", não constante.
  phase(enemy, dt, ctx) {
    enemy.behaviorState.phaseTimerMs -= dt * 1000;
    if (enemy.behaviorState.phaseTimerMs <= 0) {
      enemy.behaviorState.isPhased = !enemy.behaviorState.isPhased;
      enemy.behaviorState.phaseTimerMs = enemy.behaviorState.isPhased ? 1500 : 2500;
      enemy.sprite.alpha = enemy.behaviorState.isPhased ? 0.35 : 1;
    }
    enemy.moveToward(ctx.player.x, ctx.player.y, dt, enemy.behaviorState.isPhased ? 1.4 : 0.9);
  },

  // Invocador: mantém distância e periodicamente chama reforços —
  // prioridade é multiplicar a horda, não brigar sozinho.
  summoner(enemy, dt, ctx) {
    const dist = distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    if (dist < 200) enemy.moveAway(ctx.player.x, ctx.player.y, dt, 0.6);
    else enemy.moveToward(ctx.player.x, ctx.player.y, dt, 0.5);

    enemy.behaviorState.summonCooldownMs -= dt * 1000;
    if (enemy.behaviorState.summonCooldownMs <= 0) {
      enemy.behaviorState.summonCooldownMs = 6000;
      ctx.spawnEnemyFn?.('grunt', enemy.x + 20, enemy.y + 20);
      ctx.spawnEnemyFn?.('grunt', enemy.x - 20, enemy.y - 20);
    }
  },

  // Explosivo: corre RÁPIDO até o jogador (mais rápido que o normal) e
  // detona ao morrer ou ao encostar — personalidade de "kamikaze".
  // Explosivo: corre rápido até o jogador. Quando entra no raio de
  // detonação, pulsa (fica claro/escuro alternado) como aviso — sem
  // isso, a explosão parece injusta ("surgiu do nada"). O pulsar em si
  // é só visual aqui; o dano de verdade acontece no damageSystem
  // quando ele efetivamente morre perto do jogador.
  exploder(enemy, dt, ctx) {
    enemy.moveToward(ctx.player.x, ctx.player.y, dt, 1.4);

    const dist = distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    const DETONATION_WARNING_RADIUS = 110; // um pouco maior que o raio real de explosão (90px)
    if (dist < DETONATION_WARNING_RADIUS) {
      enemy._explodingWarning = true;
      const pulse = Math.sin(Date.now() / 60) > 0;
      enemy.sprite.tint = pulse ? 0xff6b00 : 0xffffff;
    } else if (enemy._explodingWarning) {
      enemy._explodingWarning = false; // sai do alcance — volta ao tint normal no próximo _updateStatusTint()
    }
  },

  // Mago Sombrio: para, telegrafa (fica vermelho) e depois causa dano
  // em área onde o jogador estava — recompensa o jogador que se move,
  // pune quem fica parado. Comportamento totalmente diferente de todos
  // os outros (não persegue enquanto conjura).
  mage(enemy, dt, ctx) {
    if (enemy.behaviorState.isCasting) {
      enemy.behaviorState.castTelegraphMs -= dt * 1000;
      if (enemy.behaviorState.castTelegraphMs <= 0) {
        enemy.behaviorState.isCasting = false;
        ctx.particlesFn?.(ctx.player.x, ctx.player.y, { color: 0x9d00ff, count: 16 });
        if (distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y) < 300) {
          ctx.damagePlayerAtFn?.(ctx.player.x, ctx.player.y, 60, 40);
        }
      }
      return;
    }
    const dist = distance(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    if (dist > 260) {
      enemy.moveToward(ctx.player.x, ctx.player.y, dt, 0.5);
    } else {
      enemy.behaviorState.shootCooldownMs -= dt * 1000;
      if (enemy.behaviorState.shootCooldownMs <= 0) {
        enemy.behaviorState.shootCooldownMs = 4000;
        enemy.behaviorState.isCasting = true;
        enemy.behaviorState.castTelegraphMs = 900;
      }
    }
  },

  // Elite Corrompido: avança e periodicamente dá escudo temporário a
  // aliados próximos — suporte + ameaça direta ao mesmo tempo.
  elite(enemy, dt, ctx) {
    enemy.moveToward(ctx.player.x, ctx.player.y, dt, 0.85);
    enemy.behaviorState.healCooldownMs -= dt * 1000;
    if (enemy.behaviorState.healCooldownMs <= 0) {
      enemy.behaviorState.healCooldownMs = 3500;
      const nearby = ctx.enemyGrid ? ctx.enemyGrid.queryNearby(enemy.x, enemy.y) : ctx.enemies;
      for (const other of nearby) {
        if (other === enemy || !other.alive) continue;
        if (distance(enemy.x, enemy.y, other.x, other.y) < 150) {
          other.shieldHp = (other.maxHealth ?? 0) * 0.2;
        }
      }
    }
  },

  // Enxame Larval: comportamento de flocking real (separação de
  // vizinhos) além de perseguir — evita que o "enxame" vire uma pilha
  // única de sprites sobrepostos (Volume VIII, seção 3, Steering Behaviors).
  splitter(enemy, dt, ctx) {
    let sepX = 0, sepY = 0, count = 0;
    const nearby = ctx.enemyGrid ? ctx.enemyGrid.queryNearby(enemy.x, enemy.y) : ctx.enemies;
    for (const other of nearby) {
      if (other === enemy || !other.alive) continue;
      const d = distance(enemy.x, enemy.y, other.x, other.y);
      if (d < 30 && d > 0) {
        sepX += (enemy.x - other.x) / d;
        sepY += (enemy.y - other.y) / d;
        count++;
      }
    }
    const toPlayerAngle = angleBetween(enemy.x, enemy.y, ctx.player.x, ctx.player.y);
    let moveX = Math.cos(toPlayerAngle), moveY = Math.sin(toPlayerAngle);
    if (count > 0) {
      moveX += (sepX / count) * 1.5;
      moveY += (sepY / count) * 1.5;
    }
    const mag = Math.hypot(moveX, moveY) || 1;
    enemy.x += (moveX / mag) * enemy.speed * dt;
    enemy.y += (moveY / mag) * enemy.speed * dt;
  },
};

export function registerBehavior(name, fn) {
  BEHAVIORS[name] = fn;
}
