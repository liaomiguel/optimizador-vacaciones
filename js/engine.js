/* Estirá tus Días — motor de cálculo. Sin dependencias, sin acceso a red, sin IA. */
(function (root) {
    'use strict';
    const DAY_MS = 86400000;
    function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }
    function toISO(t) { return new Date(t).toISOString().slice(0, 10); }
    function addDays(s, n) { return toISO(parseISO(s) + n * DAY_MS); }
    function dowOf(s) { return new Date(parseISO(s)).getUTCDay(); }
    function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY_MS); }
    function isValidISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s; }

    /* ---------- Categorías y reglas ---------- */
    const CATEGORIES = {
        nacional: { label: 'Feriados nacionales inamovibles', group: 'feriado' },
        trasladable: { label: 'Feriados trasladables', group: 'feriado' },
        turistico: { label: 'Días no laborables con fines turísticos', group: 'no_laborable' },
        no_laborable: { label: 'Otros días no laborables nacionales', group: 'no_laborable' },
        provincial: { label: 'Feriados provinciales', group: 'feriado' },
        municipal: { label: 'Feriados municipales', group: 'feriado' },
        personal: { label: 'Días no laborables propios', group: 'no_laborable' },
        sin_clasificar: { label: 'Sin clasificar', group: 'no_laborable' }
    };
    /* Mapeo explícito tipo de ArgentinaDatos -> categoría interna. Lo que no figura queda "sin_clasificar". */
    const TYPE_MAP = { inamovible: 'nacional', trasladable: 'trasladable', puente: 'turistico', nolaborable: 'no_laborable', 'no laborable': 'no_laborable' };
    const COST_CATS = {
        laborable: 'Día laborable habitual',
        sabado: 'Sábado que no trabajás',
        domingo: 'Domingo que no trabajás',
        feriado: 'Feriado que aplica',
        no_laborable: 'Día no laborable que aplica',
        no_habitual: 'Día de semana que no trabajás'
    };
    const REGIMES = {
        corridos: { laborable: true, sabado: true, domingo: true, feriado: true, no_laborable: true, no_habitual: true },
        habiles: { laborable: true, sabado: false, domingo: false, feriado: false, no_laborable: false, no_habitual: false }
    };

    /* ---------- Normalización ---------- */
    function normalizeHolidays(raw, year, source) {
        const items = [], issues = [];
        if (!Array.isArray(raw)) { issues.push('La respuesta no es una lista de feriados.'); return { items, issues }; }
        raw.forEach((r, i) => {
            if (!r || !isValidISO(r.fecha)) { issues.push(`Registro ${i + 1}: fecha inválida, se ignoró.`); return; }
            if (Number(r.fecha.slice(0, 4)) !== year) { issues.push(`Registro ${i + 1}: ${r.fecha} no pertenece a ${year}, se ignoró.`); return; }
            const tipo = String(r.tipo == null ? '' : r.tipo).trim().toLowerCase();
            const categoria = TYPE_MAP[tipo] || 'sin_clasificar';
            if (!TYPE_MAP[tipo]) issues.push(`«${r.nombre || r.fecha}» tiene un tipo que la app no reconoce («${r.tipo}»): quedó sin clasificar.`);
            items.push({ id: `${source}:${r.fecha}:${tipo}:${i}`, fecha: r.fecha, nombre: String(r.nombre || 'Sin nombre'), tipoOriginal: r.tipo == null ? null : String(r.tipo), categoria, fuente: source, origen: 'importado' });
        });
        items.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
        return { items, issues };
    }
    function mergeHolidays(imported, personal) {
        const hidden = new Set((personal && personal.hidden) || []);
        const added = ((personal && personal.added) || []).map(h => Object.assign({}, h, { fuente: 'usuario', origen: 'manual' }));
        return imported.filter(h => !hidden.has(h.id)).concat(added);
    }

    /* ---------- Calendario ---------- */
    function buildCalendar(cfg, holidays) {
        const pad = cfg.pad == null ? 16 : cfg.pad;
        const rs = cfg.rangeStart || `${cfg.year}-01-01`;
        const re = cfg.rangeEnd || `${cfg.year}-12-31`;
        const minDate = rs < `${cfg.year}-01-01` ? rs : `${cfg.year}-01-01`;
        const maxDate = re > `${cfg.year}-12-31` ? re : `${cfg.year}-12-31`;
        const start = addDays(minDate, -pad), end = addDays(maxDate, pad);
        const n = diffDays(start, end) + 1;
        const byDate = new Map();
        holidays.forEach(h => { if (!byDate.has(h.fecha)) byDate.set(h.fecha, []); byDate.get(h.fecha).push(h); });
        const avoid = new Set(cfg.avoid || []), prefer = new Set(cfg.prefer || []);
        const days = new Array(n);
        for (let i = 0; i < n; i++) {
            const date = addDays(start, i), dw = dowOf(date);
            const hs = byDate.get(date) || [];
            const applying = hs.filter(h => cfg.applyCats[h.categoria]);
            const holidayApplies = applying.length > 0;
            const isWorkdayHabitual = !!cfg.workdays[dw];
            let costCat;
            if (holidayApplies) costCat = applying.some(h => CATEGORIES[h.categoria].group === 'feriado') ? 'feriado' : 'no_laborable';
            else if (isWorkdayHabitual) costCat = 'laborable';
            else if (dw === 6) costCat = 'sabado';
            else if (dw === 0) costCat = 'domingo';
            else costCat = 'no_habitual';
            const inRange = date >= rs && date <= re;
            days[i] = {
                i, date, dow: dw, isWeekend: dw === 0 || dw === 6, holidays: hs, applying,
                isHoliday: hs.length > 0, holidayApplies, isWorkdayHabitual,
                is_non_working_day: !isWorkdayHabitual || holidayApplies,
                costCat, consumes_vacation_balance: !!cfg.costRules[costCat],
                excluded: avoid.has(date), preferred: prefer.has(date),
                inYear: inRange, inRange: inRange
            };
        }
        return { start, end, days, index: new Map(days.map(d => [d.date, d.i])), year: cfg.year, rangeStart: rs, rangeEnd: re };
    }
    function periodCost(cal, s, e) { let c = 0; for (let i = cal.index.get(s); i <= cal.index.get(e); i++) c += cal.days[i].consumes_vacation_balance ? 1 : 0; return c; }

    /* ---------- Generador de candidatos ---------- */
    function generateCandidates(cal, o) {
        const d = cal.days, n = d.length, S = o.S, minLen = Math.max(1, o.minLen || 1), maxLen = o.maxLen || 0;
        const stats = { evaluated: 0, overBalance: 0, excluded: 0, tooShort: 0, tooLong: 0, noGain: 0, duplicates: 0 };
        const freeLeft = new Int32Array(n), freeRight = new Int32Array(n);
        for (let i = 1; i < n; i++) freeLeft[i] = d[i - 1].is_non_working_day ? freeLeft[i - 1] + 1 : 0;
        for (let i = n - 2; i >= 0; i--) freeRight[i] = d[i + 1].is_non_working_day ? freeRight[i + 1] + 1 : 0;
        const best = new Map();
        for (let s = 0; s < n; s++) {
            if (!d[s].inRange) continue;
            let cost = 0, work = 0;
            for (let e = s; e < n; e++) {
                const de = d[e];
                if (!de.inRange) break;
                if (de.excluded) { stats.excluded++; break; }
                if (de.consumes_vacation_balance) cost++;
                if (!de.is_non_working_day) work++;
                const len = e - s + 1;
                if (maxLen && len > maxLen) { stats.tooLong++; break; }
                if (cost > S) { stats.overBalance++; break; }
                stats.evaluated++;
                if (len < minLen) { stats.tooShort++; continue; }
                if (work === 0) { stats.noGain++; continue; }
                const bs = s - freeLeft[s], be = e + freeRight[e];
                const key = bs * 100000 + be;
                const prev = best.get(key);
                if (!prev || cost < prev.cost || (cost === prev.cost && len < prev.len)) {
                    if (prev) stats.duplicates++;
                    best.set(key, { si: s, ei: e, bs, be, cost, len, work });
                } else stats.duplicates++;
            }
        }
        const cands = [];
        best.forEach(c => {
            let run = 0, baseMax = 0, pref = 0;
            const hol = [];
            for (let i = c.bs; i <= c.be; i++) {
                const isVac = i >= c.si && i <= c.ei;
                if (d[i].is_non_working_day) { run++; if (run > baseMax) baseMax = run; } else run = 0;
                if (d[i].preferred) pref++;
                if (d[i].holidayApplies) d[i].applying.forEach(h => hol.push(h));
                void isVac;
            }
            const blockLen = c.be - c.bs + 1;
            cands.push(Object.assign(c, {
                start: d[c.si].date, end: d[c.ei].date, blockStart: d[c.bs].date, blockEnd: d[c.be].date,
                blockLen, baseMax, gain: blockLen - baseMax, pref, holidays: hol,
                touchesEdge: c.bs === 0 || c.be === n - 1
            }));
        });
        cands.sort((a, b) => a.be - b.be || a.bs - b.bs);
        return { cands, stats };
    }

    /* ---------- Planes y comparadores ---------- */
    function makePlan(periods, S) {
        const ps = periods.slice().sort((a, b) => a.bs - b.bs);
        let cost = 0, D = 0, M = 0, gain = 0, pref = 0, minGap = null;
        const hol = new Map();
        ps.forEach((p, i) => {
            cost += p.cost; D += p.blockLen; gain += p.gain; pref += p.pref; if (p.blockLen > M) M = p.blockLen;
            p.holidays.forEach(h => hol.set(h.fecha + h.nombre, h));
            if (i > 0) { const g = p.bs - ps[i - 1].be - 1; if (minGap === null || g < minGap) minGap = g; }
        });
        return {
            periods: ps, k: ps.length, cost, D, M, gain, pref, minGap, R: S - cost,
            ratio: cost > 0 ? D / cost : Infinity, gainRatio: cost > 0 ? gain / cost : Infinity,
            holidays: [...hol.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
            first: ps.length ? ps[0].bs : 0,
            key: ps.map(p => p.si + '-' + p.ei).join('|')
        };
    }
    const EPS = 1e-9;
    function cmpRatio(a, b) { if (a === b) return 0; if (a === Infinity) return -1; if (b === Infinity) return 1; return Math.abs(a - b) < EPS ? 0 : (b - a); }
    const cmp = {
        A: (a, b) => b.M - a.M || b.D - a.D || a.cost - b.cost || b.R - a.R || b.pref - a.pref || a.first - b.first,
        B: (a, b) => cmpRatio(a.gainRatio, b.gainRatio) || b.M - a.M || a.cost - b.cost || b.pref - a.pref || a.first - b.first,
        C: (a, b) => b.D - a.D || (b.minGap || 0) - (a.minGap || 0) || b.holidays.length - a.holidays.length || a.cost - b.cost || b.pref - a.pref || a.first - b.first
    };

    /* ---------- Programación dinámica para varios períodos ----------
       Los períodos de una combinación deben producir bloques de descanso separados por al menos
       `gap` días (mínimo 1 día laborable). Así las métricas son aditivas y nada se cuenta dos veces. */
    function runDP(cands, S, K, valueFn, gap) {
        const N = cands.length, KK = K + 1, W = (S + 1) * KK;
        const dp = new Float64Array((N + 1) * W).fill(-Infinity);
        dp[0] = 0;
        const ends = cands.map(c => c.be), p = new Int32Array(N);
        for (let i = 0; i < N; i++) {
            const limit = cands[i].bs - gap; // be_j < limit
            let lo = 0, hi = N;
            while (lo < hi) { const m = (lo + hi) >> 1; if (ends[m] < limit) lo = m + 1; else hi = m; }
            p[i] = lo;
        }
        for (let i = 0; i < N; i++) {
            const row = (i + 1) * W, prev = i * W, prow = p[i] * W, cst = cands[i].cost, v = valueFn(cands[i]);
            dp.copyWithin(row, prev, prev + W);
            for (let c = cst; c <= S; c++) {
                for (let k = 1; k <= K; k++) {
                    const t = dp[prow + (c - cst) * KK + k - 1];
                    if (t > -Infinity && t + v > dp[row + c * KK + k]) dp[row + c * KK + k] = t + v;
                }
            }
        }
        function value(c, k) { return dp[N * W + c * KK + k]; }
        function reconstruct(c, k) {
            const out = []; let i = N;
            while (i > 0 && k > 0) {
                if (dp[i * W + c * KK + k] === dp[(i - 1) * W + c * KK + k]) { i--; continue; }
                const cd = cands[i - 1]; out.push(cd); c -= cd.cost; k--; i = p[i - 1];
            }
            return out.reverse();
        }
        return { value, reconstruct, S, K };
    }
    const restValue = c => c.blockLen * 1e6 + c.gain * 1e3 + Math.min(c.pref, 999);
    const gainValue = c => c.gain * 1e6 + c.blockLen * 1e3 + Math.min(c.pref, 999);

    function bestStates(dpr, kMin, kMax, scoreFn) {
        let best = -Infinity; const states = [];
        for (let k = kMin; k <= kMax; k++) for (let c = 0; c <= dpr.S; c++) {
            const v = dpr.value(c, k); if (v === -Infinity) continue;
            const s = scoreFn(v, c, k);
            if (s > best + EPS) { best = s; states.length = 0; states.push([c, k]); } else if (Math.abs(s - best) <= EPS) states.push([c, k]);
        }
        return states;
    }

    /* ---------- Optimizador ---------- */
    function optimize(cal, o) {
        const S = o.S | 0, K = Math.max(1, o.maxPeriods | 0), gap = Math.max(1, o.minSep | 0);
        const out = { S, K, gap, exhaustive: true, notes: [] };
        if (S <= 0) { out.empty = 'saldo'; return out; }
        const { cands, stats } = generateCandidates(cal, o);
        out.stats = stats; out.candidateCount = cands.length;
        if (!cands.length) { out.empty = 'sin_candidatos'; return out; }
        const pref = o.preference || 'none';
        const kMin = pref === 'many' ? 2 : 1, kMax = pref === 'one' ? 1 : K;
        if (pref === 'many' && K < 2) { out.empty = 'conflicto'; out.notes.push('Pediste varios períodos pero el máximo configurado es 1.'); return out; }

        const singles = cands.map(c => makePlan([c], S));
        out.singleA = singles.slice().sort(cmp.A);
        out.singleB = singles.slice().sort(cmp.B);

        let restDP = null, gainDP = null;
        if (K >= 2) { restDP = runDP(cands, S, K, restValue, gap); gainDP = runDP(cands, S, K, gainValue, gap); }

        // Mejor combinación de varios períodos (máximo descanso total), por cantidad de períodos
        out.multiByK = [];
        if (restDP) {
            for (let k = 2; k <= K; k++) {
                const st = bestStates(restDP, k, k, v => v);
                if (st.length) {
                    const plans = st.map(([c, kk]) => makePlan(restDP.reconstruct(c, kk), S)).sort(cmp.C);
                    out.multiByK.push(plans[0]);
                }
            }
            out.multiBest = out.multiByK.slice().sort(cmp.C)[0] || null;
            // Mejor rendimiento con varios períodos
            const stB = bestStates(gainDP, 2, K, (v, c) => (c === 0 ? 1e12 : Math.floor(v / 1e6) / c));
            const plansB = stB.map(([c, k]) => makePlan(gainDP.reconstruct(c, k), S)).sort(cmp.B);
            out.multiBestB = plansB[0] || null;
        }

        // Estrategia A
        let recA = kMin === 1 ? out.singleA[0] : null;
        // Complemento: con el saldo que sobra, qué más se puede sumar sin tocar el bloque principal
        const anchor = out.singleA[0];
        if (K >= 2 && anchor.R > 0) {
            const ap = anchor.periods[0];
            const compat = cands.filter(c => c.be < ap.bs - gap || c.bs > ap.be + gap);
            if (compat.length) {
                const dpc = runDP(compat, anchor.R, K - 1, restValue, gap);
                const st = bestStates(dpc, 1, K - 1, v => v);
                if (st.length) {
                    const plans = st.map(([c, k]) => makePlan(dpc.reconstruct(c, k), S)).sort(cmp.C);
                    out.complementA = plans[0];
                    if (kMin === 2) recA = makePlan([ap].concat(plans[0].periods), S);
                }
            }
        }
        out.recA = recA || anchor;

        // Estrategia B
        const bPool = [];
        if (kMin === 1) bPool.push(out.singleB[0]);
        if (kMax >= 2 && out.multiBestB) bPool.push(out.multiBestB);
        out.recB = bPool.sort(cmp.B)[0] || out.singleB[0];

        // Estrategia C
        if (restDP) {
            const st = bestStates(restDP, kMin, kMax, v => Math.floor(v / 1e6));
            const plans = st.map(([c, k]) => makePlan(restDP.reconstruct(c, k), S)).sort(cmp.C);
            out.recC = plans[0];
        } else out.recC = singles.slice().sort(cmp.C)[0];

        out.recommendation = { A: out.recA, B: out.recB, C: out.recC }[o.strategy || 'A'];
        return out;
    }

    /* Calcula sobre un plan cualquiera el detalle día por día (para la vista de transparencia). */
    function planDays(cal, plan) {
        const rows = [];
        plan.periods.forEach((p, bi) => {
            for (let i = p.bs; i <= p.be; i++) {
                const d = cal.days[i];
                rows.push({ block: bi, day: d, vacation: i >= p.si && i <= p.ei, consumes: i >= p.si && i <= p.ei && d.consumes_vacation_balance });
            }
        });
        return rows;
    }

    const api = {
        parseISO, toISO, addDays, dowOf, diffDays, isValidISO, CATEGORIES, TYPE_MAP, COST_CATS, REGIMES,
        normalizeHolidays, mergeHolidays, buildCalendar, periodCost, generateCandidates, makePlan, cmp, runDP, optimize, planDays
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
