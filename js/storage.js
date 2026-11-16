(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./domain.js'));
  else root.PondStorage = factory(root.PondDomain);
})(globalThis, function (D) {
  'use strict';
  const KEY = 'pondwise_v2', LEGACY = 'pondwise_v1', DEMO = 'pondwise_demo_v2';
  class Store {
    constructor(storage, demo = false) { this.storage = storage; this.key = demo ? DEMO : KEY; this.raw = undefined; this.recoveryKey = this.key; this.blocked = false; }
    open() {
      try {
        this.raw = this.storage.getItem(this.key);
        if (this.raw !== null) { this.state = D.parse(this.raw); return { status: 'ready', state: this.state }; }
        const old = this.key === KEY ? this.storage.getItem(LEGACY) : null;
        if (old !== null) { this.recoveryKey = LEGACY; this.state = D.parse(old); this.pendingLegacy = old; return { status: 'migration', state: this.state }; }
        this.state = D.blank(); return { status: 'new', state: this.state };
      } catch (error) { this.blocked = true; return { status: 'recovery', error }; }
    }
    commit(candidate, recovery = false) {
      if (this.blocked && !recovery) throw new Error('Storage is in recovery mode. Export raw data or restore a validated backup.');
      const next = D.validate(candidate);
      const current = this.storage.getItem(this.key);
      if (current !== this.raw) throw new Error('Another tab changed this workspace. Export your draft, then reload before saving.');
      if (typeof this.pendingLegacy === 'string' && this.storage.getItem(LEGACY) !== this.pendingLegacy) {
        throw new Error('Legacy data changed after this migration preview. Reload to review and migrate the latest records.');
      }
      next.revision = (this.state?.revision || 0) + 1;
      D.number(next.revision, 'revision', 0, Number.MAX_SAFE_INTEGER, false, true);
      const encoded = JSON.stringify(next);
      if (new TextEncoder().encode(encoded).length > 5 * 1024 * 1024 - 256) throw new Error('Workspace exceeds the 5 MiB backup limit. Export records before continuing.');
      // A failed snapshot prevents the mutation; no existing data is discarded.
      if (current !== null) {
        this.storage.setItem(this.key + '_rollback', current);
        if (this.storage.getItem(this.key + '_rollback') !== current) throw new Error('Recovery snapshot verification failed.');
      }
      let wrote = false;
      try {
        this.storage.setItem(this.key, encoded); wrote = true;
        if (this.storage.getItem(this.key) !== encoded) throw new Error('Write verification failed.');
      } catch (error) {
        if (wrote) {
          try { if (current === null) this.storage.removeItem(this.key); else this.storage.setItem(this.key, current); }
          catch (_) { this.blocked = true; throw new Error('Write outcome uncertain. Recovery snapshot retained; reload before continuing.'); }
        }
        throw error;
      }
      this.recoveryKey = this.key; this.raw = encoded; this.state = next; this.blocked = false; this.pendingLegacy = null;
      return next;
    }
    changed() { return this.storage.getItem(this.key) !== this.raw; }
    export() { return JSON.stringify({ ...D.validate(this.state || D.blank()), exportedAt: new Date().toISOString() }); }
    rollback() { const raw = this.storage.getItem(this.key + '_rollback'); if (raw === null) throw new Error('No rollback snapshot exists.'); return D.parse(raw); }
  }
  return { Store, KEY, LEGACY, DEMO };
});
