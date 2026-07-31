// Dados extraídos de data/bosses.json — embutido como módulo JS (não fetch)
// pra funcionar abrindo o index.html direto do disco (file://), sem servidor.
export const BOSSES = [
  {
    "id": "guardiao",
    "name": "Guardião do Abismo",
    "tier": "Chefe",
    "shape": "square",
    "color": 2756656,
    "size": 64,
    "hp": 2600,
    "spd": 48,
    "dmg": 24,
    "xp": 60,
    "subtitle": "Guardião Ancestral do Vazio",
    "lore": "Esculpido nas primeiras eras do Abismo, permanece imóvel por séculos — até sentir uma presença viva por perto.",
    "behaviorStyle": "melee",
    "resistAoE": 0.3,
    "resistProjectile": 0.1,
    "baseAttackPattern": [
      "slam"
    ],
    "attackIntervalMs": 4200,
    "phases": [
      {
        "atHpPct": 0.6,
        "speedMult": 1.25,
        "minionBurst": 3,
        "addAttacks": [
          "barrage"
        ],
        "invulnMs": 700,
        "message": "⚠ O Guardião desperta!"
      },
      {
        "atHpPct": 0.3,
        "speedMult": 1.5,
        "minionBurst": 4,
        "dmgMult": 1.3,
        "addAttacks": [
          "summon"
        ],
        "invulnMs": 900,
        "message": "⚠ Fúria do Guardião!",
        "tintOverride": 6033456
      }
    ]
  },
  {
    "id": "arauto",
    "name": "Arauto das Sombras",
    "tier": "Chefe",
    "shape": "circle",
    "color": 1051168,
    "size": 70,
    "hp": 4200,
    "spd": 60,
    "dmg": 30,
    "xp": 90,
    "subtitle": "Arauto do Medo Sussurrante",
    "lore": "Não tem corpo — apenas a sombra que os outros temem se tornar. Alimenta-se da hesitação.",
    "behaviorStyle": "ranged",
    "resistAoE": 0.2,
    "resistProjectile": 0.3,
    "baseAttackPattern": [
      "barrage",
      "blink"
    ],
    "attackIntervalMs": 3600,
    "phases": [
      {
        "atHpPct": 0.65,
        "speedMult": 1.2,
        "minionBurst": 3,
        "addAttacks": [
          "summon"
        ],
        "invulnMs": 700,
        "message": "⚠ As sombras se agitam!"
      },
      {
        "atHpPct": 0.35,
        "speedMult": 1.4,
        "minionBurst": 5,
        "dmgMult": 1.35,
        "addAttacks": [
          "barrage"
        ],
        "invulnMs": 900,
        "message": "⚠ O Arauto enlouquece!",
        "tintOverride": 2755130
      }
    ]
  },
  {
    "id": "colosso_primordial",
    "name": "Colosso Primordial",
    "tier": "Chefe Ancestral",
    "shape": "square",
    "color": 4861454,
    "size": 78,
    "hp": 7200,
    "spd": 42,
    "dmg": 34,
    "xp": 140,
    "subtitle": "Eco de Antes do Abismo",
    "lore": "Mais velho que o próprio Abismo. Cada passo seu deixa a terra rachada e ardente.",
    "behaviorStyle": "melee",
    "resistAoE": 0.4,
    "resistProjectile": 0.25,
    "baseAttackPattern": [
      "slam",
      "hazard"
    ],
    "attackIntervalMs": 4000,
    "phases": [
      {
        "atHpPct": 0.7,
        "speedMult": 1.15,
        "minionBurst": 3,
        "addAttacks": [
          "summon"
        ],
        "invulnMs": 800,
        "message": "⚠ O Colosso ruge!"
      },
      {
        "atHpPct": 0.42,
        "speedMult": 1.3,
        "minionBurst": 4,
        "dmgMult": 1.25,
        "addAttacks": [
          "barrage"
        ],
        "invulnMs": 900,
        "message": "⚠ A terra treme!",
        "tintOverride": 6961680
      },
      {
        "atHpPct": 0.18,
        "speedMult": 1.55,
        "minionBurst": 6,
        "dmgMult": 1.5,
        "addAttacks": [
          "hazard"
        ],
        "invulnMs": 1100,
        "message": "⚠ Fúria Primordial!",
        "tintOverride": 9050640
      }
    ]
  }
];
