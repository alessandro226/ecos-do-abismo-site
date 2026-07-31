// ====================================================================
// systems/relicSystem.js — Relíquias são as bênçãos de raridade
// Épico+/Lendário/Mítico (mesma decisão de arquitetura das versões
// anteriores deste projeto: não é uma tabela de dados separada, é um
// filtro sobre BLESSINGS). Rastreadas aqui separadamente do
// BlessingSystem só pra servir de pré-requisito de evolução de arma.
// ====================================================================

const RELIC_RARITIES = ['Epico', 'Lendario', 'Mitico'];

export class RelicSystem {
  constructor(blessingSystem) {
    this.blessingSystem = blessingSystem;
  }

  hasRelic(blessingId, blessingsData) {
    const data = blessingsData.find((b) => b.id === blessingId);
    if (!data || !RELIC_RARITIES.includes(data.rarity)) return false;
    return this.blessingSystem.getStacks(blessingId) > 0;
  }

  getOwnedRelics(blessingsData) {
    return blessingsData.filter(
      (b) => RELIC_RARITIES.includes(b.rarity) && this.blessingSystem.getStacks(b.id) > 0
    );
  }
}
