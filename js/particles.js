// ====================================================================
// particles.js — Partículas simples (bursts de impacto/morte/crítico).
// Sem lib externa — cada partícula é um PIXI.Graphics (círculo pequeno)
// com velocidade + gravidade + fade, gerenciada em pool pra não alocar
// objeto novo a cada hit.
// ====================================================================

export class ParticleSystem {
  /**
   * @param {PIXI.Container} container - onde as partículas são adicionadas
   * @param {typeof PIXI} PIXI - referência ao namespace PIXI (window.PIXI)
   * @param {number} poolSize
   */
  constructor(container, PIXI, poolSize = 400) {
    this.container = container;
    this.PIXI = PIXI;
    this._pool = [];
    this._active = [];
    this.intensity = 1; // controlado por Settings.particleIntensity — reduz carga em dispositivos fracos

    for (let i = 0; i < poolSize; i++) {
      const g = new PIXI.Graphics();
      g.visible = false;
      container.addChild(g);
      this._pool.push(g);
    }
  }

  _acquireOne() {
    if (this._pool.length === 0) return null; // esgotado — perde a partícula, não trava o jogo
    const g = this._pool.pop();
    g.visible = true;
    this._active.push(g);
    return g;
  }

  _release(g) {
    g.visible = false;
    g.clear();
    const i = this._active.indexOf(g);
    if (i !== -1) this._active.splice(i, 1);
    this._pool.push(g);
  }

  /**
   * @param {object} opts
   * @param {number} opts.x @param {number} opts.y
   * @param {number} [opts.count=10]
   * @param {number} [opts.color=0x00d2ff]
   * @param {number} [opts.speedMin=60] @param {number} [opts.speedMax=180]
   * @param {number} [opts.gravity=240]
   * @param {number} [opts.lifetimeMs=350]
   * @param {number} [opts.sizeMin=1.5] @param {number} [opts.sizeMax=3.5]
   */
  burst({ x, y, count = 10, color = 0x00d2ff, speedMin = 60, speedMax = 180, gravity = 240, lifetimeMs = 350, sizeMin = 1.5, sizeMax = 3.5 }) {
    const effectiveCount = Math.max(1, Math.round(count * this.intensity));
    for (let i = 0; i < effectiveCount; i++) {
      const g = this._acquireOne();
      if (!g) return;

      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);

      g.clear();
      g.circle(0, 0, size).fill({ color });
      g.position.set(x, y);
      g.alpha = 1;

      g._vx = Math.cos(angle) * speed;
      g._vy = Math.sin(angle) * speed;
      g._gravity = gravity;
      g._lifetimeMs = lifetimeMs;
      g._ageMs = 0;
    }
  }

  update(dtMs) {
    // Itera uma cópia porque _release() modifica _active durante o loop.
    for (const g of [...this._active]) {
      g._ageMs += dtMs;
      const dtSec = dtMs / 1000;

      g._vy += g._gravity * dtSec;
      g.position.x += g._vx * dtSec;
      g.position.y += g._vy * dtSec;

      const t = g._ageMs / g._lifetimeMs;
      g.alpha = Math.max(0, 1 - t);

      if (g._ageMs >= g._lifetimeMs) this._release(g);
    }
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value));
  }

  get activeCount() {
    return this._active.length;
  }
}
