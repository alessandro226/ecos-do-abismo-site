// ====================================================================
// camera.js — Câmera 2D. PixiJS não tem câmera embutida — "mover a
// câmera" aqui significa mover/escalar um Container raiz (o "world")
// no sentido oposto. Trauma-based screen shake (GDD 2.3):
// Offset = Trauma² × MaxOffset × Noise(t), decai sozinho com o tempo.
// ====================================================================

import { clamp, lerp } from './utils.js';

export class Camera {
  constructor({ maxOffsetPx = 24, traumaDecayPerSecond = 1.2, followSmoothing = 8 } = {}) {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;

    this.followSmoothing = followSmoothing;
    this.maxOffsetPx = maxOffsetPx;
    this.traumaDecayPerSecond = traumaDecayPerSecond;

    this._trauma = 0;
    this._time = 0;
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;
  }

  // dt em segundos
  followTarget(targetX, targetY, dt) {
    const t = clamp(this.followSmoothing * dt, 0, 1);
    this.x = lerp(this.x, targetX, t);
    this.y = lerp(this.y, targetY, t);
  }

  addTrauma(amount) {
    this._trauma = clamp(this._trauma + amount, 0, 1);
  }

  // Atalhos semânticos — quem chama não precisa saber o valor numérico.
  shakeForCritHit() { this.addTrauma(0.15); }
  shakeForPlayerDamage() { this.addTrauma(0.3); }
  shakeForAreaDamage() { this.addTrauma(0.45); }
  shakeForBossEvent() { this.addTrauma(0.6); }

  setZoom(target, immediate = false) {
    this.targetZoom = target;
    if (immediate) this.zoom = target;
  }

  update(dt) {
    this._time += dt;

    if (this._trauma > 0) {
      this._trauma = Math.max(0, this._trauma - this.traumaDecayPerSecond * dt);
      const shakeAmount = this._trauma * this._trauma;
      // Ruído simples (soma de senos com frequências não-múltiplas) —
      // suficiente pra parecer orgânico sem precisar de uma lib de
      // Perlin/Simplex noise externa.
      const nx = Math.sin(this._time * 31.7) * 0.5 + Math.sin(this._time * 53.1) * 0.5;
      const ny = Math.sin(this._time * 41.3) * 0.5 + Math.sin(this._time * 29.9) * 0.5;
      this._shakeOffsetX = nx * this.maxOffsetPx * shakeAmount;
      this._shakeOffsetY = ny * this.maxOffsetPx * shakeAmount;
    } else {
      this._shakeOffsetX = 0;
      this._shakeOffsetY = 0;
    }

    this.zoom = lerp(this.zoom, this.targetZoom, clamp(6 * dt, 0, 1));
  }

  // Posição final de renderização, já com o shake aplicado.
  get renderX() { return this.x + this._shakeOffsetX; }
  get renderY() { return this.y + this._shakeOffsetY; }

  // Converte coordenada de mundo pra coordenada de tela, dado o tamanho
  // da viewport — usado pelo renderer pra posicionar o container "world".
  worldToScreenOffset(viewportWidth, viewportHeight) {
    return {
      x: viewportWidth / 2 - this.renderX * this.zoom,
      y: viewportHeight / 2 - this.renderY * this.zoom,
    };
  }
}
