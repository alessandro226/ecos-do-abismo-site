// ====================================================================
// objectPool.js — Pool genérico de objetos. Pré-aloca N instâncias via
// uma factory, mantém as inativas guardadas, e entrega uma pronta via
// acquire() — sem NUNCA criar objeto novo durante o gameplay depois do
// aquecimento inicial. Essencial pra suportar milhares de inimigos/
// projéteis sem picos de Garbage Collection.
// ====================================================================

export class ObjectPool {
  /**
   * @param {() => object} factory - cria uma instância nova (só usado no aquecimento e em auto-expansão)
   * @param {number} initialSize - quantas instâncias pré-alocar
   * @param {object} [options]
   * @param {boolean} [options.autoExpand=false] - se true, cria instância nova quando o pool esgota
   * @param {(obj:object)=>void} [options.onAcquire] - chamado toda vez que um objeto é entregue
   * @param {(obj:object)=>void} [options.onRelease] - chamado toda vez que um objeto é devolvido
   */
  constructor(factory, initialSize, options = {}) {
    this.factory = factory;
    this.autoExpand = options.autoExpand ?? false;
    this.onAcquire = options.onAcquire ?? null;
    this.onRelease = options.onRelease ?? null;

    this._available = [];
    this._active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this._available.push(this.factory());
    }
  }

  acquire() {
    let obj;
    if (this._available.length > 0) {
      obj = this._available.pop();
    } else if (this.autoExpand) {
      obj = this.factory();
    } else {
      return null; // pool esgotada, sem auto-expansão — quem chama decide o que fazer
    }

    this._active.add(obj);
    if (this.onAcquire) this.onAcquire(obj);
    return obj;
  }

  release(obj) {
    if (!this._active.has(obj)) return;
    this._active.delete(obj);
    if (this.onRelease) this.onRelease(obj);
    this._available.push(obj);
  }

  releaseAll() {
    for (const obj of [...this._active]) this.release(obj);
  }

  get activeCount() {
    return this._active.size;
  }

  get availableCount() {
    return this._available.length;
  }

  forEachActive(fn) {
    for (const obj of this._active) fn(obj);
  }
}
