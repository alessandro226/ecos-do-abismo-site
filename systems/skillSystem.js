// ====================================================================
// systems/skillSystem.js — Orquestra a escolha de level-up. Monta o
// pool de opções (armas não maxadas + bênçãos não maxadas), sorteia 3,
// evita repetir as últimas ofertas. Não sabe nada sobre a UI — só
// devolve os dados; quem desenha os cards é ui.js/main.js.
// ====================================================================

import { weightedPick } from '../js/utils.js';

const RARITY_WEIGHTS = {
  Comum: 10, Incomum: 6, Raro: 4, Epico: 2, Lendario: 1, Mitico: 0.5,
};

const CHOICES_PER_LEVEL_UP = 3;
const RECENT_OFFERS_WINDOW = 6;

export class SkillSystem {
  constructor({ weaponsData, blessingsData, blessingSystem, inventory }) {
    this.weaponsData = weaponsData;
    this.blessingsData = blessingsData;
    this.blessingSystem = blessingSystem;
    this.inventory = inventory;
    this._recentOffers = [];
  }

  buildChoicePool() {
    const pool = [];

    for (const weapon of this.weaponsData) {
      const currentLevel = this.inventory.getWeaponLevel(weapon.id);
      const levelArray = weapon.damage_per_level || weapon.damagePerLevel;
      const maxLevel = levelArray ? levelArray.length : 8; // padrão: 8 níveis, igual ao resto do design
      if (currentLevel >= maxLevel) continue;
      if (!this.inventory.hasFreeWeaponSlot() && currentLevel === 0) continue;
      if (this._recentOffers.includes(weapon.id)) continue;
      pool.push({ kind: 'weapon', data: weapon, rarity: weapon.rarity || 'Comum' });
    }

    for (const blessing of this.blessingsData) {
      if (!this.blessingSystem.canApply(blessing.id)) continue;
      if (this._recentOffers.includes(blessing.id)) continue;
      pool.push({ kind: 'blessing', data: blessing, rarity: blessing.rarity || 'Comum' });
    }

    return pool;
  }

  rollChoices() {
    const pool = this.buildChoicePool();
    if (pool.length === 0) return [];

    const chosen = [];
    const remaining = [...pool];
    const count = Math.min(CHOICES_PER_LEVEL_UP, remaining.length);

    for (let i = 0; i < count; i++) {
      const pick = weightedPick(remaining, RARITY_WEIGHTS);
      chosen.push(pick);
      remaining.splice(remaining.indexOf(pick), 1);
    }

    for (const choice of chosen) this._registerRecentOffer(choice.data.id);
    return chosen;
  }

  _registerRecentOffer(id) {
    this._recentOffers.push(id);
    while (this._recentOffers.length > RECENT_OFFERS_WINDOW) this._recentOffers.shift();
  }

  applyChoice(choice, player) {
    if (choice.kind === 'weapon') {
      this.inventory.addOrLevelUpWeapon(choice.data);
    } else if (choice.kind === 'blessing') {
      this.blessingSystem.apply(choice.data.id, player);
    }
  }
}
