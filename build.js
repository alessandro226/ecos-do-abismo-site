#!/usr/bin/env node
// ====================================================================
// build.js — Concatena todos os módulos ES6 (js/*.js, data/*.js) num
// único bundle.js SEM import/export, porque Chrome/Edge bloqueiam
// import de módulos ES6 via file:// (CORS), mesmo que o resto do HTML
// abra normal. Um <script> comum (não type="module") não tem essa
// restrição — daí a necessidade de empacotar.
//
// Uso: node build.js
// Gera: bundle.js (na raiz do projeto), referenciado pelo index.html.
// ====================================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Ordem de dependência: arquivos sem import primeiro, main.js por último.
const ORDER = [
  'data/sprites.js',
  'data/weapons.js', 'data/enemies.js', 'data/bosses.js',
  'data/blessings.js', 'data/relics.js', 'data/biomes.js',
  'data/atlasframes.js', 'data/minibosses.js',
  'js/utils.js', 'js/collision.js', 'js/objectPool.js', 'js/camera.js',
  'js/input.js', 'js/audio.js', 'js/save.js', 'js/settings.js',
  'js/animation.js', 'js/particles.js', 'js/game.js', 'js/renderer.js', 'js/ui.js',
  'entities/player.js', 'entities/enemy.js', 'entities/projectile.js', 'entities/boss.js',
  'systems/spawnSystem.js', 'systems/weaponSystem.js', 'systems/damageSystem.js',
  'systems/blessingSystem.js', 'systems/skillSystem.js', 'systems/lootSystem.js',
  'systems/statusEffects.js', 'systems/relicSystem.js', 'systems/evolutionSystem.js',
  'systems/achievementSystem.js',
  'js/main.js',
];

function stripModuleSyntax(source, filePath) {
  let out = source;
  // remove linhas de import (de um linha só — todos os nossos imports são assim)
  out = out.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  // "export class X" / "export function X" / "export const X" -> remove só o "export "
  out = out.replace(/^export\s+(class|function|const|let|var)\s+/gm, '$1 ');
  // "export { X }" / "export { X as Y }" — export nomeado (com ou sem
  // apelido) -> remove a linha inteira (o nome X já existe no escopo
  // do bundle de qualquer forma, não precisa reexportar dentro dele).
  out = out.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  return `\n// ==== ${filePath} ====\n${out}\n`;
}

let bundle = '(function(){\n"use strict";\n';
for (const relPath of ORDER) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`ARQUIVO FALTANDO: ${relPath}`);
    process.exit(1);
  }
  const source = fs.readFileSync(fullPath, 'utf8');
  bundle += stripModuleSyntax(source, relPath);
}
bundle += '\n})();\n';

fs.writeFileSync(path.join(ROOT, 'bundle.js'), bundle, 'utf8');
console.log(`bundle.js gerado (${(bundle.length / 1024).toFixed(0)}KB)`);
