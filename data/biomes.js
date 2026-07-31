// Dados extraídos de data/biomes.json — embutido como módulo JS (não fetch)
// pra funcionar abrindo o index.html direto do disco (file://), sem servidor.
export const BIOMES = [
  {
    "id": "vale_cristais",
    "name": "Vale dos Cristais",
    "untilMin": 2.5,
    "groundTint": 3824250,
    "fog": 660512,
    "particleTint": 12577023,
    "enemyTint": 16777215,
    "bossFlavor": "guardiao",
    "decorTypes": [
      "cristal_pequeno",
      "cristal_medio",
      "cristal_grande",
      "ruina",
      "pedra"
    ]
  },
  {
    "id": "pantano",
    "name": "Pântano Corrompido",
    "untilMin": 5,
    "groundTint": 2046495,
    "fog": 397062,
    "particleTint": 6279535,
    "enemyTint": 10477706,
    "bossFlavor": "arauto",
    "decorTypes": [
      "raiz",
      "cogumelo",
      "pedra",
      "cristal_pequeno"
    ]
  },
  {
    "id": "deserto",
    "name": "Deserto das Ruínas",
    "untilMin": 7.5,
    "groundTint": 9071151,
    "fog": 1709064,
    "particleTint": 14731599,
    "enemyTint": 14731658,
    "bossFlavor": null,
    "decorTypes": [
      "obelisco",
      "ossada",
      "ruina",
      "cristal_medio"
    ]
  },
  {
    "id": "gelo",
    "name": "Campos Congelados",
    "untilMin": 10,
    "groundTint": 9087680,
    "fog": 923168,
    "particleTint": 14677759,
    "enemyTint": 12574975,
    "bossFlavor": null,
    "decorTypes": [
      "pinheiro_seco",
      "cristal_pequeno",
      "cristal_medio",
      "pedra"
    ]
  },
  {
    "id": "inferno",
    "name": "Inferno Cristalino",
    "untilMin": 13,
    "groundTint": 6954783,
    "fog": 1312005,
    "particleTint": 16734783,
    "enemyTint": 16751226,
    "bossFlavor": null,
    "decorTypes": [
      "pedra_vulcanica",
      "cristal_grande",
      "cinzas"
    ]
  },
  {
    "id": "reino_ancestral",
    "name": "Reino Ancestral",
    "untilMin": 999,
    "groundTint": 2759226,
    "fog": 328458,
    "particleTint": 10514400,
    "enemyTint": 13213951,
    "bossFlavor": "colosso_primordial",
    "decorTypes": [
      "ruina",
      "cristal_grande",
      "crania",
      "altar"
    ]
  }
];
