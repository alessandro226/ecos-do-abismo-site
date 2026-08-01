// ====================================================================
// systems/spawnSystem.js — Wave Director + Difficulty Director. Decide
// QUANDO e QUANTOS inimigos aparecem, e aplica o multiplicador de
// dificuldade (game.js: difficultyMultiplier). Usa ObjectPool por tipo
// de inimigo — nenhum Enemy é criado depois do aquecimento inicial.
// ====================================================================

import { ObjectPool } from '../js/objectPool.js';
import { Enemy } from '../entities/enemy.js';
import { randRange, randInt } from '../js/utils.js';

export class SpawnSystem {
  constructor({ renderer, enemyDataList, game, poolSizePerType = 60 }) {
    this.renderer = renderer;
    this.enemyDataList = enemyDataList;
    this.game = game;

    this.pools = new Map();
    for (const data of enemyDataList) {
      const pool = new ObjectPool(
        () => new Enemy({ renderer, data, x: -9999, y: -9999 }),
        poolSizePerType,
        {
          onRelease: (enemy) => { enemy.alive = false; enemy.sprite.visible = false; enemy.sprite.position.set(-9999, -9999); },
          onAcquire: (enemy) => { enemy.sprite.visible = true; },
        }
      );
      this.pools.set(data.id, pool);
    }

    this.activeEnemies = [];
    this._spawnTimerMs = 0;
    this.baseSpawnIntervalMs = 900;
    this.spawnRadiusMin = 260;
    this.spawnRadiusMax = 340;
  }

  spawnByType(enemyId, x, y) {
    const pool = this.pools.get(enemyId);
    if (!pool) return null;
    const enemy = pool.acquire();
    if (!enemy) return null;

    this.onDiscover?.(enemyId);

    const data = this.enemyDataList.find((d) => d.id === enemyId);
    const mult = this.game.getDifficultyMultiplier();
    enemy.x = x; enemy.y = y;
    enemy.maxHealth = data.hpMult * 40 * mult;
    enemy.health = enemy.maxHealth;
    enemy.speed = data.spdMult * 110;
    enemy.contactDamage = data.dmgMult * 8 * mult;
    enemy.alive = true;
    enemy.shieldHp = 0;
    enemy._hitAnimUntilMs = 0;
    enemy.knockbackVX = 0; enemy.knockbackVY = 0;
    enemy.stunnedUntilMs = 0;
    enemy.sprite.alpha = 1;
    enemy.sprite.position.set(x, y);

    this.activeEnemies.push(enemy);
    return enemy;
  }

  _currentSpawnIntervalMs() {
    const minute = this.game.elapsedMs / 60000;
    return Math.max(220, this.baseSpawnIntervalMs - minute * 90);
  }

  update(dtMs, playerX, playerY) {
    this._spawnTimerMs += dtMs;
    const interval = this._currentSpawnIntervalMs();
    if (this._spawnTimerMs >= interval) {
      this._spawnTimerMs = 0;
      this._spawnOneAroundPlayer(playerX, playerY);
    }

    // Remove inimigos mortos da lista ativa e devolve ao pool.
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (!enemy.alive) {
        this.activeEnemies.splice(i, 1);
        this.pools.get(enemy.data.id)?.release(enemy);
      }
    }
  }

  _spawnOneAroundPlayer(playerX, playerY) {
    const data = this.enemyDataList[randInt(0, this.enemyDataList.length - 1)];
    const angle = Math.random() * Math.PI * 2;
    const radius = randRange(this.spawnRadiusMin, this.spawnRadiusMax);
    const x = playerX + Math.cos(angle) * radius;
    const y = playerY + Math.sin(angle) * radius;
    this.spawnByType(data.id, x, y);
  }

  getActiveCount() {
    return this.activeEnemies.length;
  }
}
