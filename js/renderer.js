// ====================================================================
// renderer.js — Encapsula o PixiJS. "Mover a câmera" = mover o
// worldContainer no sentido oposto (PixiJS não tem câmera embutida).
// Tudo que existe NO MUNDO do jogo (jogador, inimigos, projéteis,
// partículas) é filho de worldContainer; overlays de tela cheia
// (vinheta, flash) vão em screenContainer, que não se move com a câmera.
// ====================================================================

// Converte "#rrggbb" + alpha (0-1) pro formato que o canvas 2D espera
// nos color stops do gradiente ("rgba(r,g,b,a)").
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export class Renderer {
  constructor() {
    this.app = null;
    this.worldContainer = null;
    this.screenContainer = null;
    this.atlasTextures = {}; // nome do atlas -> PIXI.BaseTexture
  }

  async init(canvasParent, { width = 640, height = 360 } = {}) {
    // PIXI é carregado via <script> global no index.html (CDN) — ver
    // README do projeto. Import estático quebraria o "abrir o HTML
    // direto sem servidor", então acessamos via window.PIXI.
    const PIXI = window.PIXI;

    this.app = new PIXI.Application();
    await this.app.init({
      width, height,
      backgroundColor: 0x0f0d15, // Volume III — "Escuro" da paleta oficial
      antialias: false, // pixel art — nearest neighbor, sem suavização
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    canvasParent.appendChild(this.app.canvas);

    this.worldContainer = new PIXI.Container();
    this.screenContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.screenContainer);

    this._createGroundLayer(PIXI);

    this._setupResize(width, height);
    return this.app;
  }

  _setupResize(baseWidth, baseHeight) {
    const resize = () => {
      const parent = this.app.canvas.parentElement;
      if (!parent) return;
      const scale = Math.min(parent.clientWidth / baseWidth, parent.clientHeight / baseHeight);
      this.app.canvas.style.width = `${baseWidth * scale}px`;
      this.app.canvas.style.height = `${baseHeight * scale}px`;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  /**
   * Carrega um atlas a partir de uma STRING base64 (data:image/png;...),
   * não de uma URL — de propósito: fetch()/PIXI.Assets.load() falham
   * silenciosamente quando o jogo é aberto direto do disco (file://,
   * sem servidor), então evitamos rede completamente aqui.
   */
  async loadAtlas(name, base64DataUri, frameMap) {
    const PIXI = window.PIXI;
    const image = await this._loadImage(base64DataUri);
    const baseTexture = PIXI.Texture.from(image);

    const textures = {};
    for (const [frameName, rect] of Object.entries(frameMap)) {
      textures[frameName] = new PIXI.Texture({
        source: baseTexture.source,
        frame: new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h),
      });
    }
    this.atlasTextures[name] = textures;
    return textures;
  }

  /**
   * Substitui/adiciona UM frame dentro de um atlas JÁ carregado, sem
   * apagar os outros frames — usado quando chega arte real definitiva
   * pra um único inimigo/chefe específico, sem precisar recortar de
   * volta pra dentro da folha de atlas inteira.
   */
  async addFrameToAtlas(atlasName, frameName, base64DataUri) {
    const PIXI = window.PIXI;
    const image = await this._loadImage(base64DataUri);
    const texture = PIXI.Texture.from(image);
    if (!this.atlasTextures[atlasName]) this.atlasTextures[atlasName] = {};
    this.atlasTextures[atlasName][frameName] = texture;
    return texture;
  }

  _loadImage(dataUri) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Falha ao decodificar imagem embutida: ${e.message || e}`));
      img.src = dataUri;
    });
  }

  getTexture(atlasName, frameName) {
    return this.atlasTextures[atlasName]?.[frameName] ?? null;
  }

  /**
   * Carrega uma imagem ÚNICA (não um atlas com vários frames dentro) —
   * pra ícones avulsos como pickups. Guardada com a mesma chave de
   * atlas+frame (nome repetido) pra usar getTexture() sem precisar de
   * um método separado.
   */
  async loadSingleTexture(name, base64DataUri) {
    const PIXI = window.PIXI;
    const image = await this._loadImage(base64DataUri);
    const texture = PIXI.Texture.from(image);
    this.atlasTextures[name] = { [name]: texture };
    return texture;
  }

  // Piso visível — sem isso, o mundo é um vazio preto sólido, sem
  // NENHUMA referência espacial (o jogador relatou exatamente isso:
  // "o mapa é preto e tudo preto"). Uma grade sutil resolve o problema
  // sem quebrar a estética escura pretendida (Volume III/GDD "Solidão").
  _createGroundLayer(PIXI) {
    const ground = new PIXI.Graphics();
    const size = 4000;
    const cell = 64;
    const half = size / 2;

    ground.rect(-half, -half, size, size).fill({ color: 0x161320 }); // um tom mais claro que o fundo puro

    for (let x = -half; x <= half; x += cell) {
      ground.moveTo(x, -half).lineTo(x, half);
    }
    for (let y = -half; y <= half; y += cell) {
      ground.moveTo(-half, y).lineTo(half, y);
    }
    ground.stroke({ width: 1, color: 0x251e2b, alpha: 0.6 });

    this.worldContainer.addChild(ground); // primeiro filho = renderiza atrás de tudo
    this.groundLayer = ground;
  }

  // Luz suave ao redor de uma entidade (normalmente o jogador). Usa uma
  // TEXTURA de gradiente radial desenhada uma vez via canvas 2D — NÃO
  // empilha círculos com blend aditivo (a primeira tentativa fazia
  // isso e estourava pra branco puro no centro, já que blend aditivo
  // SOMA a opacidade de cada camada sobreposta no mesmo ponto).
  createRadialLight(PIXI, { radius = 140, color = 0x00d2ff, alpha = 0.5 } = {}) {
    const size = radius * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, hexToRgba(hex, alpha));
    gradient.addColorStop(0.6, hexToRgba(hex, alpha * 0.4));
    gradient.addColorStop(1, hexToRgba(hex, 0));

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = PIXI.Texture.from(canvas);
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    this.worldContainer.addChild(sprite);
    return sprite;
  }

  // por frame, depois de camera.update(dt).
  applyCamera(camera) {
    const offset = camera.worldToScreenOffset(this.app.screen.width, this.app.screen.height);
    this.worldContainer.position.set(offset.x, offset.y);
    this.worldContainer.scale.set(camera.zoom, camera.zoom);
  }

  get ticker() {
    return this.app.ticker;
  }
}
