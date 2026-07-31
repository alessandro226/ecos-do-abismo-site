// ====================================================================
// systems/blessingSystem.js — Aplica o efeito de uma bênção ao
// jogador. Efeitos são DECLARATIVOS (stat_key + valor por stack), não
// funções arbitrárias — mais fácil de auditar e balancear, ao custo de
// bênçãos muito específicas precisarem de um stat_key novo reconhecido
// aqui em vez de lógica livre.
//
// NOTA: data/blessings.js só tem metadados (nome/ícone/raridade) — a
// versão anterior (Phaser) tinha funções `apply()` embutidas, mas isso
// se perde ao serializar pra JSON. Os valores de efeito abaixo são
// minha melhor estimativa consistente com o nome/raridade de cada
// bênção, não os valores originais exatos (que não sobreviveram à
// conversão) — vale a pena balancear depois com playtesting real.
// ====================================================================

const EFFECTS = {
  dmg: { statKey: 'damageMult', valuePerStack: 0.08, maxStacks: 6 },
  speed: { statKey: 'speedMult', valuePerStack: 0.06, maxStacks: 5 },
  atkspeed: { statKey: 'attackSpeedMult', valuePerStack: 0.07, maxStacks: 5 },
  hp: { statKey: 'maxHealthMult', valuePerStack: 0.12, maxStacks: 5 },
  range: { statKey: 'rangeMult', valuePerStack: 0.10, maxStacks: 4 },
  regen: { statKey: 'regenFlat', valuePerStack: 0.4, maxStacks: 5 },
  crit: { statKey: 'critChanceAdd', valuePerStack: 0.05, maxStacks: 5 },
  magnet: { statKey: 'magnetMult', valuePerStack: 0.20, maxStacks: 4 },
  armor: { statKey: 'armorFlat', valuePerStack: 15, maxStacks: 6 },
  fome_abissal: { statKey: 'xpMult', valuePerStack: 0.15, maxStacks: 3 },
  espinhos_cristalinos: { statKey: 'thornsPct', valuePerStack: 0.15, maxStacks: 3 },
  passos_leves: { statKey: 'speedMult', valuePerStack: 0.04, maxStacks: 5 },
  furia_critica: { statKey: 'critDamageMult', valuePerStack: 0.25, maxStacks: 4 },
  expansao_cristalina: { statKey: 'rangeMult', valuePerStack: 0.15, maxStacks: 3 },
  cristal_amplificador: { statKey: 'damageMult', valuePerStack: 0.12, maxStacks: 4 },
  coracao_abismo: { statKey: 'maxHealthMult', valuePerStack: 0.25, maxStacks: 3 },
  ecos_eternos: { statKey: 'damageMult', valuePerStack: 0.30, maxStacks: 2 },

  // "tradeoff": ganha em uma coisa, perde em outra — mais interessante
  // pra build-crafting do que só bônus puro.
  investida_brutal: { statKey: 'damageMult', valuePerStack: 0.20, maxStacks: 3, tradeoff: { statKey: 'armorFlat', valuePerStack: -10 } },
  couraca_ancestral: { statKey: 'armorFlat', valuePerStack: 40, maxStacks: 3, tradeoff: { statKey: 'speedMult', valuePerStack: -0.05 } },
  fuga_abissal: { statKey: 'speedMult', valuePerStack: 0.15, maxStacks: 3, tradeoff: { statKey: 'maxHealthMult', valuePerStack: -0.08 } },
  precisao_mortal: { statKey: 'critChanceAdd', valuePerStack: 0.12, maxStacks: 3, tradeoff: { statKey: 'attackSpeedMult', valuePerStack: -0.10 } },
  maldicao_pressa: { statKey: 'attackSpeedMult', valuePerStack: 0.18, maxStacks: 3, tradeoff: { statKey: 'armorFlat', valuePerStack: -15 } },
  maldicao_vazio: { statKey: 'damageMult', valuePerStack: 0.35, maxStacks: 2, tradeoff: { statKey: 'maxHealthMult', valuePerStack: -0.15 } },
};

export class BlessingSystem {
  constructor() {
    this.stacks = {}; // id -> quantidade
  }

  getStacks(id) {
    return this.stacks[id] ?? 0;
  }

  canApply(id) {
    const effect = EFFECTS[id];
    if (!effect) return false;
    return this.getStacks(id) < effect.maxStacks;
  }

  apply(id, player) {
    const effect = EFFECTS[id];
    if (!effect) {
      console.warn(`BlessingSystem: bênção "${id}" não tem efeito declarativo definido.`);
      return false;
    }
    if (!this.canApply(id)) return false;

    this.stacks[id] = this.getStacks(id) + 1;
    this._applyStatDelta(player, effect.statKey, effect.valuePerStack);
    if (effect.tradeoff) {
      this._applyStatDelta(player, effect.tradeoff.statKey, effect.tradeoff.valuePerStack);
    }
    return true;
  }

  _applyStatDelta(player, statKey, delta) {
    switch (statKey) {
      case 'damageMult': player.damageMult = Math.max(0.1, player.damageMult + delta); break;
      case 'speedMult': player.speedMult = Math.max(0.3, player.speedMult + delta); break;
      case 'attackSpeedMult': player.attackSpeedMult = Math.max(0.2, (player.attackSpeedMult ?? 1) + delta); break;
      case 'maxHealthMult': {
        const ratio = player.health / player.maxHealth;
        player.maxHealth = Math.max(20, player.maxHealth * (1 + delta));
        player.health = player.maxHealth * ratio;
        break;
      }
      case 'rangeMult': player.rangeMult = Math.max(0.3, (player.rangeMult ?? 1) + delta); break;
      case 'regenFlat': player.regenPerSecond = Math.max(0, (player.regenPerSecond ?? 0) + delta); break;
      case 'critChanceAdd': player.critChanceAdd = Math.max(0, player.critChanceAdd + delta); break;
      case 'magnetMult': player.magnetMult = Math.max(0.5, (player.magnetMult ?? 1) + delta); break;
      case 'armorFlat': player.armor = Math.max(0, player.armor + delta); break;
      case 'thornsPct': player.thornsPct = Math.max(0, (player.thornsPct ?? 0) + delta); break;
      case 'critDamageMult': player.critDamageMult = Math.max(1, (player.critDamageMult ?? 2) + delta); break;
      case 'xpMult': player.xpMult = Math.max(0.1, player.xpMult + delta); break;
      default:
        console.warn(`BlessingSystem: statKey "${statKey}" não reconhecido.`);
    }
  }
}

export { EFFECTS as BLESSING_EFFECTS };
