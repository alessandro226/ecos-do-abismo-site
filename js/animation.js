// ====================================================================
// animation.js — Duas coisas distintas:
// 1. FrameAnimator: troca de frame por tempo (walk/attack/idle com
//    múltiplos frames reais, ex: o jogador).
// 2. SecondaryMotion: respiração/balanço/squash procedural via tween
//    simples — pra dar vida a sprites que só têm 1 frame de arte
//    (a maior parte do bestiário atual), sem depender de frames
//    desenhados.
// ====================================================================

export class FrameAnimator {
  /**
   * @param {PIXI.Sprite} sprite - sprite cujo .texture será trocado
   * @param {object} animations - { nome: { frames: [Texture,...], fps, loop } }
   */
  constructor(sprite, animations) {
    this.sprite = sprite;
    this.animations = animations;
    this.current = null;
    this._frameIndex = 0;
    this._elapsed = 0;
    this._finished = false;
  }

  play(name) {
    if (this.current === name) return;
    const anim = this.animations[name];
    if (!anim) {
      console.warn(`FrameAnimator: animação "${name}" não existe.`);
      return;
    }
    this.current = name;
    this._frameIndex = 0;
    this._elapsed = 0;
    this._finished = false;
    this.sprite.texture = anim.frames[0];
  }

  update(dt) {
    if (!this.current || this._finished) return;
    const anim = this.animations[this.current];
    if (anim.frames.length <= 1) return;

    this._elapsed += dt;
    const frameDuration = 1 / anim.fps;

    // while (não if): um dt grande (frame drop, tab em background) pode
    // valer vários frames de uma vez — sem isso, uma animação sem loop
    // nunca alcançaria o último frame e isFinished() ficaria preso em false.
    while (this._elapsed >= frameDuration && !this._finished) {
      this._elapsed -= frameDuration;
      this._frameIndex++;

      if (this._frameIndex >= anim.frames.length) {
        if (anim.loop) {
          this._frameIndex = 0;
        } else {
          this._frameIndex = anim.frames.length - 1;
          this._finished = true;
        }
      }
    }
    this.sprite.texture = anim.frames[this._frameIndex];
  }

  isFinished() {
    return this._finished;
  }
}

// ---- Movimento secundário procedural ----
// Sem biblioteca de tween externa — osciladores senoidais simples,
// baratos o suficiente pra rodar em centenas de inimigos ao mesmo tempo.
export class SecondaryMotion {
  constructor(sprite, { breathingAmount = 0.04, breathingSpeed = 2.6, swayDeg = 2, swaySpeed = 2.2 } = {}) {
    this.sprite = sprite;
    this.breathingAmount = breathingAmount;
    this.breathingSpeed = breathingSpeed;
    this.swayRad = (swayDeg * Math.PI) / 180;
    this.swaySpeed = swaySpeed;

    this.baseScaleX = sprite.scale.x;
    this.baseScaleY = sprite.scale.y;
    this.baseRotation = sprite.rotation;

    this._time = Math.random() * 10; // dessincroniza entidades iguais
    this._paused = false;

    this._squashUntil = 0;
    this._squashDuration = 0;
  }

  update(dt) {
    this._time += dt;
    if (this._paused) return;

    if (this._squashDuration > 0) {
      this._updateSquash(dt);
      return;
    }

    const breathe = 1 + Math.sin(this._time * this.breathingSpeed) * this.breathingAmount;
    this.sprite.scale.set(this.baseScaleX * breathe, this.baseScaleY * breathe);
    this.sprite.rotation = this.baseRotation + Math.sin(this._time * this.swaySpeed) * this.swayRad;
  }

  playHitSquash(durationSec = 0.18) {
    this._squashDuration = durationSec;
    this._squashElapsed = 0;
  }

  _updateSquash(dt) {
    this._squashElapsed += dt; // dt real — antes assumia 60fps fixo, quebrava em taxas diferentes
    const t = Math.min(1, this._squashElapsed / this._squashDuration);
    // achata rápido, depois volta com um leve exagero elástico
    const factor = t < 0.3
      ? 1 + (t / 0.3) * 0.25
      : 1 + (1 - (t - 0.3) / 0.7) * 0.25 * Math.cos((t - 0.3) * 12);

    this.sprite.scale.set(this.baseScaleX * (2 - factor), this.baseScaleY * factor);
    if (t >= 1) this._squashDuration = 0;
  }

  pause() { this._paused = true; }
  resume() {
    this._paused = false;
    this.sprite.scale.set(this.baseScaleX, this.baseScaleY);
    this.sprite.rotation = this.baseRotation;
  }
}
