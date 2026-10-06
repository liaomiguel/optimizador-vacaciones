/* Pruebas con calendarios y resultados esperados explícitos. */
(function (root) {
    'use strict';
    function runTests(E) {
        const results = [];
        const t = (name, fn) => { try { const r = fn(); results.push({ name, ok: r === true, detail: r === true ? '' : String(r) }); } catch (e) { results.push({ name, ok: false, detail: e.message }); } };
        const eq = (a, b, what) => (JSON.stringify(a) === JSON.stringify(b) ? true : `${what}: se esperaba ${JSON.stringify(b)} y se obtuvo ${JSON.stringify(a)}`);
        const all = (...checks) => { for (const c of checks) if (c !== true) return c; return true; };

        // Calendario de prueba: marzo-abril 2026 (lun 23 puente, mar 24 inamovible, jue 2 y vie 3 de abril inamovibles)
        const RAW = [
            { fecha: '2026-03-23', tipo: 'puente', nombre: 'Día no laborable con fines turísticos' },
            { fecha: '2026-03-24', tipo: 'inamovible', nombre: 'Memoria' },
            { fecha: '2026-04-02', tipo: 'inamovible', nombre: 'Malvinas' },
            { fecha: '2026-04-03', tipo: 'inamovible', nombre: 'Viernes Santo' }
        ];
        const H = E.normalizeHolidays(RAW, 2026, 'prueba').items;
        const WD = [false, true, true, true, true, true, false];
        const ALL = { nacional: true, trasladable: true, turistico: true, no_laborable: true, provincial: true, municipal: true, personal: true, sin_clasificar: true };
        const base = (over) => Object.assign({ year: 2026, workdays: WD, applyCats: ALL, costRules: E.REGIMES.habiles, rangeStart: '2026-01-01', rangeEnd: '2026-12-31' }, over || {});
        const cal = (over, hol) => E.buildCalendar(base(over), hol || H);

        t('Costo en días corridos: lunes 2 a domingo 8 de marzo = 7', () => eq(E.periodCost(cal({ costRules: E.REGIMES.corridos }), '2026-03-02', '2026-03-08'), 7, 'costo'));
        t('Costo en días hábiles: lunes 2 a domingo 8 de marzo = 5', () => eq(E.periodCost(cal(), '2026-03-02', '2026-03-08'), 5, 'costo'));
        t('Feriados no descuentan en hábiles: 23 al 27 de marzo = 3', () => eq(E.periodCost(cal(), '2026-03-23', '2026-03-27'), 3, 'costo'));
        t('Sin aplicar el día turístico, 23 al 27 de marzo = 4', () => eq(E.periodCost(cal({ applyCats: Object.assign({}, ALL, { turistico: false }) }), '2026-03-23', '2026-03-27'), 4, 'costo'));
        t('Clasificación de sábado, feriado y laborable', () => {
            const c = cal(); const g = d => c.days[c.index.get(d)];
            return all(eq(g('2026-03-21').costCat, 'sabado', '21/3'), eq(g('2026-03-24').costCat, 'feriado', '24/3'),
                eq(g('2026-03-23').costCat, 'no_laborable', '23/3'), eq(g('2026-03-25').costCat, 'laborable', '25/3'),
                eq(g('2026-03-24').is_non_working_day, true, '24/3 libre'), eq(g('2026-03-25').consumes_vacation_balance, true, '25/3 descuenta'));
        });
        t('Si trabajás los sábados, el sábado no es libre', () => {
            const c = cal({ workdays: [false, true, true, true, true, true, true] });
            const d = c.days[c.index.get('2026-03-21')];
            return all(eq(d.is_non_working_day, false, 'libre'), eq(d.costCat, 'laborable', 'categoría'));
        });
        t('Bloque consecutivo: 25 al 27 de marzo arma 9 días (21 al 29)', () => {
            const r = E.generateCandidates(cal(), { S: 3, minLen: 1 });
            const c = r.cands.find(x => x.start === '2026-03-25' && x.end === '2026-03-27');
            if (!c) return 'no se generó el período';
            return all(eq(c.blockStart, '2026-03-21', 'inicio'), eq(c.blockEnd, '2026-03-29', 'fin'), eq(c.blockLen, 9, 'largo'), eq(c.cost, 3, 'costo'), eq(c.baseMax, 4, 'descanso previo'), eq(c.gain, 5, 'ganancia'));
        });
        t('Excluir el día turístico achica el bloque a 6 días', () => {
            const r = E.generateCandidates(cal({ applyCats: Object.assign({}, ALL, { turistico: false }) }), { S: 3, minLen: 1 });
            const c = r.cands.find(x => x.start === '2026-03-25' && x.end === '2026-03-27');
            return c ? eq(c.blockLen, 6, 'largo') : 'no se generó el período';
        });
        t('Saldo restante R = S − V', () => {
            const p = E.makePlan([{ si: 0, ei: 1, bs: 0, be: 3, cost: 2, blockLen: 4, gain: 2, pref: 0, holidays: [] }], 14);
            return eq(p.R, 12, 'R');
        });
        // Calendario sin feriados, hábiles, saldo 2
        const flat = E.buildCalendar(base({ rangeStart: '2026-06-01', rangeEnd: '2026-06-30' }), []);
        t('Un período vs varios (sin feriados, saldo 2): único = 4 seguidos, dos períodos = 6 en total', () => {
            const r = E.optimize(flat, { S: 2, maxPeriods: 3, minLen: 1, strategy: 'A' });
            return all(eq(r.singleA[0].M, 4, 'mejor único'), eq(r.multiBest.D, 6, 'mejor combinación'), eq(r.multiBest.k, 2, 'cantidad'), eq(r.multiBest.cost, 2, 'agota el saldo exacto'));
        });
        t('Sin doble conteo: la suma de bloques coincide con los días distintos', () => {
            const r = E.optimize(cal(), { S: 6, maxPeriods: 3, minLen: 1, strategy: 'C' });
            const set = new Set();
            r.recC.periods.forEach(p => { for (let i = p.bs; i <= p.be; i++) set.add(i); });
            let overlap = false; const ps = r.recC.periods;
            for (let i = 1; i < ps.length; i++) if (ps[i].bs <= ps[i - 1].be + 1) overlap = true;
            return all(eq(set.size, r.recC.D, 'días únicos'), eq(overlap, false, 'superposición'), r.recC.cost <= 6 ? true : 'supera el saldo');
        });
        t('Restricciones: rango y fechas a evitar', () => {
            const c = cal({ rangeStart: '2026-03-01', rangeEnd: '2026-04-30', avoid: ['2026-03-26'] });
            const r = E.generateCandidates(c, { S: 5, minLen: 2, maxLen: 6 });
            for (const x of r.cands) {
                if (x.start < '2026-03-01' || x.end > '2026-04-30') return 'período fuera de rango';
                if (x.start <= '2026-03-26' && x.end >= '2026-03-26') return 'incluye una fecha evitada';
                if (x.len < 2 || x.len > 6) return 'duración fuera de límites';
                if (x.cost > 5) return 'supera el saldo';
            }
            return true;
        });
        t('Saldo cero: no hay recomendaciones', () => eq(E.optimize(cal(), { S: 0, maxPeriods: 2 }).empty, 'saldo', 'estado'));
        t('Resultados estables ante las mismas entradas', () => {
            const a = E.optimize(cal(), { S: 10, maxPeriods: 3, strategy: 'B' }), b = E.optimize(cal(), { S: 10, maxPeriods: 3, strategy: 'B' });
            return eq(a.recommendation.key + a.recA.key + a.recC.key, b.recommendation.key + b.recA.key + b.recC.key, 'claves');
        });
        t('Datos de API incompletos o desconocidos', () => {
            const r = E.normalizeHolidays([{ fecha: '2026-02-30', tipo: 'inamovible', nombre: 'x' }, { fecha: '2025-05-01', tipo: 'inamovible', nombre: 'y' }, { fecha: '2026-05-01', tipo: 'raro', nombre: 'z' }], 2026, 'prueba');
            return all(eq(r.items.length, 1, 'válidos'), eq(r.items[0].categoria, 'sin_clasificar', 'categoría'), eq(r.issues.length, 3, 'avisos'));
        });
        t('Respuesta que no es una lista', () => eq(E.normalizeHolidays(null, 2026, 'x').items.length, 0, 'ítems'));
        return results;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = runTests; else root.runTests = runTests;
})(typeof window !== 'undefined' ? window : globalThis);
