/* FITTRACK - calculations.js : fonctions pures (aucun accès DOM/DB) */
(function (root) {
  'use strict';
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (v === '' || v == null ? null : (isFinite(+v) ? +v : null));
  const round = (v, d = 1) => v == null ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

  const R = Math.round;
  const calc = {
    round,
    // Volume = somme(charge x répétitions)
    setVolume: s => (num(s.weight) || 0) * (num(s.reps) || 0),
    exerciseVolume(ex) { return (ex.sets || []).reduce((t, s) => t + calc.setVolume(s), 0); },
    sessionStats(session) {
      const exs = session.exercises || [];
      const byMuscle = {};
      let volume = 0, sets = 0, reps = 0, maxLoad = 0;
      exs.forEach(ex => {
        const v = calc.exerciseVolume(ex);
        volume += v;
        byMuscle[ex.muscle || 'Autre'] = (byMuscle[ex.muscle || 'Autre'] || 0) + v;
        (ex.sets || []).forEach(s => {
          sets++; reps += num(s.reps) || 0;
          maxLoad = Math.max(maxLoad, num(s.weight) || 0);
        });
      });
      return { volume, sets, reps, maxLoad, byMuscle,
        byExercise: exs.map(e => ({ name: e.name, volume: calc.exerciseVolume(e) })) };
    },
    // 1RM estimé (Epley), null si reps invalides
    oneRM(weight, reps) {
      const w = num(weight), r = num(reps);
      if (!w || !r || r < 1) return null;
      return round(r === 1 ? w : w * (1 + r / 30), 1);
    },
    // Cardio : jamais de calories inventées
    cardioStats(a) {
      const d = num(a.distanceKm), min = num(a.durationMin);
      const speed = d && min ? round(d / (min / 60), 2) : null;
      let pace = null;
      if (d && min) { const p = min / d; const m = Math.floor(p); let s = Math.round((p - m) * 60); pace = s === 60 ? (m + 1) + ':00' : m + ':' + String(s).padStart(2, '0'); }
      const kcal = num(a.calories);
      return { speedKmh: speed, paceMinKm: pace, calories: kcal == null ? null : kcal };
    },
    foodMacros(food, grams) {
      const g = num(grams) || 0, k = g / 100, f = x => (num(x) || 0) * k;
      return { kcal: f(food.kcal), protein: f(food.protein), carbs: f(food.carbs), fat: f(food.fat),
        fiber: num(food.fiber) == null ? null : f(food.fiber) };
    },
    dayNutrition(entries) { // entries: [{food, grams}]
      const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, fiberKnown: false };
      entries.forEach(e => {
        const m = calc.foodMacros(e.food, e.grams);
        t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fat += m.fat;
        if (m.fiber != null) { t.fiber += m.fiber; t.fiberKnown = true; }
      });
      // répartition énergétique : 4/4/9 kcal par g
      const e = t.protein * 4 + t.carbs * 4 + t.fat * 9;
      t.split = e > 0 ? { protein: round(t.protein * 4 / e * 100), carbs: round(t.carbs * 4 / e * 100), fat: round(t.fat * 9 / e * 100) } : null;
      return t;
    },
    // XP cumulée nécessaire pour atteindre le niveau n (1..100), croissance progressive
    xpForLevel(n) { return n <= 1 ? 0 : Math.round(100 * Math.pow(n - 1, 1.5)); },
    levelInfo(totalXp) {
      let lvl = 1;
      while (lvl < 100 && totalXp >= calc.xpForLevel(lvl + 1)) lvl++;
      const cur = calc.xpForLevel(lvl), next = lvl >= 100 ? null : calc.xpForLevel(lvl + 1);
      return { level: lvl, xp: totalXp, nextAt: next, toNext: next == null ? 0 : next - totalXp,
        percent: next == null ? 100 : round((totalXp - cur) / (next - cur) * 100, 0) };
    },
    // Applique le plafond quotidien : renvoie l'XP réellement accordée
    capXp(alreadyToday, gain, cap) { return Math.max(0, Math.min(gain, cap - alreadyToday)); }    ,
    // ---------- RÈGLES XP ----------
    REF: { course: { v: 10, k: 4 }, marche: { v: 5.5, k: 1.5 }, velo: { v: 20, k: 1 }, natation: { v: 2, k: 20 } }, // vitesse de référence (km/h) et XP par km
    xpSum(P, cap) { const sum = P.reduce((t, p) => t + p[1], 0); return { total: Math.min(cap, sum), parts: P, raw: sum }; },
    // Musculation : 20 + 1,5/série (max 24) + 8×√(tonnes) (max 40) + 10/record 1RM (max 3) + 3/exo en progression ≥ +5 % de volume (max 5) ; plafond 150
    xpMuscu(s, h) {
      h = h || {}; const best = h.best || {}, last = h.last || {}, st = calc.sessionStats(s), P = [];
      if (!st.sets) return { total: 0, parts: [], raw: 0 };
      P.push(['Séance', 20]);
      P.push(['Séries (' + st.sets + ')', R(Math.min(st.sets, 24) * 1.5)]);
      const vx = R(Math.min(40, 8 * Math.sqrt(st.volume / 1000)));
      if (vx > 0) P.push(['Volume (' + R(st.volume) + ' kg)', vx]);
      let pr = 0, pg = 0;
      (s.exercises || []).forEach(e => {
        let m = 0; (e.sets || []).forEach(x => { const r = calc.oneRM(x.weight, x.reps); if (r > m) m = r; });
        if (m && best[e.name] && m > best[e.name]) pr++;
        const v = calc.exerciseVolume(e); if (last[e.name] && v >= last[e.name] * 1.05) pg++;
      });
      if (pr) P.push(['Records 1RM ×' + Math.min(pr, 3), Math.min(pr, 3) * 10]);
      if (pg) P.push(['Progression ×' + Math.min(pg, 5), Math.min(pg, 5) * 3]);
      return calc.xpSum(P, 150);
    },
    // Cardio : 8 + 0,25/min (max 120) + distance × XP/km + bonus vitesse (jusqu'à ×1,5 de l'effort) + 10/record ; plafond 150
    xpCardio(a, h) {
      h = h || {}; const r = calc.REF[a.type] || calc.REF.course, k = calc.cardioStats(a), min = Math.min(+a.durationMin || 0, 120), d = +a.distanceKm > 0 ? +a.distanceKm : 0;
      if (!min && !d) return { total: 0, parts: [], raw: 0 };
      const P = [['Séance', 8]], dur = min * 0.25, dis = d * r.k, f = k.speedKmh ? Math.min(1.5, Math.max(1, k.speedKmh / r.v)) : 1;
      if (dur) P.push(['Durée (' + min + ' min)', R(dur)]);
      if (dis) P.push(['Distance (' + d + ' km)', R(dis)]);
      if (f > 1) P.push(['Vitesse (' + k.speedKmh + ' km/h)', R((dur + dis) * (f - 1))]);
      if (d && h.dist && d > h.dist) P.push(['Record de distance', 10]);
      if (d >= 3 && h.speed && k.speedKmh > h.speed) P.push(['Record de vitesse', 10]);
      return calc.xpSum(P, 150);
    },
    xpOther(a) { const m = Math.min(+a.durationMin || 0, 90); return calc.xpSum([['Séance', 5], ['Durée (' + m + ' min)', R(m * 0.2)]], 40); },
    xpWeekly(streak) { return 50 + 10 * Math.min(streak, 5); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = calc;
  root.FT = root.FT || {}; root.FT.calc = calc;
})(typeof window !== 'undefined' ? window : globalThis);
