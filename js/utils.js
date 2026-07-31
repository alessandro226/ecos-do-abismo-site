// ====================================================================
// utils.js — Funções auxiliares pequenas e puras. Nada aqui depende de
// PixiJS nem do DOM, então tudo é testável isoladamente no Node.
// ====================================================================

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smoothstep — curva sigmoide 3t²-2t³, usada na aceleração/desaceleração
// do jogador (GDD 2.1) e em vários outros lugares de "game feel".
export function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function angleBetween(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Sorteio ponderado por raridade — cada item precisa ter um campo
// `rarity` que exista como chave em rarityTable, com um `.weight`.
export function weightedPick(list, rarityTable) {
  const total = list.reduce((sum, it) => sum + (rarityTable[it.rarity]?.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of list) {
    r -= (rarityTable[it.rarity]?.weight || 1);
    if (r <= 0) return it;
  }
  return list[list.length - 1];
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
