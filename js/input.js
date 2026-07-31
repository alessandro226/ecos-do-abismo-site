// ====================================================================
// input.js — Unifica teclado (WASD/setas), joystick virtual de toque e
// analógico de gamepad numa única leitura de direção normalizada.
// Prioriza o que estiver ativo no momento; soltar o joystick de toque
// devolve o controle ao teclado imediatamente, sem lógica de "modo".
// ====================================================================

export class InputManager {
  constructor(target = window) {
    this._keys = new Set();
    this._touchVector = { x: 0, y: 0 };
    this._touchActive = false;

    target.addEventListener('keydown', (e) => this._keys.add(e.code));
    target.addEventListener('keyup', (e) => this._keys.delete(e.code));
    target.addEventListener('blur', () => this._keys.clear());
  }

  // Chamado pelo joystick virtual (ver ui.js) — vetor já normalizado (-1..1).
  setTouchVector(x, y) {
    this._touchVector.x = x;
    this._touchVector.y = y;
    this._touchActive = (x !== 0 || y !== 0);
  }

  clearTouchVector() {
    this._touchVector.x = 0;
    this._touchVector.y = 0;
    this._touchActive = false;
  }

  _keyboardVector() {
    let x = 0, y = 0;
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) x -= 1;
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) x += 1;
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) y -= 1;
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) y += 1;
    return { x, y };
  }

  _gamepadVector() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return { x: 0, y: 0 };
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const x = pad.axes[0] || 0;
      const y = pad.axes[1] || 0;
      if (Math.abs(x) > 0.2 || Math.abs(y) > 0.2) return { x, y };
    }
    return { x: 0, y: 0 };
  }

  /** Vetor de direção final, normalizado (magnitude máxima 1). */
  getDirection() {
    let { x, y } = this._keyboardVector();

    if (this._touchActive) {
      x = this._touchVector.x;
      y = this._touchVector.y;
    } else {
      const gp = this._gamepadVector();
      if (gp.x !== 0 || gp.y !== 0) { x = gp.x; y = gp.y; }
    }

    const mag = Math.hypot(x, y);
    if (mag > 1) { x /= mag; y /= mag; }
    return { x, y };
  }

  isKeyDown(code) {
    return this._keys.has(code);
  }
}
