// ====================================================================
// systems/evolutionSystem.js — Ao atingir o nível máximo (8) de uma
// arma E possuir a relíquia correspondente, a arma evolui pra uma
// forma mais forte (dobra dano/efeito, ganha um efeito visual novo).
// Não existe dado de evolução em data/weapons.js (versão anterior
// perdeu isso na conversão) — o mapa abaixo é minha definição nova,
// pareando cada arma com uma relíquia tematicamente combinando.
// ====================================================================

const EVOLUTION_MAP = {
  arco_arcano: { requiredRelicId: 'fome_abissal', evolvedName: 'Arco do Juízo Final', damageMult: 2.2 },
  lamina_dupla: { requiredRelicId: 'furia_critica', evolvedName: 'Lâminas Gêmeas Ancestrais', damageMult: 2.0 },
  chuva_flechas: { requiredRelicId: 'ecos_eternos', evolvedName: 'Tempestade de Flechas', damageMult: 2.0 },
  lanca_furia: { requiredRelicId: 'coracao_abismo', evolvedName: 'Lança do Abismo Eterno', damageMult: 2.3 },
  anel_vazio: { requiredRelicId: 'maldicao_vazio', evolvedName: 'Anel do Colapso', damageMult: 2.4 },
  foice_sombria: { requiredRelicId: 'coracao_abismo', evolvedName: 'Foice do Ceifador Ancestral', damageMult: 2.3 },
};

export class EvolutionSystem {
  constructor({ relicSystem, blessingsData }) {
    this.relicSystem = relicSystem;
    this.blessingsData = blessingsData;
    this.evolved = new Set();
  }

  checkEvolution(weaponSystem) {
    const rule = EVOLUTION_MAP[weaponSystem.weaponData.id];
    if (!rule) return false;
    if (this.evolved.has(weaponSystem.weaponData.id)) return false;

    const levelArray = weaponSystem.weaponData.damage_per_level || weaponSystem.weaponData.damagePerLevel;
    const maxLevel = levelArray ? levelArray.length : 8;
    if (weaponSystem.level < maxLevel) return false;
    if (!this.relicSystem.hasRelic(rule.requiredRelicId, this.blessingsData)) return false;

    this._applyEvolution(weaponSystem, rule);
    return true;
  }

  _applyEvolution(weaponSystem, rule) {
    weaponSystem.weaponData = {
      ...weaponSystem.weaponData,
      name: rule.evolvedName,
      baseDamage: (weaponSystem.weaponData.baseDamage ?? 20) * rule.damageMult,
      evolved: true,
    };
    this.evolved.add(weaponSystem.weaponData.id);
  }

  isEvolved(weaponId) {
    return this.evolved.has(weaponId);
  }
}
