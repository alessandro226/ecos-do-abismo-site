// ====================================================================
// systems/achievementSystem.js — Conquistas por limiar declarativo
// (estatística X do save atingiu valor Y) — mesmo padrão usado no
// projeto Godot anterior. Cobre a maioria real dos casos sem precisar
// de função de código por conquista.
// ====================================================================

export const ACHIEVEMENTS = [
  { id: 'primeiro_sangue', name: 'Primeiro Sangue', desc: 'Derrote seu primeiro inimigo.', statPath: 'totalKills', requiredValue: 1 },
  { id: 'centena', name: 'Centena', desc: 'Derrote 100 inimigos no total.', statPath: 'totalKills', requiredValue: 100 },
  { id: 'milhar', name: 'Milhar de Sombras', desc: 'Derrote 1.000 inimigos no total.', statPath: 'totalKills', requiredValue: 1000 },
  { id: 'sobrevivente', name: 'Sobrevivente', desc: 'Complete uma partida.', statPath: 'totalRuns', requiredValue: 1 },
  { id: 'veterano', name: 'Veterano do Abismo', desc: 'Complete 10 partidas.', statPath: 'totalRuns', requiredValue: 10 },
  { id: 'nivel_10', name: 'Ascensão', desc: 'Alcance o nível 10 numa partida.', statPath: 'bestLevel', requiredValue: 10 },
  { id: 'nivel_25', name: 'Poder Ancestral', desc: 'Alcance o nível 25 numa partida.', statPath: 'bestLevel', requiredValue: 25 },
  { id: 'rico', name: 'Fortuna Abissal', desc: 'Acumule 1.000 de ouro total.', statPath: 'totalGold', requiredValue: 1000 },
];

export class AchievementSystem {
  constructor(saveManager) {
    this.saveManager = saveManager;
  }

  checkAll() {
    const d = this.saveManager.data;
    const unlocked = d.achievements ?? (d.achievements = {});
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS) {
      if (unlocked[ach.id]) continue;
      const value = d[ach.statPath] ?? 0;
      if (value >= ach.requiredValue) {
        unlocked[ach.id] = true;
        newlyUnlocked.push(ach);
      }
    }

    if (newlyUnlocked.length > 0) this.saveManager.scheduleSave();
    return newlyUnlocked;
  }

  isUnlocked(id) {
    return !!this.saveManager.data.achievements?.[id];
  }
}
