// ====================================================================
// main.js — Ponto de entrada. Cria e conecta todos os sistemas
// (renderer, câmera, input, áudio, save, HUD) e roda o loop principal
// via PIXI.Ticker. Não contém regra de jogo em si — isso vive em
// game.js/entities/systems.
// ====================================================================

import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';
import { SaveManager } from './save.js';
import { Settings } from './settings.js';
import { Game, GameState } from './game.js';
import { HUD, DamageNumberLayer, VirtualJoystick } from './ui.js';
import { ParticleSystem } from './particles.js';
import { ObjectPool } from './objectPool.js';
import { Player } from '../entities/player.js';
import { SpawnSystem } from '../systems/spawnSystem.js';
import { WeaponSystem, Inventory } from '../systems/weaponSystem.js';
import { DamageSystem } from '../systems/damageSystem.js';
import { BlessingSystem } from '../systems/blessingSystem.js';
import { SkillSystem } from '../systems/skillSystem.js';
import { LootSystem } from '../systems/lootSystem.js';
import { RelicSystem } from '../systems/relicSystem.js';
import { EvolutionSystem } from '../systems/evolutionSystem.js';
import { AchievementSystem } from '../systems/achievementSystem.js';
import { Boss } from '../entities/boss.js';
import { circleCircle, SpatialGrid } from './collision.js';
import { distance } from './utils.js';

import { WEAPONS } from '../data/weapons.js';
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';
import { BLESSINGS } from '../data/blessings.js';
import { RELICS } from '../data/relics.js';
import { BIOMES } from '../data/biomes.js';
import { ATLAS_FRAMES } from '../data/atlasframes.js';
import { MINIBOSSES } from '../data/minibosses.js';
import { PLAYER_ATLAS_B64, ENEMY_ATLAS_B64, BOSS_ATLAS_B64, DECORATIONS_B64, PICKUP_GOLD_B64, PICKUP_XP_GEM_B64, GRUNT_REAL_B64 } from '../data/sprites.js';

function loadGameData() {
  // Não é mais async/fetch de propósito: dados embutidos como módulos JS
  // (ver data/*.js) funcionam abrindo o index.html direto do disco
  // (file://), o que fetch() de arquivos locais NÃO faz de forma
  // confiável em todos os navegadores.
  return {
    weapons: WEAPONS, enemies: ENEMIES, bosses: BOSSES, minibosses: MINIBOSSES,
    blessings: BLESSINGS, relics: RELICS, biomes: BIOMES,
    atlasFrames: ATLAS_FRAMES,
  };
}

class App {
  constructor() {
    this.renderer = new Renderer();
    this.camera = new Camera();
    this.camera.setZoom(0.76, true); // calculado a partir da proporção medida na foto de referência
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.saveManager = new SaveManager();
    this.settings = new Settings();
    this.game = new Game();
    this.hud = null;
    this.damageNumbers = null;
    this.particles = null;
    this.gameData = null;
    this.enemyGrid = new SpatialGrid(96);

    this._lastFrameTime = null;
  }

  async init() {
    this.saveManager.load();
    this.settings.loadFrom(this.saveManager.data.settings);
    this._applySettingsToAudio();

    this.gameData = loadGameData();

    await this.renderer.init(document.getElementById('game-root'));
    await this._loadAtlases();

    this.hud = new HUD(document.getElementById('hud-root'));
    this.damageNumbers = new DamageNumberLayer(this.renderer.worldContainer, window.PIXI);

    const joyZone = document.getElementById('joystick-zone');
    const joyBase = document.getElementById('joystick-base');
    const joyStick = document.getElementById('joystick-stick');
    if (joyZone && joyBase && joyStick) {
      this.virtualJoystick = new VirtualJoystick(joyZone, joyBase, joyStick, this.input, {
        mode: this.settings.get('joystickMode'),
      });
    }
    this.particles = new ParticleSystem(this.renderer.worldContainer, window.PIXI);
    this.particles.setIntensity(this.settings.get('particleIntensity'));

    this.player = new Player({
      renderer: this.renderer,
      input: this.input,
      stats: { moveSpeed: 180, maxHealth: 100 },
    });
    // Luz radial removida: o mapa agora é claro (cinza), a luz não faz
    // mais sentido — antes existia justamente pra compensar o fundo
    // escuro que não existe mais.

    this.spawnSystem = new SpawnSystem({
      renderer: this.renderer,
      enemyDataList: this.gameData.enemies,
      game: this.game,
    });
    this.spawnSystem.onDiscover = (enemyId) => {
      if (!this.saveManager.data.discoveredEnemies[enemyId]) {
        this.saveManager.data.discoveredEnemies[enemyId] = true;
        this.saveManager.scheduleSave();
      }
    };

    this.inventory = new Inventory({ renderer: this.renderer, maxWeaponSlots: 6 });
    const starterWeapon = this.gameData.weapons[0];
    this.inventory.addOrLevelUpWeapon(starterWeapon);
    this._markWeaponDiscovered(starterWeapon.id);

    this.blessingSystem = new BlessingSystem();
    this.skillSystem = new SkillSystem({
      weaponsData: this.gameData.weapons,
      blessingsData: this.gameData.blessings,
      blessingSystem: this.blessingSystem,
      inventory: this.inventory,
    });
    this.lootSystem = new LootSystem({ renderer: this.renderer });
    this.relicSystem = new RelicSystem(this.blessingSystem);
    this.evolutionSystem = new EvolutionSystem({ relicSystem: this.relicSystem, blessingsData: this.gameData.blessings });
    this.achievementSystem = new AchievementSystem(this.saveManager);
    this.currentBoss = null;
    this._bossSpawnedAt = new Set();
    this.currentMiniboss = null;
    this._minibossSpawnedAt = new Set();

    this.damageSystem = new DamageSystem({
      camera: this.camera,
      particles: this.particles,
      damageNumbers: this.damageNumbers,
      audio: this.audio,
      game: this.game,
      lootSystem: this.lootSystem,
    });

    this._wireEvents();
    this._wireStartButton();
    this._wireLevelUpModal();
    this._wireVisibilityPause();
    this._updateBestRecordDisplay();

    this.renderer.ticker.add((ticker) => this._onTick(ticker));
  }

  async _loadAtlases() {
    const frames = this.gameData.atlasFrames;
    await this.renderer.loadAtlas('player', PLAYER_ATLAS_B64, frames.player);
    await this.renderer.loadAtlas('enemy', ENEMY_ATLAS_B64, frames.enemy);
    await this.renderer.loadAtlas('boss', BOSS_ATLAS_B64, frames.boss);
    await this.renderer.loadAtlas('decoration', DECORATIONS_B64, frames.decoration);
    await this.renderer.loadSingleTexture('pickup_gold', PICKUP_GOLD_B64);
    await this.renderer.loadSingleTexture('pickup_xp_gem', PICKUP_XP_GEM_B64);
    // Arte definitiva do Rastejante — substitui só esse frame dentro do
    // atlas de inimigos, os outros 16 tipos continuam vindo da folha.
    await this.renderer.addFrameToAtlas('enemy', 'grunt', GRUNT_REAL_B64);
  }

  _applySettingsToAudio() {
    this.audio.setVolume('music', this.settings.get('musicVolume'));
    this.audio.setVolume('sfx', this.settings.get('sfxVolume'));
  }

  _wireEvents() {
    this.game.on('xpChanged', (xp, needed, level) => this.hud.updateXP(xp, needed));
    this.game.on('levelUp', (level) => {
      this.hud.setLevel(level);
      this.audio.playSfx('levelUp');
      this._showLevelUpModal();
    });
    this.game.on('goldChanged', (total) => this.hud.setGold(total));
    this.game.on('runEnded', (summary) => this._onRunEnded(summary));
    this.game.on('runWon', (summary) => this._onRunWon(summary));
  }

  // Pausa automática ao trocar de aba/app (qualidade de vida + bateria,
  // Fase 5/GDD) — cuidado pra só retomar sozinho se a pausa foi causada
  // POR ISSO, nunca sobrepor uma pausa manual (menu de configurações
  // aberto, por exemplo) que o jogador ainda não fechou.
  _wireVisibilityPause() {
    let pausedByVisibility = false;

    const onHide = () => {
      if (this.game.isRunning()) {
        this.game.pause();
        pausedByVisibility = true;
      }
    };
    const onShow = () => {
      if (pausedByVisibility && this.game.state === GameState.PAUSED) {
        this.game.resume();
      }
      pausedByVisibility = false;
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHide(); else onShow();
    });
    window.addEventListener('blur', onHide);
    window.addEventListener('focus', onShow);
  }

  _renderEncyclopedia(tab) {
    const listEl = document.getElementById('encyclopedia-list');
    if (!listEl) return;

    const configs = {
      enemies: { data: this.gameData.enemies, discovered: this.saveManager.data.discoveredEnemies, nameKey: 'name' },
      weapons: { data: this.gameData.weapons, discovered: this.saveManager.data.discoveredWeapons, nameKey: 'name' },
      bosses: { data: this.gameData.bosses, discovered: this.saveManager.data.discoveredBosses, nameKey: 'name' },
    };
    const { data, discovered, nameKey } = configs[tab];

    listEl.innerHTML = '';
    for (const item of data) {
      const isKnown = !!discovered[item.id];
      const row = document.createElement('div');
      row.className = `encyclopedia-row ${isKnown ? '' : 'locked'}`;
      row.innerHTML = isKnown
        ? `<div class="enc-name">${item[nameKey]}</div>`
        : `<div class="enc-name unknown">??? (ainda não descoberto)</div>`;
      listEl.appendChild(row);
    }
  }

  _wireLevelUpModal() {
    // Nada pra fazer no boot — _showLevelUpModal monta os cards sob
    // demanda, toda vez que sobe de nível (ver _wireEvents/'levelUp').
  }

  _showLevelUpModal() {
    this.game.pause();
    const choices = this.skillSystem.rollChoices();
    const container = document.getElementById('level-up-cards');
    const modal = document.getElementById('level-up-modal');
    if (!container || !modal) return;

    if (choices.length === 0) {
      this.game.resume(); // nada mais pra oferecer (tudo maxado) — não trava a partida
      return;
    }

    container.innerHTML = '';
    for (const choice of choices) {
      const card = document.createElement('div');
      card.className = 'level-up-card';
      const isWeapon = choice.kind === 'weapon';
      const currentLevel = isWeapon ? this.inventory.getWeaponLevel(choice.data.id) : this.blessingSystem.getStacks(choice.data.id);
      card.innerHTML = `
        <div style="font-size:28px;">${choice.data.icon ?? (isWeapon ? '⚔️' : '✨')}</div>
        <div style="font-weight:700;">${choice.data.display_name ?? choice.data.name}</div>
        <div style="font-size:11px;color:#a9a9a9;margin:6px 0;">${choice.data.description ?? choice.data.desc ?? ''}</div>
        <div style="font-size:10px;color:#c29b38;">${currentLevel === 0 ? 'NOVO' : `Nível ${currentLevel} → ${currentLevel + 1}`}</div>
      `;
      card.addEventListener('click', () => {
        this.skillSystem.applyChoice(choice, this.player);
        if (choice.kind === 'weapon') this._markWeaponDiscovered(choice.data.id);
        for (const ws of this.inventory.weaponSystems) this.evolutionSystem.checkEvolution(ws);
        modal.classList.add('hidden');
        this.game.resume();
      });
      container.appendChild(card);
    }
    modal.classList.remove('hidden');
  }

  _checkBossCollisions(boss) {
    const bossRadius = (boss.data.size ?? 64) * 0.4;

    for (const weapon of this.inventory.weaponSystems) {
      weapon.pool.forEachActive((proj) => {
        if (!proj.active || proj.isEnemyProjectile || proj.hasHit(boss)) return;
        if (circleCircle(proj.x, proj.y, 4, boss.x, boss.y, bossRadius)) {
          const dealt = boss.takeDamage(proj.damage, { isProjectile: true });
          this.game.registerDamageDealt(dealt);
          this.damageNumbers.spawn(boss.x, boss.y, dealt, false);
          proj.registerHit(boss);
        }
      });
    }

    if (circleCircle(this.player.x, this.player.y, this.player.collisionRadius, boss.x, boss.y, bossRadius)) {
      const dealt = this.player.takeDamage(boss.contactDamage);
      if (dealt > 0) {
        this.game.registerDamageTaken(dealt);
        this.damageNumbers.spawn(this.player.x, this.player.y, dealt, false);
        this.camera.shakeForPlayerDamage();
        const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
        this.player.applyKnockback(Math.cos(angle) * 220, Math.sin(angle) * 220);
      }
    }
  }

  _markWeaponDiscovered(weaponId) {
    if (!this.saveManager.data.discoveredWeapons[weaponId]) {
      this.saveManager.data.discoveredWeapons[weaponId] = true;
      this.saveManager.scheduleSave();
    }
  }

  _updateMinibossSpawnTimers() {
    if (this.currentMiniboss || this.gameData.minibosses.length === 0) return;
    const marks = [90000, 210000, 330000, 450000]; // 1:30, 3:30, 5:30, 7:30
    const idx = marks.findIndex((m) => this.game.elapsedMs >= m && !this._minibossSpawnedAt.has(m));
    if (idx === -1) return;
    this._minibossSpawnedAt.add(marks[idx]);
    const data = this.gameData.minibosses[idx % this.gameData.minibosses.length];

    const angle = Math.random() * Math.PI * 2;
    const x = this.player.x + Math.cos(angle) * 260;
    const y = this.player.y + Math.sin(angle) * 260;
    this.currentMiniboss = new Boss({ renderer: this.renderer, data, x, y });
    this._wireBossSpecialAttack(this.currentMiniboss);
    this.currentMiniboss.on('spawned', (d) => {
      this.audio.playSfx('bossSpawn');
      this.hud.showNotice(`⚠ ${d.name} apareceu!`);
      if (!this.saveManager.data.discoveredBosses[d.id]) {
        this.saveManager.data.discoveredBosses[d.id] = true;
        this.saveManager.scheduleSave();
      }
    });
    this.currentMiniboss.on('died', () => {
      this.game.addGold(Math.floor((data.xp ?? 20) * 0.6));
      this.particles.burst({ x: this.currentMiniboss.x, y: this.currentMiniboss.y, count: 26, color: 0xc29b38, speedMax: 260 });
      this.audio.playSfx('bossDeath');
      this.camera.shakeForBossEvent();
    });
  }

  _updateBossSpawnTimers() {
    if (this.currentBoss) return; // só 1 chefe por vez
    const marks = [3 * 60000, 7 * 60000, 12 * 60000]; // 3min, 7min, 12min
    const idx = marks.findIndex((m) => this.game.elapsedMs >= m && !this._bossSpawnedAt.has(m));
    if (idx === -1) return;
    this._bossSpawnedAt.add(marks[idx]);
    this._spawnBoss(this.gameData.bosses[idx % this.gameData.bosses.length]);
  }

  // Compartilhado entre chefe principal e miniboss — o ataque especial
  // (slam/barrage, o que for definido em baseAttackPattern) causava
  // dano zero até agora, porque o evento 'attack' nunca tinha um
  // listener. Telegraph curto (partícula + leve atraso) antes do dano
  // de verdade, pra não parecer instantâneo/injusto.
  _wireBossSpecialAttack(bossInstance) {
    bossInstance.on('attack', ({ x, y, radius, damage }) => {
      this.particles.burst({ x, y, count: 20, color: 0xe6243c, speedMax: radius * 2, lifetimeMs: 300 });
      this.audio.playSfx('hitCrit');
      setTimeout(() => {
        if (!this.player.isAlive()) return;
        const d = distance(this.player.x, this.player.y, x, y);
        if (d <= radius) {
          const dealt = this.player.takeDamage(damage);
          if (dealt > 0) {
            this.game.registerDamageTaken(dealt);
            this.damageNumbers.spawn(this.player.x, this.player.y, dealt, false);
            this.camera.shakeForAreaDamage();
            if (dealt > this.player.maxHealth * 0.25) this.game.triggerHitStop(67, 0.05);
          }
        }
      }, 350); // telegraph — tempo pro jogador reagir e sair da área
    });
  }

  _spawnBoss(bossData) {
    const angle = Math.random() * Math.PI * 2;
    const x = this.player.x + Math.cos(angle) * 300;
    const y = this.player.y + Math.sin(angle) * 300;
    this.currentBoss = new Boss({ renderer: this.renderer, data: bossData, x, y });
    this._wireBossSpecialAttack(this.currentBoss);

    this.currentBoss.on('spawned', (data) => {
      this.hud.showBossBar(data.name);
      this.audio.playSfx('bossSpawn');
      this.camera.shakeForBossEvent();
      if (!this.saveManager.data.discoveredBosses[data.id]) {
        this.saveManager.data.discoveredBosses[data.id] = true;
        this.saveManager.scheduleSave();
      }
    });
    this.currentBoss.on('phaseChanged', (_i, message) => {
      this.camera.shakeForBossEvent();
      if (message) this.hud.showNotice(message);
    });
    this.currentBoss.on('died', () => {
      this.game.addGold(bossData.xp ?? 100);
      this.particles.burst({ x: this.currentBoss.x, y: this.currentBoss.y, count: 40, color: 0xe6243c, speedMax: 300 });
      this.audio.playSfx('bossDeath');

      // Chefe final derrotado — condição de vitória real (Fase 6), não
      // existia antes: o jogo só tinha "derrota", nunca "vitória".
      if (bossData.id === 'colosso_primordial') {
        this.player.animator?.play('victory');
        this.game.winRun();
      }
    });
  }

  _resetRunState() {
    // Jogador: vida cheia, posição de volta ao centro, stats voltam ao
    // que a passiva/pesquisa dá (sem os bônus de bênção da run anterior).
    this.player.x = 0; this.player.y = 0;
    this.player.health = this.player.maxHealth = 100;
    this.player.damageMult = 1; this.player.speedMult = 1; this.player.xpMult = 1;
    this.player.critChanceAdd = 0; this.player.armor = 0;
    this.player.regenPerSecond = 0; this.player.attackSpeedMult = 1;
    this.player.rangeMult = 1; this.player.thornsPct = 0; this.player.critDamageMult = 2;
    this.player.magnetMult = 1;
    this.player.statusReceiver.clear();
    this.player._isDead = false;
    this._playerDeathHandled = false;

    // Inimigos: devolve todos os ativos aos pools, sem deixar nenhum
    // "fantasma" da run anterior em tela.
    for (const enemy of [...this.spawnSystem.activeEnemies]) {
      enemy.alive = false;
    }
    this.spawnSystem.update(0, 0, 0); // força a limpeza imediata

    // Chefe: se algum estava ativo, remove de vez (não vem de pool).
    if (this.currentBoss) {
      this.currentBoss.destroy();
      this.currentBoss = null;
      this.hud.hideBossBar();
    }
    this._bossSpawnedAt.clear();

    if (this.currentMiniboss) {
      this.currentMiniboss.destroy();
      this.currentMiniboss = null;
    }
    this._minibossSpawnedAt.clear();

    // Inventário/bênçãos/relíquias: começa do zero, só a arma inicial.
    for (const ws of this.inventory.weaponSystems) ws.pool.releaseAll();
    this.inventory.weaponSystems = [];
    this.inventory.addOrLevelUpWeapon(this.gameData.weapons[0]);
    this.blessingSystem.stacks = {};
    this.evolutionSystem.evolved.clear();

    this.hud.setGold(0);
    this.hud.setLevel(1);
  }

  _wireStartButton() {
    const startBtn = document.getElementById('start-btn');
    if (!startBtn) return;
    startBtn.addEventListener('click', () => {
      this.audio.init();
      this.audio.resume();
      document.getElementById('start-modal')?.classList.add('hidden');
      this.game.startRun();
    });

    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const musicSlider = document.getElementById('music-volume');
    const sfxSlider = document.getElementById('sfx-volume');
    const highContrastToggle = document.getElementById('high-contrast-toggle');

    if (musicSlider) musicSlider.value = this.settings.get('musicVolume');
    if (sfxSlider) sfxSlider.value = this.settings.get('sfxVolume');
    if (highContrastToggle) {
      highContrastToggle.checked = this.settings.get('highContrast');
      document.body.classList.toggle('high-contrast', this.settings.get('highContrast'));
      highContrastToggle.addEventListener('change', (e) => {
        this.settings.set('highContrast', e.target.checked);
        document.body.classList.toggle('high-contrast', e.target.checked);
        this.saveManager.data.settings = this.settings.toJSON();
        this.saveManager.scheduleSave();
      });
    }

    const joyZoneEl = document.getElementById('joystick-zone');
    const applyJoystickPosition = (pos) => {
      joyZoneEl?.classList.toggle('position-center', pos === 'center');
    };
    const joyPosRadios = document.querySelectorAll('input[name="joystick-position"]');
    const currentJoyPos = this.settings.get('joystickPosition');
    joyPosRadios.forEach((radio) => {
      radio.checked = radio.value === currentJoyPos;
      radio.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        this.settings.set('joystickPosition', e.target.value);
        applyJoystickPosition(e.target.value);
        this.saveManager.data.settings = this.settings.toJSON();
        this.saveManager.scheduleSave();
      });
    });
    applyJoystickPosition(currentJoyPos);

    settingsBtn?.addEventListener('click', () => {
      settingsPanel?.classList.remove('hidden');
      if (this.game.isRunning()) this.game.pause();
    });

    document.getElementById('restart-btn')?.addEventListener('click', () => {
      document.getElementById('game-over-modal')?.classList.add('hidden');
      this._resetRunState();
      this.game.startRun();
    });

    document.getElementById('victory-restart-btn')?.addEventListener('click', () => {
      document.getElementById('victory-modal')?.classList.add('hidden');
      this._resetRunState();
      this.game.startRun();
    });

    document.getElementById('encyclopedia-btn')?.addEventListener('click', () => {
      document.getElementById('encyclopedia-modal')?.classList.remove('hidden');
      this._renderEncyclopedia('enemies');
    });
    document.getElementById('encyclopedia-close-btn')?.addEventListener('click', () => {
      document.getElementById('encyclopedia-modal')?.classList.add('hidden');
    });
    document.querySelectorAll('#encyclopedia-tabs .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#encyclopedia-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderEncyclopedia(btn.dataset.tab);
      });
    });
    settingsCloseBtn?.addEventListener('click', () => {
      settingsPanel?.classList.add('hidden');
      if (this.game.state === GameState.PAUSED) this.game.resume();
    });
    musicSlider?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.settings.set('musicVolume', v);
      this.audio.setVolume('music', v);
      this.saveManager.data.settings = this.settings.toJSON();
      this.saveManager.scheduleSave();
    });
    sfxSlider?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.settings.set('sfxVolume', v);
      this.audio.setVolume('sfx', v);
      this.saveManager.data.settings = this.settings.toJSON();
      this.saveManager.scheduleSave();
    });
  }

  _persistRunStats(summary) {
    const d = this.saveManager.data;
    d.totalRuns += 1;
    d.totalPlaytimeMs += summary.elapsedMs;
    d.totalGold += this.game.gold; // ouro da run vira parte do total permanente
    if (summary.level > d.bestLevel) d.bestLevel = summary.level;
    if (summary.elapsedMs > d.bestTimeMs) d.bestTimeMs = summary.elapsedMs;
    d.totalKills += summary.kills;
    this.saveManager.save();
    this._updateBestRecordDisplay();

    const newAchievements = this.achievementSystem.checkAll();
    for (const ach of newAchievements) {
      this.hud.showNotice(`🏆 Conquista: ${ach.name}`, 3500);
    }
  }

  _formatRunSummaryText(summary) {
    const minutes = Math.floor(summary.elapsedMs / 60000);
    const seconds = Math.floor((summary.elapsedMs / 1000) % 60);
    return `Nível ${summary.level} · ${minutes}m${seconds}s · ${summary.kills} inimigos derrotados · ${Math.round(summary.damageDealt)} de dano causado`;
  }

  _onRunWon(summary) {
    this._persistRunStats(summary);
    if (!this.saveManager.data.achievements.abismo_silenciado) {
      this.saveManager.data.achievements.abismo_silenciado = true;
      this.saveManager.scheduleSave();
      this.hud.showNotice('🏆 Conquista: Abismo Silenciado');
    }

    const summaryEl = document.getElementById('victory-summary');
    if (summaryEl) summaryEl.textContent = this._formatRunSummaryText(summary);
    document.getElementById('victory-modal')?.classList.remove('hidden');
  }

  _onRunEnded(summary) {
    this._persistRunStats(summary);

    const summaryEl = document.getElementById('game-over-summary');
    if (summaryEl) {
      summaryEl.textContent = this._formatRunSummaryText(summary);
    }
  }

  _updateBestRecordDisplay() {
    const el = document.getElementById('best-record-line');
    if (!el) return;
    const d = this.saveManager.data;
    if (d.totalRuns === 0) { el.textContent = ''; return; }
    const minutes = Math.floor(d.bestTimeMs / 60000);
    const seconds = Math.floor((d.bestTimeMs / 1000) % 60);
    el.textContent = `🏆 Recorde: Nível ${d.bestLevel} · ${minutes}m${seconds}s · ${d.totalGold} ouro total`;
  }

  _onTick(ticker) {
    const realDtMs = ticker.deltaMS;
    this.game.tick(realDtMs);

    const scaledDtMs = realDtMs * this.game.timeScale;
    const scaledDtSec = scaledDtMs / 1000;

    this.hud.updateTimer(this.game.getFormattedTime());

    if (this.game.isRunning()) {
      this.player.update(scaledDtSec, (x, y, dmg, opts) => {
        this.particles.burst({ x, y, ...opts });
        this.damageNumbers.spawn(x, y, dmg, false);
      });
      this.camera.followTarget(this.player.x, this.player.y, scaledDtSec);
      this.camera.update(scaledDtSec);
      this.renderer.applyCamera(this.camera);
      this.particles.update(scaledDtMs);
      this.damageNumbers.update(scaledDtMs);
      this.hud.updateHealth(this.player.health, this.player.maxHealth);

      this.spawnSystem.update(scaledDtMs, this.player.x, this.player.y);
      const enemies = this.spawnSystem.activeEnemies;

      this.enemyGrid.clear();
      for (const enemy of enemies) {
        if (enemy.alive) this.enemyGrid.insert(enemy, enemy.x, enemy.y);
      }

      const behaviorCtx = {
        player: this.player,
        enemies,
        enemyGrid: this.enemyGrid,
        spawnEnemyFn: (id, x, y) => this.spawnSystem.spawnByType(id, x, y),
        particlesFn: (x, y, opts) => this.particles.burst({ x, y, ...opts }),
        statusDamageFn: (x, y, dmg, color) => {
          this.particles.burst({ x, y, color, count: 4 });
          this.damageNumbers.spawn(x, y, dmg, false);
        },
        damagePlayerAtFn: (x, y, damage, radius) => {
          if (distance(this.player.x, this.player.y, x, y) > radius) return;
          const dealt = this.player.takeDamage(damage);
          this.game.registerDamageTaken(dealt);
          this.player.statusReceiver.apply('freeze'); // Mago Sombrio — magia de gelo
          this.damageNumbers.spawn(this.player.x, this.player.y, dealt, false);
          this.camera.shakeForAreaDamage();
        },
      };
      for (const enemy of enemies) enemy.update(scaledDtSec, behaviorCtx);

      for (const weapon of this.inventory.weaponSystems) {
        weapon.update(scaledDtMs, { ownerX: this.player.x, ownerY: this.player.y, enemies, damageMult: this.player.damageMult, attackSpeedMult: this.player.attackSpeedMult ?? 1, rangeMult: this.player.rangeMult ?? 1, particles: this.particles, onFire: () => this.player.playAttackAnimation() });
      }
      this.damageSystem.update({ player: this.player, enemies, weaponSystems: this.inventory.weaponSystems });
      this.lootSystem.update(
        this.player.x, this.player.y, this.player.magnetMult ?? 1,
        (gold) => this.game.addGold(gold),
        (xp) => {
          this.game.addXP(xp * (this.player.xpMult ?? 1));
          this.audio.playSfx('pickupCoin');
        },
      );

      this._updateBossSpawnTimers();
      if (this.currentBoss?.alive) {
        this.currentBoss.update(scaledDtSec, { player: this.player });
        this.hud.updateBossHealth(this.currentBoss.health, this.currentBoss.maxHealth);
        this._checkBossCollisions(this.currentBoss);
      } else if (this.currentBoss && !this.currentBoss.alive) {
        this.currentBoss = null;
        this.hud.hideBossBar();
      }

      this._updateMinibossSpawnTimers();
      if (this.currentMiniboss?.alive) {
        this.currentMiniboss.update(scaledDtSec, { player: this.player });
        this._checkBossCollisions(this.currentMiniboss);
      } else if (this.currentMiniboss && !this.currentMiniboss.alive) {
        this.currentMiniboss = null;
      }

      if (!this.player.isAlive() && !this._playerDeathHandled) {
        this._playerDeathHandled = true;
        this.player.playDeathAnimation();
        this.camera.shakeForPlayerDamage();
        // Espera a animação de morte tocar (4 frames a 4fps = 1s) antes
        // de travar a partida e mostrar o modal — sem isso, o jogador
        // nunca chega a VER a própria morte, só some direto pro menu.
        setTimeout(() => {
          this.game.endRun();
          document.getElementById('game-over-modal')?.classList.remove('hidden');
        }, 1000);
      }
    }
  }
}

const app = new App();
window.__ecosApp = app; // acesso de depuração via console do navegador
app.init().catch((err) => {
  console.error('Falha ao iniciar o jogo:', err);
  const banner = document.getElementById('fatal-error-banner');
  if (banner) {
    banner.textContent = `⚠ Não foi possível iniciar o jogo: ${err.message}`;
    banner.classList.remove('hidden');
  }
});
