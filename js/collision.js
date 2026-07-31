// ====================================================================
// collision.js — Detecção de colisão pura. Sem motor de física (PixiJS
// não tem um embutido) — círculos e retângulos alinhados aos eixos,
// que é o suficiente pro tipo de jogo (personagens/projéteis/inimigos
// redondos, hitboxes simples).
// ====================================================================

export function circleCircle(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1;
  const radiusSum = r1 + r2;
  return (dx * dx + dy * dy) <= radiusSum * radiusSum;
}

export function pointInCircle(px, py, cx, cy, radius) {
  const dx = px - cx, dy = py - cy;
  return (dx * dx + dy * dy) <= radius * radius;
}

export function aabbAabb(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// ---- Grade espacial (spatial hash) ----
// Necessário pra checar colisão entre milhares de entidades sem virar
// O(n²) — em vez de testar todo projétil contra todo inimigo, só
// testamos contra quem está na mesma célula (ou célula vizinha).
export class SpatialGrid {
  constructor(cellSize = 128) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  _cellOf(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  clear() {
    this.cells.clear();
  }

  insert(entity, x, y) {
    const [cx, cy] = this._cellOf(x, y);
    const key = this._key(cx, cy);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(entity);
  }

  // Retorna todas as entidades nas células vizinhas (3x3) de um ponto —
  // suficiente pra qualquer entidade com raio menor que cellSize.
  queryNearby(x, y) {
    const [cx, cy] = this._cellOf(x, y);
    const results = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.cells.get(this._key(cx + dx, cy + dy));
        if (bucket) results.push(...bucket);
      }
    }
    return results;
  }
}
