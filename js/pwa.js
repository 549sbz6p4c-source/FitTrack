/* FITTRACK - pwa.js : service worker, bandeau de mise à jour, rappel de sauvegarde, aide à l'installation.
   Aucune donnée n'est envoyée nulle part : ce fichier ne fait aucune requête réseau, hormis le chargement de sw.js. */
(function () {
  'use strict';
  const DAY = 864e5, db = () => window.FT && window.FT.db;
  function bar(msg, btns) {
    let b = document.getElementById('pwaBar');
    if (!b) { b = document.createElement('div'); b.id = 'pwaBar'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.textContent = ''; const s = document.createElement('span'); s.textContent = msg; b.appendChild(s);
    btns.forEach((x, i) => { const k = document.createElement('button'); k.type = 'button'; k.textContent = x[0]; if (!i) k.className = 'go'; k.addEventListener('click', x[1]); b.appendChild(k); });
    b.hidden = false;
  }
  const hide = () => { const b = document.getElementById('pwaBar'); if (b) b.hidden = true; };
  const busy = () => { const b = document.getElementById('pwaBar'); return b && !b.hidden; };

  // --- Dernière sauvegarde JSON : mémorisée (dans IndexedDB, via les réglages existants) ---
  const A = window.A;
  if (A && A.backup) {
    const ob = A.backup;
    A.backup = async function () { const r = await ob.apply(this, arguments); try { await db().setSetting('lastBackup', Date.now()); } catch (e) {} return r; };
  }
  async function reminder() {
    try {
      const d = db(), now = Date.now();
      let first = await d.getSetting('firstSeen', null); if (!first) { first = now; await d.setSetting('firstSeen', now); }
      const n = (await d.all('workouts')).length + (await d.all('mealLog')).length; if (!n || busy()) return;
      const last = (await d.getSetting('lastBackup', null)) || first, snooze = await d.getSetting('backupSnooze', 0);
      if (now - last < 14 * DAY || now < snooze) return;
      bar('Sauvegarde conseillée : exporte tes données en JSON.', [['Exporter', async () => { await window.A.backup(); hide(); }], ['Plus tard', async () => { await d.setSetting('backupSnooze', now + 3 * DAY); hide(); }]]);
    } catch (e) {}
  }
  async function installHint() {
    try {
      const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!ios || standalone || busy() || await db().getSetting('installHint', 0)) return;
      bar('Installe FITTRACK : Partager → Sur l’écran d’accueil. Les données de Safari ne sont pas copiées dans l’app installée : exporte puis restaure ta sauvegarde JSON.', [['Compris', async () => { await db().setSetting('installHint', 1); hide(); }]]);
    } catch (e) {}
  }

  // --- Service worker : hors connexion + mise à jour validée par l'utilisateur ---
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller; let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
        const ask = () => bar('Nouvelle version disponible.', [['Mettre à jour', () => { if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }], ['Plus tard', hide]]);
        if (reg.waiting && navigator.serviceWorker.controller) ask();
        reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(); }); });
        let lastCheck = Date.now();
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 10 * 60 * 1000) { lastCheck = Date.now(); reg.update().catch(() => {}); } });
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  window.addEventListener('load', () => setTimeout(() => { reminder().then(installHint); }, 2000));
})();
