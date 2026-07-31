// Dados extraídos de data/blessings.json — embutido como módulo JS (não fetch)
// pra funcionar abrindo o index.html direto do disco (file://), sem servidor.
export const BLESSINGS = [
  {
    "id": "dmg",
    "name": "Fúria Sombria",
    "icon": "⚔️",
    "rarity": "Comum",
    "kind": "stat",
    "desc": "+dano de ataque (retorno decrescente a cada repetição)."
  },
  {
    "id": "speed",
    "name": "Passo Fantasma",
    "icon": "👟",
    "rarity": "Comum",
    "kind": "stat",
    "desc": "+velocidade de movimento (retorno decrescente a cada repetição)."
  },
  {
    "id": "atkspeed",
    "name": "Frenesi",
    "icon": "💨",
    "rarity": "Incomum",
    "kind": "stat",
    "desc": "+velocidade de ataque (retorno decrescente a cada repetição)."
  },
  {
    "id": "hp",
    "name": "Coração de Pedra",
    "icon": "❤️",
    "rarity": "Comum",
    "kind": "stat",
    "desc": "+25 HP máximo e cura total."
  },
  {
    "id": "range",
    "name": "Visão do Vazio",
    "icon": "👁️",
    "rarity": "Incomum",
    "kind": "stat",
    "desc": "+alcance de ataque (retorno decrescente a cada repetição)."
  },
  {
    "id": "regen",
    "name": "Sangue do Abismo",
    "icon": "🩸",
    "rarity": "Incomum",
    "kind": "stat",
    "desc": "Regenera HP ao longo do tempo (retorno decrescente, teto de 6%/seg)."
  },
  {
    "id": "crit",
    "name": "Golpe Fatal",
    "icon": "💥",
    "rarity": "Epico",
    "kind": "stat",
    "desc": "+10% chance de crítico (x2 dano)."
  },
  {
    "id": "magnet",
    "name": "Chamado das Almas",
    "icon": "🧲",
    "rarity": "Comum",
    "kind": "stat",
    "desc": "+raio de coleta de essência (retorno decrescente a cada repetição)."
  },
  {
    "id": "armor",
    "name": "Pele de Basalto",
    "icon": "🛡️",
    "rarity": "Raro",
    "kind": "stat",
    "desc": "-15% dano recebido (máx. 85%, já com retorno decrescente embutido)."
  },
  {
    "id": "investida_brutal",
    "name": "Investida Brutal",
    "icon": "🗡️",
    "rarity": "Raro",
    "kind": "tradeoff",
    "maxStacks": 3,
    "desc": "+14% dano, porém -8% velocidade de movimento."
  },
  {
    "id": "fome_abissal",
    "name": "Fome Abissal",
    "icon": "🩸",
    "rarity": "Epico",
    "kind": "stat",
    "maxStacks": 4,
    "desc": "Cura 2,5% do dano causado como vida."
  },
  {
    "id": "couraca_ancestral",
    "name": "Couraça Ancestral",
    "icon": "🛡️",
    "rarity": "Raro",
    "kind": "tradeoff",
    "maxStacks": 3,
    "desc": "Reduz mais dano recebido, porém -6% dano de ataque."
  },
  {
    "id": "espinhos_cristalinos",
    "name": "Espinhos Cristalinos",
    "icon": "💠",
    "rarity": "Incomum",
    "kind": "stat",
    "maxStacks": 5,
    "desc": "Reflete 12% do dano de contato de volta ao atacante."
  },
  {
    "id": "passos_leves",
    "name": "Passos Leves",
    "icon": "🍃",
    "rarity": "Comum",
    "kind": "stat",
    "maxStacks": 5,
    "desc": "+6% velocidade de movimento, sem custo."
  },
  {
    "id": "fuga_abissal",
    "name": "Fuga Abissal",
    "icon": "💨",
    "rarity": "Raro",
    "kind": "tradeoff",
    "maxStacks": 3,
    "desc": "+15% velocidade de movimento, porém -10% HP máximo."
  },
  {
    "id": "furia_critica",
    "name": "Fúria Crítica",
    "icon": "💥",
    "rarity": "Epico",
    "kind": "stat",
    "maxStacks": 3,
    "desc": "Críticos causam ainda mais dano (multiplicador de crítico +20%)."
  },
  {
    "id": "precisao_mortal",
    "name": "Precisão Mortal",
    "icon": "🎯",
    "rarity": "Raro",
    "kind": "tradeoff",
    "maxStacks": 3,
    "desc": "+8% chance de crítico, porém -8% alcance de ataque."
  },
  {
    "id": "onda_de_choque",
    "name": "Onda de Choque",
    "icon": "🌊",
    "rarity": "Epico",
    "kind": "stat",
    "maxStacks": 3,
    "desc": "+18% dano de armas de área (aura)."
  },
  {
    "id": "expansao_cristalina",
    "name": "Expansão Cristalina",
    "icon": "🔷",
    "rarity": "Raro",
    "kind": "stat",
    "maxStacks": 4,
    "desc": "+12% alcance de ataque."
  },
  {
    "id": "guardioes_orbitais",
    "name": "Guardiões Orbitais",
    "icon": "⚙️",
    "rarity": "Epico",
    "kind": "stat",
    "maxStacks": 2,
    "desc": "Armas orbitais ganham +15% de dano."
  },
  {
    "id": "fervor_flamejante",
    "name": "Fervor Flamejante",
    "icon": "🔥",
    "rarity": "Raro",
    "kind": "stat",
    "maxStacks": 4,
    "desc": "+10% dano de ataque."
  },
  {
    "id": "nucleo_congelante",
    "name": "Núcleo Congelante",
    "icon": "❄️",
    "rarity": "Incomum",
    "kind": "stat",
    "maxStacks": 3,
    "desc": "+8% velocidade de ataque."
  },
  {
    "id": "ressonancia_abismo",
    "name": "Ressonância do Abismo",
    "icon": "🔮",
    "rarity": "Lendario",
    "kind": "stat",
    "maxStacks": 1,
    "desc": "+8% de dano com todas as armas."
  },
  {
    "id": "cristal_amplificador",
    "name": "Cristal Amplificador",
    "icon": "💎",
    "rarity": "Epico",
    "kind": "stat",
    "maxStacks": 3,
    "desc": "+12% raio de coleta de essência e ouro."
  },
  {
    "id": "maldicao_pressa",
    "name": "Maldição da Pressa",
    "icon": "⏳",
    "rarity": "Raro",
    "kind": "tradeoff",
    "maxStacks": 3,
    "desc": "+18% velocidade de ataque, porém +10% dano recebido."
  },
  {
    "id": "maldicao_vazio",
    "name": "Maldição do Vazio",
    "icon": "🌑",
    "rarity": "Epico",
    "kind": "tradeoff",
    "maxStacks": 2,
    "desc": "+22% dano, porém -40% regeneração."
  },
  {
    "id": "coracao_abismo",
    "name": "Coração do Abismo",
    "icon": "❤️‍🔥",
    "rarity": "Lendario",
    "kind": "stat",
    "maxStacks": 1,
    "desc": "+15% HP máximo e +8% dano, de uma vez só."
  },
  {
    "id": "ecos_eternos",
    "name": "Ecos Eternos",
    "icon": "♾️",
    "rarity": "Mitico",
    "kind": "stat",
    "maxStacks": 1,
    "desc": "+6% dano, velocidade e velocidade de ataque, tudo ao mesmo tempo."
  }
];
