// ====================================================================
// systems/lootSystem.js — Drops físicos ao matar inimigo: ouro (moeda
// de verdade) e gema de XP (cristal de verdade — antes o XP era
// aplicado direto ao matar, sem pickup físico; agora que temos a arte
// real do cristal, faz sentido dar o mesmo tratamento do ouro: precisa
// se aproximar/atrair com ímã pra coletar).
// ====================================================================

import { ObjectPool } from '../js/objectPool.js';
import { distance } from '../js/utils.js';

const GOLD_DROP_CHANCE = 0.12;
const MAGNET_BASE_RADIUS = 60;
const XP_GEM_MAGNET_RADIUS = 80; // um pouco maior — XP não deveria ser tão fácil de perder quanto o ouro

export class LootSystem {
  constructor({ renderer, poolSize = 60 }) {
    this.renderer = renderer;

    this.goldPool = new ObjectPool(() => this._createSprite('pickup_gold', 14), poolSize, {
      onRelease: (g) => { g.visible = false; g.position.set(-9999, -9999); },
      onAcquire: (g) => { g.visible = true; },
    });
    this._activeGold = [];

    this.xpGemPool = new ObjectPool(() => this._createSprite('pickup_xp_gem', 12), poolSize, {
      onRelease: (g) => { g.visible = false; g.position.set(-9999, -9999); },
      onAcquire: (g) => { g.visible = true; },
    });
    this._activeXpGems = [];
  }

  _createSprite(name, targetSize) {
    const PIXI = window.PIXI;
    const texture = this.renderer.getTexture(name, name);
    const sprite = new PIXI.Sprite(texture ?? PIXI.Texture.WHITE);
    sprite.anchor.set(0.5);
    const scale = targetSize / Math.max(sprite.texture.width, sprite.texture.height || 1);
    sprite.scale.set(scale);
    sprite.visible = false;
    this.renderer.worldContainer.addChild(sprite);
    return sprite;
  }

  onEnemyKilled(enemy) {
    this._maybeDropGold(enemy);
    this._dropXpGem(enemy);
  }

  _maybeDropGold(enemy) {
    const { chance, valueMin, valueMax } = this._getGoldDropProfile(enemy);
    if (Math.random() >= chance) return;

    const sprite = this.goldPool.acquire();
    if (!sprite) return;
    sprite.position.set(enemy.x, enemy.y);
    sprite._value = valueMin + Math.floor(Math.random() * (valueMax - valueMin + 1));
    this._activeGold.push(sprite);
  }

  // XP sempre solta gema (é o recurso principal de progressão — ao
  // contrário do ouro, que é bônus, XP nunca pode ser "sorte de drop").
  _dropXpGem(enemy) {
    const sprite = this.xpGemPool.acquire();
    if (!sprite) return;
    const scatter = 8; // pequeno espalhamento pra não empilhar gemas idênticas
    sprite.position.set(enemy.x + (Math.random() * scatter - scatter / 2), enemy.y + (Math.random() * scatter - scatter / 2));
    sprite._value = enemy.data.xp ?? 1;
    this._activeXpGems.push(sprite);
  }

  // Cada família de inimigo solta ouro de um jeito diferente — reforça
  // a identidade própria de cada tipo (GDD/regras da Fase 1).
  _getGoldDropProfile(enemy) {
    const id = enemy.data.id;
    if (id === 'elite') return { chance: 1.0, valueMin: 8, valueMax: 15 };
    if (id === 'tank' || id === 'brute') return { chance: 0.35, valueMin: 4, valueMax: 8 };
    if (id === 'swarm' || id === 'insect') return { chance: 0.06, valueMin: 1, valueMax: 1 };
    if (id === 'rare') return { chance: 0.9, valueMin: 6, valueMax: 12 };
    return { chance: GOLD_DROP_CHANCE, valueMin: 1, valueMax: 3 };
  }

  update(playerX, playerY, magnetMult, onCollectGold, onCollectXp) {
    this._updatePickupGroup(this._activeGold, this.goldPool, playerX, playerY, MAGNET_BASE_RADIUS * magnetMult, onCollectGold);
    this._updatePickupGroup(this._activeXpGems, this.xpGemPool, playerX, playerY, XP_GEM_MAGNET_RADIUS * magnetMult, onCollectXp);
  }

  _updatePickupGroup(activeList, pool, playerX, playerY, magnetRadius, onCollect) {
    for (let i = activeList.length - 1; i >= 0; i--) {
      const sprite = activeList[i];
      const d = distance(playerX, playerY, sprite.x, sprite.y);
      if (d < magnetRadius) {
        const pullSpeed = Math.max(80, (magnetRadius - d) * 4);
        const angle = Math.atan2(playerY - sprite.y, playerX - sprite.x);
        sprite.x += Math.cos(angle) * pullSpeed * (1 / 60);
        sprite.y += Math.sin(angle) * pullSpeed * (1 / 60);
        sprite.position.set(sprite.x, sprite.y);
      }
      if (d < 14) {
        onCollect?.(sprite._value);
        activeList.splice(i, 1);
        pool.release(sprite);
      }
    }
  }
}
