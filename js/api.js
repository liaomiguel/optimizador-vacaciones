/* Estirá tus Días — Servicio de Feriados y API ArgentinaDatos */
(function (root) {
    'use strict';

    const SNAPSHOT = {
        2026: {
            note: 'copia incluida en la app, armada con el calendario oficial 2026 (Ley 27.399 y Decreto 614/2025)',
            data: [
                { fecha: '2026-01-01', tipo: 'inamovible', nombre: 'Año Nuevo' },
                { fecha: '2026-02-16', tipo: 'inamovible', nombre: 'Carnaval' },
                { fecha: '2026-02-17', tipo: 'inamovible', nombre: 'Carnaval' },
                { fecha: '2026-03-23', tipo: 'puente', nombre: 'Día no laborable con fines turísticos' },
                { fecha: '2026-03-24', tipo: 'inamovible', nombre: 'Día Nacional de la Memoria por la Verdad y la Justicia' },
                { fecha: '2026-04-02', tipo: 'inamovible', nombre: 'Día del Veterano y de los Caídos en la Guerra de Malvinas' },
                { fecha: '2026-04-03', tipo: 'inamovible', nombre: 'Viernes Santo' },
                { fecha: '2026-05-01', tipo: 'inamovible', nombre: 'Día del Trabajador' },
                { fecha: '2026-05-25', tipo: 'inamovible', nombre: 'Día de la Revolución de Mayo' },
                { fecha: '2026-06-15', tipo: 'trasladable', nombre: 'Paso a la Inmortalidad del General Martín Miguel de Güemes' },
                { fecha: '2026-06-20', tipo: 'inamovible', nombre: 'Paso a la Inmortalidad del General Manuel Belgrano' },
                { fecha: '2026-07-09', tipo: 'inamovible', nombre: 'Día de la Independencia' },
                { fecha: '2026-07-10', tipo: 'puente', nombre: 'Día no laborable con fines turísticos' },
                { fecha: '2026-08-17', tipo: 'trasladable', nombre: 'Paso a la Inmortalidad del General José de San Martín' },
                { fecha: '2026-10-12', tipo: 'trasladable', nombre: 'Día del Respeto a la Diversidad Cultural' },
                { fecha: '2026-11-23', tipo: 'trasladable', nombre: 'Día de la Soberanía Nacional' },
                { fecha: '2026-12-07', tipo: 'puente', nombre: 'Día no laborable con fines turísticos' },
                { fecha: '2026-12-08', tipo: 'inamovible', nombre: 'Inmaculada Concepción de María' },
                { fecha: '2026-12-25', tipo: 'inamovible', nombre: 'Navidad' }
            ]
        }
    };

    const ArgentinaDatos = {
        id: 'argentinadatos',
        name: 'ArgentinaDatos',
        async fetchYear(year) {
            const ctrl = new AbortController();
            const tm = setTimeout(() => ctrl.abort(), 8000);
            try {
                const r = await fetch(`https://api.argentinadatos.com/v1/feriados/${year}`, { signal: ctrl.signal });
                if (r.status === 404 || r.status === 400) throw new Error(`el año ${year} todavía no está publicado en la API`);
                if (!r.ok) throw new Error(`la API respondió con error ${r.status}`);
                return await r.json();
            } catch (e) {
                if (e.name === 'AbortError') throw new Error('la API no respondió en 8 segundos');
                if (e instanceof TypeError) throw new Error('no hubo conexión con la API (puede estar bloqueada o sin internet)');
                throw e;
            } finally {
                clearTimeout(tm);
            }
        }
    };

    const CACHE_TTL = 7 * 86400000;

    function fixedPadding(year) {
        return [
            { id: `regla:${year - 1}-12-25`, fecha: `${year - 1}-12-25`, nombre: 'Navidad (año anterior)', tipoOriginal: null, categoria: 'nacional', fuente: 'regla fija (Ley 27.399)', origen: 'regla' },
            { id: `regla:${year + 1}-01-01`, fecha: `${year + 1}-01-01`, nombre: 'Año Nuevo (año siguiente)', tipoOriginal: null, categoria: 'nacional', fuente: 'regla fija (Ley 27.399)', origen: 'regla' }
        ];
    }

    const HolidaysService = {
        SNAPSHOT,
        ArgentinaDatos,
        CACHE_TTL,
        fixedPadding,

        async load(year, force, storage, engine) {
            const key = `etd:feriados:${year}`;
            const cached = storage.get(key, null);
            const fresh = cached && (Date.now() - cached.savedAt < CACHE_TTL);

            let raw = null, status, message = '', provisional = false, when = null;

            if (cached && fresh && !force) {
                raw = cached.raw;
                status = 'cache';
                when = cached.savedAt;
            } else {
                try {
                    raw = await ArgentinaDatos.fetchYear(year);
                    if (!Array.isArray(raw)) throw new Error('la respuesta no tiene el formato esperado');
                    storage.set(key, { raw, savedAt: Date.now(), source: ArgentinaDatos.id });
                    status = 'api';
                    when = Date.now();
                } catch (err) {
                    if (cached) {
                        raw = cached.raw;
                        status = 'stale';
                        when = cached.savedAt;
                        message = err.message;
                        provisional = true;
                    } else if (SNAPSHOT[year]) {
                        raw = SNAPSHOT[year].data;
                        status = 'snapshot';
                        message = err.message;
                    } else {
                        raw = [];
                        status = 'none';
                        message = err.message;
                        provisional = true;
                    }
                }
            }

            const src = status === 'snapshot' ? 'copia-local' : ArgentinaDatos.id;
            const norm = engine.normalizeHolidays(raw, year, src);
            const national = norm.items.filter(h => h.categoria === 'nacional' || h.categoria === 'trasladable').length;

            if (status !== 'none' && national < 12) {
                provisional = true;
                norm.issues.push(`Solo hay ${national} feriados nacionales para ${year}: el calendario podría estar incompleto.`);
            }
            if (norm.issues.length) {
                provisional = provisional || norm.issues.some(i => /incompleto|inválida/.test(i));
            }

            return {
                year,
                items: norm.items,
                issues: norm.issues,
                status,
                message,
                provisional,
                when
            };
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = HolidaysService;
    else root.HolidaysService = HolidaysService;
})(typeof window !== 'undefined' ? window : globalThis);
