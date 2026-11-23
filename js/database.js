/* FITTRACK - database.js : couche IndexedDB (100 % locale) */
(function (root) {
  'use strict';
  const DB_NAME = 'fittrack', DB_VERSION = 2;
  const STORES = {
    settings: { keyPath: 'key' },
    weights: { keyPath: 'id', autoIncrement: true, indexes: ['date'] },      // poids + mensurations (historique conservé)
    workouts: { keyPath: 'id', autoIncrement: true, indexes: ['date', 'type'] }, // séances + exercices + séries
    exerciseLib: { keyPath: 'id', autoIncrement: true, indexes: ['name'] },
    foods: { keyPath: 'id', autoIncrement: true, indexes: ['name'] },
    meals: { keyPath: 'id', autoIncrement: true, indexes: ['date', 'category'] }, // {date, category, entries:[{foodId, grams}]}
    mealLog: { keyPath: 'key', indexes: ['date'] },                          // suivi repas : {key:'date|repas', date, category, ok}
    xpEvents: { keyPath: 'eventKey', indexes: ['date'] }                      // eventKey unique = anti double récompense
  };
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        Object.entries(STORES).forEach(([name, cfg]) => {
          if (db.objectStoreNames.contains(name)) return;
          const os = db.createObjectStore(name, { keyPath: cfg.keyPath, autoIncrement: !!cfg.autoIncrement });
          (cfg.indexes || []).forEach(ix => os.createIndex(ix, ix));
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbp = null; reject(req.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode), os = t.objectStore(store);
      let out; try { out = fn(os); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
      t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
    }));
  }
  // Repli (fichier ouvert en local, IndexedDB bloqué) : stockage mémoire + localStorage si disponible
  let mem = null, seq = 0;
  const kp = s => STORES[s].keyPath;
  function persist() { try { localStorage.setItem('fittrack_mem', JSON.stringify({ mem, seq })); } catch (e) {} }
  function loadMem() { try { const r = JSON.parse(localStorage.getItem('fittrack_mem')); if (r && r.mem) { seq = r.seq; Object.keys(STORES).forEach(s => r.mem[s] = r.mem[s] || []); return r.mem; } } catch (e) {} const m = {}; Object.keys(STORES).forEach(s => m[s] = []); return m; }
  async function useMem() { if (mem) return true; try { await open(); return false; } catch (e) { mem = loadMem(); return true; } }
  function memPut(s, v) { const k = kp(s), a = mem[s]; if (STORES[s].autoIncrement && v[k] == null) v[k] = ++seq; const i = a.findIndex(x => x[k] === v[k]); if (i >= 0) a[i] = v; else a.push(v); persist(); return v[k]; }
  const db = {
    open,
    add: async (s, v) => (await useMem()) ? memPut(s, { ...v }) : tx(s, 'readwrite', os => os.add(v)),
    put: async (s, v) => (await useMem()) ? memPut(s, { ...v }) : tx(s, 'readwrite', os => os.put(v)),
    get: async (s, k) => (await useMem()) ? mem[s].find(x => x[kp(s)] === k) : tx(s, 'readonly', os => os.get(k)),
    all: async s => (await useMem()) ? mem[s].slice() : tx(s, 'readonly', os => os.getAll()),
    remove: async (s, k) => (await useMem()) ? (mem[s] = mem[s].filter(x => x[kp(s)] !== k), persist()) : tx(s, 'readwrite', os => os.delete(k)),
    async byRange(s, index, from, to) {
      if (await useMem()) return mem[s].filter(x => x[index] >= from && x[index] <= to);
      return tx(s, 'readonly', os => os.index(index).getAll(IDBKeyRange.bound(from, to)));
    },
    isMem: () => !!mem,
    async getSetting(key, def) { const r = await db.get('settings', key); return r ? r.value : def; },
    setSetting: (key, value) => db.put('settings', { key, value }),
    // XP : insertion refusée si l'événement existe déjà (pas de double récompense)
    async addXpEvent(ev) {
      if (await db.get('xpEvents', ev.eventKey)) return false;
      await db.add('xpEvents', ev); return true;
    },
    // Sauvegarde complète JSON
    async exportAll() {
      const data = { app: 'FITTRACK', version: 1, exportedAt: new Date().toISOString(), stores: {} };
      for (const s of Object.keys(STORES)) data.stores[s] = await db.all(s);
      return data;
    },
    // Restauration sans doublons : fusion (put sur clé identique), jamais de vidage
    async importAll(data) {
      if (!data || data.app !== 'FITTRACK' || !data.stores) throw new Error('Fichier de sauvegarde invalide');
      let added = 0;
      for (const [s, rows] of Object.entries(data.stores)) {
        if (!STORES[s] || !Array.isArray(rows)) continue;
        for (const r of rows) {
          const k = r[STORES[s].keyPath];
          if (k !== undefined && await db.get(s, k)) continue;
          await db.put(s, r); added++;
        }
      }
      return added;
    },
    STORES
  };
  root.FT = root.FT || {}; root.FT.db = db;
})(typeof window !== 'undefined' ? window : globalThis);
