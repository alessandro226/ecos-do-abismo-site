// ====================================================================
// ui.js — HUD em DOM puro (barra de vida/XP/timer/ouro/avisos/chefe),
// estilizado via css/hud.css e css/menu.css. Números de dano são a
// ÚNICA parte que vive em PixiJS (não DOM), porque precisam se mover
// junto com a câmera no mundo do jogo — ver DamageNumberLayer no fim
// deste arquivo.
// ====================================================================

export class HUD {
  constructor(root) {
    this.root = root;
    this._goldTotal = 0;
    this._buildDOM();
  }

  _buildDOM() {
    this.root.innerHTML = `
      <div class="hud-topbar">
        <div class="hud-level" id="hud-level">Nv.1</div>
        <div class="hud-bar-wrap"><div class="hud-bar hud-bar-health" id="hud-health-bar"></div></div>
        <div class="hud-bar-wrap hud-bar-wrap-xp"><div class="hud-bar hud-bar-xp" id="hud-xp-bar"></div></div>
        <div class="hud-timer" id="hud-timer">00:00</div>
        <div class="hud-gold" id="hud-gold">💰0</div>
      </div>
      <div class="hud-notice" id="hud-notice"></div>
      <div class="hud-boss-bar-wrap" id="hud-boss-wrap" style="display:none;">
        <div class="hud-boss-name" id="hud-boss-name"></div>
        <div class="hud-bar-wrap"><div class="hud-bar hud-bar-boss" id="hud-boss-bar"></div></div>
      </div>
    `;
    this.healthBar = this.root.querySelector('#hud-health-bar');
    this.xpBar = this.root.querySelector('#hud-xp-bar');
    this.levelLabel = this.root.querySelector('#hud-level');
    this.timerLabel = this.root.querySelector('#hud-timer');
    this.goldLabel = this.root.querySelector('#hud-gold');
    this.noticeEl = this.root.querySelector('#hud-notice');
    this.bossWrap = this.root.querySelector('#hud-boss-wrap');
    this.bossNameEl = this.root.querySelector('#hud-boss-name');
    this.bossBar = this.root.querySelector('#hud-boss-bar');
  }

  updateHealth(current, max) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    this.healthBar.style.width = `${pct}%`;
  }

  updateXP(current, needed) {
    const pct = needed > 0 ? Math.max(0, Math.min(100, (current / needed) * 100)) : 0;
    this.xpBar.style.width = `${pct}%`;
  }

  setLevel(level) {
    this.levelLabel.textContent = `Nv.${level}`;
  }

  updateTimer(formattedTime) {
    this.timerLabel.textContent = formattedTime;
  }

  addGold(amount) {
    this._goldTotal += amount;
    this.goldLabel.textContent = `💰${this._goldTotal}`;
  }

  setGold(total) {
    this._goldTotal = total;
    this.goldLabel.textContent = `💰${this._goldTotal}`;
  }

  showNotice(text, durationMs = 3000) {
    this.noticeEl.textContent = text;
    this.noticeEl.classList.add('visible');
    clearTimeout(this._noticeTimeout);
    this._noticeTimeout = setTimeout(() => {
      this.noticeEl.classList.remove('visible');
    }, durationMs);
  }

  showBossBar(name) {
    this.bossNameEl.textContent = name;
    this.bossBar.style.width = '100%';
    this.bossWrap.style.display = 'flex';
  }

  updateBossHealth(current, max) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    this.bossBar.style.width = `${pct}%`;
  }

  hideBossBar() {
    this.bossWrap.style.display = 'none';
  }
}

// ====================================================================
// VirtualJoystick — controla o toque na zona inferior esquerda e
// alimenta InputManager.setTouchVector(). Suporta os dois modos que
// já existiam em Settings mas nunca tinham implementação: "fixed"
// (base sempre no mesmo lugar) e "floating" (base aparece onde o
// dedo tocar).
// ====================================================================
export class VirtualJoystick {
  constructor(zoneEl, baseEl, stickEl, inputManager, { mode = 'fixed', maxRadius = 45 } = {}) {
    this.zone = zoneEl;
    this.base = baseEl;
    this.stick = stickEl;
    this.input = inputManager;
    this.mode = mode;
    this.maxRadius = maxRadius;
    this._activeTouchId = null;
    this._originX = 0;
    this._originY = 0;

    this._fixedX = 70;
    this._fixedY = -70; // relativo ao canto inferior esquerdo da zona

    this.zone.addEventListener('touchstart', (e) => this._onStart(e), { passive: false });
    this.zone.addEventListener('touchmove', (e) => this._onMove(e), { passive: false });
    this.zone.addEventListener('touchend', (e) => this._onEnd(e));
    this.zone.addEventListener('touchcancel', (e) => this._onEnd(e));
  }

  setMode(mode) {
    this.mode = mode;
  }

  _onStart(e) {
    e.preventDefault();
    if (this._activeTouchId !== null) return; // já tem um dedo controlando
    const touch = e.changedTouches[0];
    this._activeTouchId = touch.identifier;

    const zoneRect = this.zone.getBoundingClientRect();
    if (this.mode === 'floating') {
      this._originX = touch.clientX - zoneRect.left;
      this._originY = touch.clientY - zoneRect.top;
    } else {
      this._originX = this._fixedX;
      this._originY = zoneRect.height + this._fixedY;
    }

    this.base.style.left = `${this._originX - 45}px`;
    this.base.style.top = `${this._originY - 45}px`;
    this.base.style.display = 'block';
    this._updateStick(0, 0);
  }

  _onMove(e) {
    if (this._activeTouchId === null) return;
    const touch = [...e.changedTouches].find((t) => t.identifier === this._activeTouchId);
    if (!touch) return;
    e.preventDefault();

    const zoneRect = this.zone.getBoundingClientRect();
    const dx = (touch.clientX - zoneRect.left) - this._originX;
    const dy = (touch.clientY - zoneRect.top) - this._originY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;

    this._updateStick(stickX, stickY);
    this.input.setTouchVector(stickX / this.maxRadius, stickY / this.maxRadius);
  }

  _onEnd(e) {
    const touch = [...e.changedTouches].find((t) => t.identifier === this._activeTouchId);
    if (!touch) return;
    this._activeTouchId = null;
    this.base.style.display = 'none';
    this.input.clearTouchVector();
  }

  _updateStick(x, y) {
    this.stick.style.left = `${25 + x}px`;
    this.stick.style.top = `${25 + y}px`;
  }
}

// ====================================================================
// DamageNumberLayer — vive em espaço de MUNDO (PIXI.Text dentro do
// worldContainer da câmera), não em DOM — precisa rolar com a cena.
// GDD 2.3: comum em azul claro, crítico em dourado 150% de escala.
// ====================================================================
export class DamageNumberLayer {
  constructor(worldContainer, PIXI, poolSize = 30) {
    this.container = worldContainer;
    this.PIXI = PIXI;
    this._pool = [];
    this._active = [];

    for (let i = 0; i < poolSize; i++) {
      const text = new PIXI.Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 15, fill: 0x00d2ff, stroke: { color: 0x000000, width: 2 } } });
      text.visible = false;
      text.anchor.set(0.5);
      worldContainer.addChild(text);
      this._pool.push(text);
    }
  }

  spawn(x, y, amount, isCrit) {
    if (this._pool.length === 0) return;
    const text = this._pool.pop();
    text.text = String(Math.round(amount));
    text.style.fill = isCrit ? 0xffd054 : 0x00d2ff;
    text.style.fontSize = isCrit ? 22 : 15;
    text.scale.set(isCrit ? 1.5 : 1);
    text.position.set(x + (Math.random() * 12 - 6), y);
    text.alpha = 1;
    text.visible = true;

    text._vy = isCrit ? -90 : -65;
    text._ageMs = 0;
    text._lifetimeMs = isCrit ? 640 : 440;
    this._active.push(text);
  }

  update(dtMs) {
    for (const text of [...this._active]) {
      text._ageMs += dtMs;
      text.position.y += text._vy * (dtMs / 1000);
      const t = text._ageMs / text._lifetimeMs;
      text.alpha = Math.max(0, 1 - t);

      if (text._ageMs >= text._lifetimeMs) {
        text.visible = false;
        const i = this._active.indexOf(text);
        this._active.splice(i, 1);
        this._pool.push(text);
      }
    }
  }
}
