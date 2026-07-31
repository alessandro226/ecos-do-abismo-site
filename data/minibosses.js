// Minibosses — versão intermediária entre inimigo comum e chefe.
export const MINIBOSSES = [
  {
    "id": "carrasco_espinhos",
    "name": "Carrasco de Espinhos",
    "tier": "Miniboss",
    "color": 9109053,
    "size": 42,
    "hp": 380,
    "spd": 95,
    "dmg": 14,
    "xp": 25,
    "subtitle": "Fragmento vivo da Muralha Ancestral",
    "behaviorStyle": "melee",
    "resistAoE": 0.1,
    "resistProjectile": 0,
    "attackIntervalMs": 2600,
    "phases": [
      {
        "atHpPct": 0.5,
        "speedMult": 1.4,
        "invulnMs": 400,
        "message": "⚠ O Carrasco acelera!"
      }
    ]
  },
  {
    "id": "arauto_gelido",
    "name": "Arauto Gélido",
    "tier": "Miniboss",
    "color": 53247,
    "size": 38,
    "hp": 260,
    "spd": 60,
    "dmg": 10,
    "xp": 22,
    "subtitle": "Mensageiro do Vazio Congelante",
    "behaviorStyle": "ranged",
    "resistAoE": 0,
    "resistProjectile": 0.2,
    "attackIntervalMs": 3200,
    "phases": [
      {
        "atHpPct": 0.4,
        "speedMult": 1.2,
        "dmgMult": 1.3,
        "invulnMs": 500,
        "message": "⚠ O gelo se intensifica!"
      }
    ]
  }
];
