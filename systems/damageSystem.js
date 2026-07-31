// ====================================================================
// systems/damageSystem.js — Aplica dano por colisão: projéteis do
// jogador contra inimigos, contato de inimigo contra o jogador. Usa
// círculo-círculo simples (collision.js) — suficiente pra esse tipo de
// entidade, sem precisar de um motor de física completo.
// ====================================================================

import { circleCircle, SpatialGrid } from '../js/collision.js';
import { distance } from '../js/utils.js';

const PROJECTILE_RADIUS = 4;
const GRID_CELL_SIZE = 96; // um pouco maior que o maior raio de inimigo comum

export class DamageSystem {
  constructor({ camera, particles, damageNumbers, audio, game, lootSystem }) {
    this.camera = camera;
    this.particles = particles;
    this.damageNumbers = damageNumbers;
    this.audio = audio;
    this.game = game;
    this.lootSystem = lootSystem;
    this._grid = new SpatialGrid(GRID_CELL_SIZE);
  }

  update({ player, enemies, weaponSystems }) {
    this._lastPlayerRef = player;
    // Reconstrói a grade UMA vez por frame — todo o resto da colisão
    // deste frame consulta ela em vez de iterar a lista inteira de
    // inimigos a cada projétil. Com centenas de inimigos e milhares de
    // projéteis, isso é a diferença entre O(P×E) e O(P×k) (k = poucos
    // vizinhos por célula).
    this._grid.clear();
    for (const enemy of enemies) {
      if (enemy.alive) this._grid.insert(enemy, enemy.x, enemy.y);
    }

    this._checkProjectilesVsEnemies(weaponSystems);
    this._checkEnemiesVsPlayer(player, enemies);
  }

  _checkProjectilesVsEnemies(weaponSystems) {
    for (const weapon of weaponSystems) {
      weapon.pool.forEachActive((proj) => {
        if (!proj.active || proj.isEnemyProjectile) return;
        const nearby = this._grid.queryNearby(proj.x, proj.y);
        for (const enemy of nearby) {
          if (!enemy.alive || proj.hasHit(enemy)) continue;
          const enemyRadius = (enemy.data.size ?? 24) * 0.35;
          if (circleCircle(proj.x, proj.y, PROJECTILE_RADIUS, enemy.x, enemy.y, enemyRadius)) {
            this._applyProjectileHit(proj, enemy);
          }
        }
      });
    }
  }

  _applyProjectileHit(proj, enemy) {
    const player = this._lastPlayerRef;
    const critChance = 0.1 + (player?.critChanceAdd ?? 0); // 10% base + bônus de bênção (precisao_mortal etc)
    const critDamageMult = player?.critDamageMult ?? 2;
    const isCrit = Math.random() < critChance;
    const finalDamage = proj.damage * (isCrit ? critDamageMult : 1);
    const fromAngle = Math.atan2(enemy.y - proj.y, enemy.x - proj.x);
    const dealt = enemy.takeDamage(finalDamage, { fromAngle });
    this.game.registerDamageDealt(dealt);

    // Crítico ignífero: acerto crítico também aplica Queimadura (Volume
    // VII) — dá um motivo mecânico real pro jogador perseguir crits,
    // além do dano imediato.
    if (isCrit) enemy.statusReceiver.apply('burn', { baseDamage: finalDamage });

    enemy.applyKnockback(Math.cos(fromAngle) * 140, Math.sin(fromAngle) * 140);

    this.damageNumbers?.spawn(enemy.x, enemy.y, dealt, isCrit);
    this.particles?.burst({ x: enemy.x, y: enemy.y, count: isCrit ? 14 : 8, color: isCrit ? 0xffd054 : 0x00d2ff });
    this.audio?.playSfx(isCrit ? 'hitCrit' : 'hit');
    if (isCrit) this.camera?.shakeForCritHit();

    if (!proj.registerHit(enemy)) {
      // perfuração acabou — o projétil já se desativou sozinho
    }

    if (!enemy.alive) {
      this.game.registerKill();
      this.lootSystem?.onEnemyKilled(enemy);
      this.particles?.burst({ x: enemy.x, y: enemy.y, count: 16, color: 0x8a2b3d, speedMax: 220 });
      this.audio?.playSfx('enemyDeath');
      this._maybeExplode(enemy);
    }
  }

  // Kamikaze: ao morrer, causa dano em área — sua "personalidade" (GDD/
  // continua o mesmo mesmo que tenha sido morto à distância, não só no
  // contato) é uma ameaça mesmo depois de abatido, se o jogador estiver
  // perto demais quando ele cai.
  _maybeExplode(enemy) {
    if (enemy.data.behavior !== 'exploder') return;
    if (!this._lastPlayerRef) return;
    const player = this._lastPlayerRef;
    const explosionRadius = 90;
    const d = distance(player.x, player.y, enemy.x, enemy.y);
    this.particles?.burst({ x: enemy.x, y: enemy.y, count: 30, color: 0xff6b00, speedMax: 320, lifetimeMs: 450 });
    this.camera?.shakeForAreaDamage();
    if (d <= explosionRadius) {
      const dealt = player.takeDamage(enemy.contactDamage * 2.5);
      this.game.registerDamageTaken(dealt);
      this.damageNumbers?.spawn(player.x, player.y, dealt, false);
      if (dealt > player.maxHealth * 0.25) this.game.triggerHitStop(67, 0.05);
    }
  }

  _checkEnemiesVsPlayer(player, enemies) {
    const HEAVY_HITTERS = new Set(['tank', 'brute']);
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const enemyRadius = (enemy.data.size ?? 24) * 0.35;
      if (circleCircle(player.x, player.y, player.collisionRadius, enemy.x, enemy.y, enemyRadius)) {
        const dealt = player.takeDamage(enemy.contactDamage);
        if (dealt <= 0) continue; // invulnerável — sem dano, sem knockback, sem sfx
        this.game.registerDamageTaken(dealt);

        this.damageNumbers?.spawn(player.x, player.y, dealt, false);
        this.audio?.playSfx('hurt');
        this.camera?.shakeForPlayerDamage();

        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const knockbackForce = (enemy.data.behavior === 'exploder' ? 260 : 160);
        player.applyKnockback(Math.cos(angle) * knockbackForce, Math.sin(angle) * knockbackForce);

        // Espinhos Cristalinos: reflete % do dano recebido de volta pro
        // inimigo que encostou — bênção existia mas nunca era aplicada.
        if (player.thornsPct > 0) {
          const thornsDamage = dealt * player.thornsPct;
          const thornsDealt = enemy.takeDamage(thornsDamage, { fromAngle: null });
          this.damageNumbers?.spawn(enemy.x, enemy.y, thornsDealt, false);
        }

        // Golpes pesados (tank/brute) sangram — personalidade de dano
        // diferente dos inimigos comuns, GDD/Volume VII.
        if (HEAVY_HITTERS.has(enemy.data.id)) {
          player.statusReceiver.apply('bleed');
        }

        if (dealt > player.maxHealth * 0.25) {
          this.game.triggerHitStop(67, 0.05); // GDD 2.2 — dano >25% da vida máxima
        }
      }
    }
  }
}
