/* Estirá tus Días — Lógica de Interfaz y Controlador de la Aplicación */
(function () {
    'use strict';

    const E = window.Engine;
    const HolidaysService = window.HolidaysService;
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const DC = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

    const now = new Date();
    const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const CUR_YEAR = now.getFullYear();
    const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

    const fmt = (iso, withDow) => {
        const d = E.parseISO(iso), dt = new Date(d);
        const y = dt.getUTCFullYear();
        const s = `${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()]}${y !== state.year ? ' ' + y : ''}`;
        return withDow ? `${DIAS[dt.getUTCDay()]} ${s}` : s;
    };

    const fmtShort = iso => {
        const dt = new Date(E.parseISO(iso));
        const y = dt.getUTCFullYear();
        const yrSuffix = y !== state.year ? `/${String(y).slice(-2)}` : '';
        return `${DC[dt.getUTCDay()]} ${dt.getUTCDate()}/${dt.getUTCMonth() + 1}${yrSuffix}`;
    };

    const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

    /* ---------- Persistencia Local ---------- */
    const LS = {
        get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
    };

    /* ---------- Gestión del Tema (Claro / Oscuro) ---------- */
    function initTheme() {
        const btn = $('#btn-theme-toggle');
        const saved = LS.get('etd:theme', 'auto');
        applyTheme(saved);

        if (btn) {
            btn.addEventListener('click', () => {
                const cur = document.documentElement.getAttribute('data-theme') || 'auto';
                let next;
                if (cur === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    next = prefersDark ? 'light' : 'dark';
                } else if (cur === 'dark') {
                    next = 'light';
                } else {
                    next = 'dark';
                }
                applyTheme(next);
                LS.set('etd:theme', next);
            });
        }
    }

    function applyTheme(theme) {
        const btn = $('#btn-theme-toggle');
        if (theme === 'auto') {
            document.documentElement.removeAttribute('data-theme');
            if (btn) btn.innerHTML = '<span class="material-icons-outlined" aria-hidden="true">brightness_medium</span>';
            if (btn) btn.setAttribute('title', 'Tema automático del sistema (click para cambiar)');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
            if (btn) btn.innerHTML = theme === 'dark' 
                ? '<span class="material-icons-outlined" aria-hidden="true">dark_mode</span>' 
                : '<span class="material-icons-outlined" aria-hidden="true">light_mode</span>';
            if (btn) btn.setAttribute('title', `Tema ${theme === 'dark' ? 'oscuro' : 'claro'} (click para alternar)`);
        }
    }

    /* ---------- Estado Inicial ---------- */
    const DEFAULTS = {
        year: CUR_YEAR,
        S: 14,
        deadline: `${CUR_YEAR + 1}-05-31`,
        regime: 'corridos',
        costRules: Object.assign({}, E.REGIMES.corridos),
        workdays: [false, true, true, true, true, true, false],
        applyCats: {
            nacional: true,
            trasladable: true,
            turistico: true,
            no_laborable: false,
            provincial: true,
            municipal: true,
            personal: true,
            sin_clasificar: false
        },
        rangeStart: '',
        rangeEnd: '',
        minLen: 1,
        maxLen: 0,
        maxPeriods: 3,
        minSep: 0,
        preference: 'none',
        strategy: 'A',
        avoid: [],
        prefer: []
    };

    let state = Object.assign({}, JSON.parse(JSON.stringify(DEFAULTS)), LS.get('etd:config', {}));
    if (!state.deadline) state.deadline = `${state.year + 1}-05-31`;

    let personalAll = LS.get('etd:personal', {});
    const personal = (y = state.year) => (personalAll[y] = personalAll[y] || { hidden: [], added: [] });
    function save() {
        LS.set('etd:config', state);
        LS.set('etd:personal', personalAll);
    }

    /* ---------- Configuración Efectiva y Validación ---------- */
    function effective() {
        const y = state.year;
        const dl = state.deadline || `${y + 1}-05-31`;
        let rs = state.rangeStart || (y === CUR_YEAR ? TODAY : `${y}-01-01`);
        let re = state.rangeEnd || dl;
        if (re < rs) re = dl;
        return {
            year: y,
            deadline: dl,
            workdays: state.workdays,
            applyCats: state.applyCats,
            costRules: state.costRules,
            rangeStart: rs,
            rangeEnd: re,
            avoid: state.avoid,
            prefer: state.prefer,
            pad: 16
        };
    }

    function getActiveYears() {
        const cfg = effective();
        const sY = Number(cfg.rangeStart.slice(0, 4)) || state.year;
        const eY = Number(cfg.rangeEnd.slice(0, 4)) || (state.year + 1);
        const start = Math.min(state.year, sY);
        const end = Math.max(state.year + 1, eY);
        const years = [];
        for (let y = start; y <= end; y++) years.push(y);
        return years;
    }

    function validate(cfg) {
        const errs = [];
        if (!(state.S >= 0)) errs.push('Ingresá una cantidad de días disponibles válida.');
        if (cfg.rangeStart > cfg.rangeEnd) errs.push('La fecha «Desde» es posterior a «Hasta».');
        if (state.maxLen && state.minLen > state.maxLen) errs.push('El mínimo de días por período es mayor que el máximo.');
        if (!state.workdays.some(Boolean)) errs.push('Marcá al menos un día de trabajo en «Tu semana de trabajo».');
        if (state.preference === 'many' && state.maxPeriods < 2) errs.push('Elegiste «Dos o más períodos» pero el máximo de períodos es 1.');
        if (state.S > 60) errs.push('El saldo máximo admitido es 60 días.');
        return errs;
    }

    /* ---------- Servicio de Feriados Multianual ---------- */
    let holidayData = { year: null, years: [], items: [], issues: [], status: 'loading', message: '', provisional: true };

    async function loadHolidaysForRange(force = false) {
        const years = getActiveYears();
        holidayData = {
            year: state.year,
            years,
            items: [],
            issues: [],
            status: 'loading',
            message: `Consultando feriados de ${years.join(' y ')}…`,
            provisional: true
        };
        renderSourceStatus();
        holidayData = await HolidaysService.loadYears(years, force, LS, E);
        renderSourceStatus();
        renderHolidays();
        schedule();
    }

    const allHolidays = () => {
        const years = getActiveYears();
        let visible = holidayData.items || [];
        for (const y of years) {
            visible = E.mergeHolidays(visible, personal(y));
        }
        return visible.concat(HolidaysService.fixedPadding(years[0], years[years.length - 1]));
    };

    /* ---------- Inicialización de Controles ---------- */
    function initControls() {
        const ys = $('#f-year');
        if (ys) {
            for (let y = CUR_YEAR - 1; y <= CUR_YEAR + 1; y++) {
                ys.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
            }
        }

        const cats = Object.entries(E.CATEGORIES).filter(([k]) => k !== 'sin_clasificar');
        const addCat = $('#add-cat');
        if (addCat) {
            addCat.innerHTML = cats.map(([k, v]) => `<option value="${k}" ${k === 'personal' ? 'selected' : ''}>${v.label}</option>`).join('');
        }

        const bindNum = (sel, key, min, max) => {
            const el = $(sel);
            if (!el) return;
            el.addEventListener('change', e => {
                let v = parseInt(e.target.value, 10);
                if (isNaN(v)) v = DEFAULTS[key];
                v = Math.max(min, Math.min(max, v));
                e.target.value = v;
                state[key] = v;
                changed();
            });
        };

        if (ys) {
            ys.addEventListener('change', e => {
                state.year = +e.target.value;
                state.deadline = `${state.year + 1}-05-31`;
                state.rangeStart = '';
                state.rangeEnd = state.deadline;
                changed(false);
                loadHolidaysForRange();
                syncControls();
            });
        }

        bindNum('#f-S', 'S', 0, 60);
        bindNum('#f-min', 'minLen', 1, 120);
        bindNum('#f-max', 'maxLen', 0, 120);
        bindNum('#f-K', 'maxPeriods', 1, 5);
        bindNum('#f-sep', 'minSep', 0, 120);

        $('#f-deadline')?.addEventListener('change', e => {
            state.deadline = e.target.value;
            state.rangeEnd = e.target.value;
            if ($('#f-re')) $('#f-re').value = state.rangeEnd;
            changed(false);
            loadHolidaysForRange();
            syncControls();
        });

        $('#f-rs')?.addEventListener('change', e => {
            state.rangeStart = e.target.value;
            changed(false);
            loadHolidaysForRange();
            syncControls();
        });

        $('#f-re')?.addEventListener('change', e => {
            state.rangeEnd = e.target.value;
            changed(false);
            loadHolidaysForRange();
            syncControls();
        });

        $('#f-pref')?.addEventListener('change', e => { state.preference = e.target.value; changed(); });

        $$('input[name=regime]').forEach(r => r.addEventListener('change', e => {
            state.regime = e.target.value;
            if (E.REGIMES[state.regime]) state.costRules = Object.assign({}, E.REGIMES[state.regime]);
            renderCostRules();
            changed();
        }));

        $$('input[name=strategy]').forEach(r => r.addEventListener('change', e => {
            state.strategy = e.target.value;
            preview = null;
            changed();
        }));

        const addDate = (inp, key) => {
            const v = $(inp).value;
            if (v && !state[key].includes(v)) {
                state[key].push(v);
                state[key].sort();
                renderChips();
                changed();
            }
            $(inp).value = '';
        };

        $('#btn-avoid')?.addEventListener('click', () => addDate('#f-avoid', 'avoid'));
        $('#btn-prefer')?.addEventListener('click', () => addDate('#f-prefer', 'prefer'));

        $('#btn-add')?.addEventListener('click', () => {
            const f = $('#add-date').value, n = $('#add-name').value.trim(), c = $('#add-cat').value;
            if (!E.isValidISO(f)) { $('#add-date').focus(); return; }
            const y = Number(f.slice(0, 4));
            personal(y).added.push({ id: 'u:' + Date.now(), fecha: f, nombre: n || E.CATEGORIES[c].label, categoria: c });
            $('#add-name').value = '';
            renderHolidays();
            changed();
        });

        $('#btn-refetch')?.addEventListener('click', () => loadHolidaysForRange(true));
        $('#btn-reset')?.addEventListener('click', () => {
            const y = state.year;
            state = JSON.parse(JSON.stringify(DEFAULTS));
            state.year = y;
            state.deadline = `${y + 1}-05-31`;
            syncControls();
            loadHolidaysForRange();
            changed();
        });

        $('#btn-tests')?.addEventListener('click', runTestsUI);

        const wd = $('#workdays');
        if (wd) {
            wd.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(i => `<button type="button" data-d="${i}" aria-label="${DIAS[i]}">${DC[i]}</button>`).join('');
            wd.addEventListener('click', e => {
                const b = e.target.closest('button');
                if (!b) return;
                const i = +b.dataset.d;
                state.workdays[i] = !state.workdays[i];
                syncControls();
                changed();
            });
        }

        const configDetails = $$('aside.config details.sec');
        configDetails.forEach(det => {
            det.addEventListener('toggle', () => {
                if (det.open) {
                    configDetails.forEach(other => {
                        if (other !== det && other.open) other.open = false;
                    });
                }
            });
        });

        $('#btn-toggle-config')?.addEventListener('click', () => {
            const configAside = $('aside.config');
            if (configAside) {
                configAside.scrollIntoView({ behavior: 'smooth' });
                const firstDetails = configAside.querySelector('details');
                if (firstDetails) {
                    firstDetails.open = true;
                    configDetails.forEach(other => {
                        if (other !== firstDetails && other.open) other.open = false;
                    });
                }
            }
        });
    }

    function syncControls() {
        if ($('#f-year')) $('#f-year').value = state.year;
        if ($('#f-S')) $('#f-S').value = state.S;
        if ($('#f-min')) $('#f-min').value = state.minLen;
        if ($('#f-max')) $('#f-max').value = state.maxLen;
        if ($('#f-K')) $('#f-K').value = state.maxPeriods;
        if ($('#f-sep')) $('#f-sep').value = state.minSep;
        if ($('#f-pref')) $('#f-pref').value = state.preference;

        const cfg = effective();
        if ($('#f-deadline')) $('#f-deadline').value = cfg.deadline;
        if ($('#f-rs')) $('#f-rs').value = cfg.rangeStart;
        if ($('#f-re')) $('#f-re').value = cfg.rangeEnd;

        const minD = `${state.year}-01-01`;
        const maxD = `${state.year + 2}-12-31`;
        ['#f-rs', '#f-re', '#f-deadline', '#f-avoid', '#f-prefer', '#add-date'].forEach(s => {
            const el = $(s);
            if (el) {
                el.min = minD;
                el.max = maxD;
            }
        });

        $$('input[name=regime]').forEach(r => { r.checked = r.value === state.regime; });
        $$('input[name=strategy]').forEach(r => { r.checked = r.value === state.strategy; });

        $$('#workdays button').forEach(b => {
            b.setAttribute('aria-pressed', String(!!state.workdays[+b.dataset.d]));
        });

        renderCostRules();
        renderChips();
        renderHolidays();
    }

    function renderCostRules() {
        const el = $('#cost-rules');
        if (!el) return;
        el.innerHTML = Object.entries(E.COST_CATS).map(([k, lbl]) =>
            `<label class="chk"><input type="checkbox" data-rule="${k}" ${state.costRules[k] ? 'checked' : ''}><span>${lbl}</span></label>`
        ).join('');

        el.querySelectorAll('input').forEach(i => i.addEventListener('change', e => {
            state.costRules[e.target.dataset.rule] = e.target.checked;
            const match = Object.keys(E.REGIMES).find(r => Object.keys(E.COST_CATS).every(k => E.REGIMES[r][k] === state.costRules[k]));
            state.regime = match || 'custom';
            $$('input[name=regime]').forEach(r => { r.checked = r.value === state.regime; });
            changed();
        }));
    }

    function renderChips() {
        ['avoid', 'prefer'].forEach(key => {
            const el = $(`#${key}-chips`);
            if (!el) return;
            el.innerHTML = state[key].map(d =>
                `<span class="chip">${fmtShort(d)}<button type="button" data-k="${key}" data-d="${d}" aria-label="Quitar ${fmt(d)}"><span class="material-icons-outlined" aria-hidden="true" style="font-size:14px">close</span></button></span>`
            ).join('');
        });

        $$('.chips button').forEach(b => b.onclick = () => {
            state[b.dataset.k] = state[b.dataset.k].filter(x => x !== b.dataset.d);
            renderChips();
            changed();
        });
    }

    function renderSourceStatus() {
        const h = holidayData, el = $('#src-status');
        if (!el) return;
        const yearsStr = h.years && h.years.length ? h.years.join(' y ') : state.year;
        const when = h.when ? new Date(h.when).toLocaleDateString('es-AR') : '';
        const msg = {
            loading: `Consultando feriados de ${yearsStr} en ArgentinaDatos…`,
            api: `Feriados de ${yearsStr} descargados de ArgentinaDatos.`,
            cache: `Feriados de ${yearsStr} guardados en caché local (se renuevan cada 7 días).`,
            stale: `No se pudo actualizar ArgentinaDatos (${h.message}). Se usan los últimos datos guardados el ${when}.`,
            snapshot: `Se utiliza el calendario oficial de contingencia para ${yearsStr}.`,
            none: `Sin feriados para ${yearsStr}: ${h.message}. Cálculos basados en semana laboral y fechas propias.`
        }[h.status] || h.message || '';

        const cls = h.status === 'none' ? 'err' : (h.status === 'stale' || h.status === 'snapshot' || h.provisional) ? 'warn' : 'ok';
        el.innerHTML = `<div class="notice ${cls}">${esc(msg)}${h.issues && h.issues.length ? '<br>' + h.issues.map(esc).join('<br>') : ''}</div>`;
    }

    function renderHolidays() {
        const years = getActiveYears();
        let visible = holidayData.items || [];
        for (const y of years) {
            visible = E.mergeHolidays(visible, personal(y));
        }
        visible.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

        const counts = {};
        visible.forEach(h => { counts[h.categoria] = (counts[h.categoria] || 0) + 1; });

        const catList = $('#cat-list');
        if (catList) {
            catList.innerHTML = Object.entries(E.CATEGORIES).map(([k, v]) => {
                const n = counts[k] || 0, dis = n === 0;
                return `<label class="chk ${dis ? 'disabled' : ''}"><input type="checkbox" data-cat="${k}" ${state.applyCats[k] ? 'checked' : ''} ${dis ? 'disabled' : ''}>
          <span>${v.label} <span class="count">(${dis ? (k === 'provincial' || k === 'municipal' || k === 'personal' ? 'se habilita al cargar una fecha' : 'sin fechas') : plural(n, 'fecha', 'fechas')})</span></span></label>`;
            }).join('');

            catList.querySelectorAll('input').forEach(i => i.addEventListener('change', e => {
                state.applyCats[e.target.dataset.cat] = e.target.checked;
                changed();
                renderHolidays();
            }));
        }

        const opts = sel => Object.entries(E.CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.label}</option>`).join('');
        const rows = visible.map(h => {
            const manual = h.origen === 'manual';
            return `<tr>
              <td class="hol-date"><span class="material-icons-outlined" aria-hidden="true" style="font-size:16px">event</span> <span>${fmtShort(h.fecha)}</span></td>
              <td class="hol-info"><b>${esc(h.nombre)}</b><span class="count">${manual ? 'Cargada por vos' : `${esc(h.fuente)}${h.tipoOriginal ? ' · tipo «' + esc(h.tipoOriginal) + '»' : ''}`}</span></td>
              <td class="hol-cat"><select data-id="${esc(h.id)}" aria-label="Categoría de ${esc(h.nombre)}">${opts(h.categoria)}</select></td>
              <td class="hol-actions"><button class="btn ghost sm danger" type="button" data-del="${esc(h.id)}" aria-label="${manual ? 'Eliminar' : 'Quitar'} ${esc(h.nombre)}" title="${manual ? 'Eliminar fecha' : 'Quitar fecha'}"><span class="material-icons-outlined" aria-hidden="true" style="font-size:15px">delete_outline</span> <span>${manual ? 'Eliminar' : 'Quitar'}</span></button></td>
            </tr>`;
        }).join('');

        const tableBody = $('#hol-table tbody');
        if (tableBody) {
            tableBody.innerHTML = rows || `<tr><td colspan="4" style="text-align:center;padding:12px;color:var(--ink-muted)">No hay fechas cargadas en este horizonte de fechas.</td></tr>`;
        }

        const holTable = $('#hol-table');
        if (holTable) {
            holTable.querySelectorAll('select').forEach(s => s.addEventListener('change', e => reclassify(e.target.dataset.id, e.target.value)));
            holTable.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeHoliday(b.dataset.del)));
        }

        let totalHidden = 0;
        for (const y of years) totalHidden += (personal(y).hidden || []).length;
        const hiddenNote = $('#hidden-note');
        if (hiddenNote) {
            hiddenNote.innerHTML = totalHidden ? `${plural(totalHidden, 'fecha importada quitada', 'fechas importadas quitadas')}. <button class="btn ghost sm" type="button" id="btn-restore">Restaurar todas</button>` : '';
            const br = $('#btn-restore');
            if (br) br.onclick = () => {
                for (const y of years) personal(y).hidden = [];
                renderHolidays();
                changed();
            };
        }
    }

    function reclassify(id, cat) {
        const years = getActiveYears();
        for (const y of years) {
            const p = personal(y);
            const own = p.added.find(h => h.id === id);
            if (own) { own.categoria = cat; renderHolidays(); changed(); return; }
        }
        const h = (holidayData.items || []).find(x => x.id === id);
        if (!h) return;
        const yr = Number(h.fecha.slice(0, 4));
        const p = personal(yr);
        p.hidden.push(id);
        p.added.push({ id: 'u:' + Date.now(), fecha: h.fecha, nombre: h.nombre, categoria: cat, basadoEn: id });
        if (!state.applyCats[cat] && cat !== 'sin_clasificar') state.applyCats[cat] = true;
        renderHolidays();
        changed();
    }

    function removeHoliday(id) {
        const years = getActiveYears();
        for (const y of years) {
            const p = personal(y);
            const own = p.added.find(h => h.id === id);
            if (own) {
                p.added = p.added.filter(h => h.id !== id);
                if (own.basadoEn) p.hidden = p.hidden.filter(x => x !== own.basadoEn);
                renderHolidays();
                changed();
                return;
            }
        }
        const h = (holidayData.items || []).find(x => x.id === id);
        if (h) {
            const yr = Number(h.fecha.slice(0, 4));
            personal(yr).hidden.push(id);
            renderHolidays();
            changed();
        }
    }

    /* ---------- Motor y Programación de Cálculo ---------- */
    let timer = null, cal = null, res = null, preview = null;
    function changed(recalc = true) {
        save();
        if (recalc) schedule();
    }
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(compute, 100);
    }

    function compute() {
        const cfg = effective(), errs = validate(cfg);
        syncRangeInputs(cfg);
        if (holidayData.status === 'loading') return;
        if (errs.length) {
            $('#notices').innerHTML = errs.map(e => `<div class="notice err">${esc(e)}</div>`).join('');
            $('#hero').innerHTML = '';
            $('#compare').innerHTML = '';
            $('#alts').innerHTML = '';
            renderCalendar(null);
            return;
        }
        preview = null;
        cal = E.buildCalendar(cfg, allHolidays());
        res = E.optimize(cal, {
            S: state.S,
            minLen: state.minLen,
            maxLen: state.maxLen,
            maxPeriods: state.maxPeriods,
            minSep: state.minSep,
            preference: state.preference,
            strategy: state.strategy
        });
        render();
    }

    function syncRangeInputs(cfg) {
        if (document.activeElement !== $('#f-rs') && $('#f-rs')) $('#f-rs').value = cfg.rangeStart;
        if (document.activeElement !== $('#f-re') && $('#f-re')) $('#f-re').value = cfg.rangeEnd;
        if (document.activeElement !== $('#f-deadline') && $('#f-deadline')) $('#f-deadline').value = cfg.deadline;
    }

    /* ---------- Explicaciones y Formato Textual ---------- */
    const STRAT = { A: 'Máximo descanso', B: 'Máximo rendimiento', C: 'Descanso distribuido' };
    function rangeText(a, b) { return a === b ? fmt(a, true) : `${fmt(a, true)} al ${fmt(b, true)}`; }
    function whyFree(from, to) {
        const r = new Set();
        for (let i = from; i <= to; i++) {
            const d = cal.days[i];
            if (d.holidayApplies) r.add(d.applying[0].nombre);
            else if (d.isWeekend) r.add('fin de semana');
            else r.add('día que no trabajás');
        }
        return [...r].join(', ');
    }
    function periodLine(p) {
        return `Vacaciones del ${rangeText(p.start, p.end)}: ${plural(p.cost, 'día descontado', 'días descontados')}, ${p.blockLen} días libres seguidos (${fmtShort(p.blockStart)} a ${fmtShort(p.blockEnd)}).`;
    }
    function gainText(plan) { return plan.cost === 0 ? 'sin consumo de saldo' : `${nf.format(plan.gainRatio)} días por día`; }

    function explain(plan, strat) {
        const out = [];
        if (strat === 'A') out.push(`Es el descanso seguido más largo que se puede armar con tus ${state.S} días y tus reglas: ${plan.M} días sin trabajar.`);
        if (strat === 'B') out.push(`Es la opción que más descanso nuevo te da por cada día descontado: ${gainText(plan)}. No cuenta como ganancia el descanso que ya tenías (por ejemplo, fines de semana).`);
        if (strat === 'C') out.push(`Reparte el saldo en ${plural(plan.k, 'bloque', 'bloques')} de descanso y suma ${plan.D} días libres en total${plan.k > 1 ? `, con al menos ${plural(plan.minGap, 'día', 'días')} de trabajo entre bloques` : ''}.`);
        plan.periods.forEach(p => {
            const bits = [];
            if (p.bs < p.si) bits.push(`empieza el ${fmt(p.blockStart, true)}, antes de tus vacaciones, por ${whyFree(p.bs, p.si - 1)}`);
            if (p.be > p.ei) bits.push(`termina el ${fmt(p.blockEnd, true)} gracias a ${whyFree(p.ei + 1, p.be)}`);
            if (bits.length) out.push(`El descanso del ${fmtShort(p.start)} ${bits.join(' y ')}.`);
        });
        if (plan.holidays.length) out.push(`Aprovecha ${plan.holidays.map(h => `${h.nombre} (${fmtShort(h.fecha)})`).join(', ')}.`);
        out.push(plan.R > 0 ? `Te ${plan.R === 1 ? 'queda 1 día' : `quedan ${plan.R} días`} de saldo.` : 'Usa todo tu saldo disponible.');
        if (plan.periods.some(p => p.touchesEdge)) out.push('Uno de los bloques llega al borde del período analizado y podría estirarse un poco más con fechas vecinas.');
        return out;
    }

    function metricsHTML(plan) {
        const m = [
            [plan.cost, 'Días descontados (V)'],
            [plan.R, 'Saldo restante (R)'],
            [plan.D, 'Descanso total (D)'],
            [plan.M, 'Bloque más largo (M)'],
            [plan.cost ? nf.format(plan.ratio) : '—', plan.cost ? 'Días libres por día (D/V)' : 'Sin consumo'],
            [plan.cost ? nf.format(plan.gainRatio) : '—', 'Días extra nuevos por día']
        ];
        return `<div class="metrics">${m.map(([v, k]) => `<div class="metric"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</div>`;
    }

    function stripHTML(plan) {
        return plan.periods.map(p => {
            let html = '';
            for (let i = p.bs; i <= p.be; i++) {
                const d = cal.days[i], vac = i >= p.si && i <= p.ei, dt = new Date(E.parseISO(d.date));
                const cls = vac ? (d.consumes_vacation_balance ? 'vac' : 'vac0') : '';
                const lab = dayLabel(d, vac, true);
                const yrLabel = dt.getUTCFullYear() !== state.year ? `'${String(dt.getUTCFullYear()).slice(-2)}` : '';
                html += `<div class="d ${cls} ${d.holidayApplies ? 'hol' : ''}" role="listitem" aria-label="${esc(fmt(d.date, true) + ': ' + lab)}" title="${esc(lab)}"><span class="w">${DC[d.dow]}</span><span class="n">${dt.getUTCDate()}</span><span class="m">${MESES[dt.getUTCMonth()].slice(0, 3)} ${yrLabel}</span></div>`;
            }
            return `<div class="strip-container"><p class="strip-label">${esc(periodLine(p))}</p><div class="strip" role="list">${html}</div></div>`;
        }).join('');
    }

    function headline(plan) {
        if (plan.k === 1) return `Pedí ${plural(plan.cost, 'día', 'días')}, descansá ${plan.M} seguidos.`;
        return `Pedí ${plural(plan.cost, 'día', 'días')}, descansá ${plan.D} en ${plan.k} bloques.`;
    }

    function detailHTML(plan) {
        const rows = E.planDays(cal, plan).map(r => {
            const d = r.day;
            const rule = r.vacation ? `${E.COST_CATS[d.costCat]}: ${state.costRules[d.costCat] ? 'descuenta' : 'no descuenta'}` : 'Fuera de tus vacaciones: ya era libre';
            return `<tr><td><b>${fmtShort(d.date)}</b></td><td>${esc(dayLabel(d, r.vacation, true))}</td><td><span class="tag-s ${r.consumes ? 'yes' : ''}">${r.consumes ? 'Descuenta' : 'No descuenta'}</span></td><td>${esc(rule)}</td></tr>`;
        }).join('');
        const blocks = plan.periods.map((p, i) => `<li><b>Bloque ${i + 1}:</b> ${fmtShort(p.blockStart)} a ${fmtShort(p.blockEnd)} = ${p.blockLen} días. Descontados: ${p.cost}. Descanso previo: ${p.baseMax}. Descanso nuevo: ${p.gain}.</li>`).join('');
        const ign = cal.days.filter(d => d.inYear && d.isHoliday && !d.holidayApplies);
        const st = res.stats;
        return `<details class="detail"><summary>Ver desglose y cómo se calculó</summary>
        <h4>Bloques de descanso</h4><ul>${blocks}</ul>
        <p class="hint">D suma únicamente los días de los bloques conectados a tus vacaciones (cada fecha una vez). Saldo restante: ${state.S} − ${plan.cost} = ${plan.R}.</p>
        <h4>Día por día</h4><div class="tscroll"><table><thead><tr><th>Fecha</th><th>Situación</th><th>Saldo</th><th>Regla aplicada</th></tr></thead><tbody>${rows}</tbody></table></div>
        <h4>Reglas en uso</h4><ul>${Object.entries(E.COST_CATS).map(([k, l]) => `<li>${l}: ${state.costRules[k] ? 'descuenta' : 'no descuenta'}</li>`).join('')}</ul>
        ${ign.length ? `<p class="hint">Fechas no consideradas como libres: ${ign.map(d => `${d.holidays[0].nombre} (${fmtShort(d.date)})`).map(esc).join(', ')}.</p>` : ''}
        <h4>Opciones evaluadas</h4>
        <p class="hint">Se evaluaron ${st.evaluated.toLocaleString('es-AR')} períodos posibles dentro de ${fmtShort(effective().rangeStart)} a ${fmtShort(effective().rangeEnd)}; quedaron ${res.candidateCount.toLocaleString('es-AR')} opciones viables evaluadas entre ${getActiveYears().join(' y ')}.</p>
      </details>`;
    }

    function dayLabel(d, vac, showExt) {
        let s;
        if (vac) s = d.consumes_vacation_balance ? 'Vacaciones, descuenta saldo' : 'Vacaciones, no descuenta saldo';
        else if (d.holidayApplies) s = `${E.CATEGORIES[d.applying[0].categoria].group === 'feriado' ? 'Feriado' : 'No laborable'}: ${d.applying[0].nombre}`;
        else if (!d.isWorkdayHabitual) s = d.isWeekend ? 'Fin de semana' : 'Día que no trabajás';
        else s = 'Día laborable';
        if (vac && d.holidayApplies) s += ` (${d.applying[0].nombre})`;
        if (!d.holidayApplies && d.isHoliday) s += ` · ${d.holidays[0].nombre} (no considerado)`;
        if (showExt && !vac && d.is_non_working_day) s += ', suma a tu descanso';
        return s;
    }

    /* ---------- Renderizado de Vistas ---------- */
    function render() {
        const notes = [];
        if (holidayData.provisional) notes.push(`<div class="notice warn">Resultado provisional: el calendario de feriados está incompleto o no se pudo verificar con certeza. Revisá «Feriados y días no laborables».</div>`);
        $('#notices').innerHTML = notes.join('');

        if (res.empty) {
            renderEmpty();
            renderCalendar(null);
            return;
        }

        const plan = res.recommendation;
        const shown = preview || plan;
        const hero = $('#hero');
        const cfgE = effective();
        hero.innerHTML = `<div class="hero flash">
        <h2>${esc(headline(plan))}</h2>
        <p class="sub">Prioridad: <b>${STRAT[state.strategy]}</b>${state.preference !== 'none' ? (state.preference === 'one' ? ' (período único)' : ' (múltiples períodos)') : ''}. Período: <b>${fmtShort(cfgE.rangeStart)} al ${fmtShort(cfgE.rangeEnd)}</b> (vence ${fmtShort(cfgE.deadline)}). Modalidad: <b>${state.regime === 'corridos' ? 'Días corridos' : state.regime === 'habiles' ? 'Días hábiles' : 'Personalizada'}</b>. Saldo disponible: <b>${state.S} días</b>.</p>
        ${stripHTML(plan)}
        ${metricsHTML(plan)}
        <div class="why">${explain(plan, state.strategy).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        ${complementHTML(plan)}
        ${detailHTML(plan)}
      </div>`;

        const cb = $('#btn-comp');
        if (cb) cb.onclick = () => {
            preview = res.recA.k > 1 ? res.recA : E.makePlan(res.recA.periods.concat(res.complementA.periods), state.S);
            renderCalendar(preview);
            document.getElementById('cal-h')?.scrollIntoView({ behavior: 'smooth' });
        };

        renderCompare(plan);
        renderAlts(plan);
        renderCalendar(shown);
    }

    function complementHTML(plan) {
        if (state.strategy !== 'A' || !res.complementA || plan.k > 1 || state.preference === 'one') return '';
        const c = res.complementA;
        return `<div class="verdict"><p style="margin:0 0 8px"><b>Con los ${plan.R} días de saldo que te sobran</b> podés sumar ${c.k === 1 ? 'otro bloque' : `otros ${c.k} bloques`} adicionales: ${c.periods.map(p => `${fmtShort(p.start)}${p.end !== p.start ? '–' + fmtShort(p.end) : ''} (${p.blockLen} días libres por ${p.cost})`).join('; ')}. Sumarías <b>${plan.D + c.D} días libres en total</b>.</p>
        <button class="btn ghost sm" type="button" id="btn-comp"><span class="material-icons-outlined" aria-hidden="true" style="font-size:16px">calendar_month</span> Ver plan completo en el calendario</button></div>`;
    }

    function optCard(title, plan, note) {
        if (!plan) return `<div class="opt"><h4>${title}</h4><p class="same">${note || 'No hay una opción válida con estas restricciones.'}</p></div>`;
        const active = plan.key === (preview || res.recommendation).key;
        return `<div class="opt ${active ? 'active' : ''}">
        <h4>${title}</h4>
        <div class="dates">${plan.periods.map(p => esc(`${fmtShort(p.start)}${p.end !== p.start ? ' a ' + fmtShort(p.end) : ''}`)).join('<br>')}</div>
        <dl>
            <dt>Descontados</dt><dd>${plan.cost}</dd>
            <dt>Saldo restante</dt><dd>${plan.R}</dd>
            <dt>Descanso total</dt><dd>${plan.D}</dd>
            <dt>Bloque más largo</dt><dd>${plan.M}</dd>
            <dt>Días libres / día</dt><dd>${plan.cost ? nf.format(plan.ratio) : '—'}</dd>
            <dt>Días extra nuevos / día</dt><dd>${plan.cost ? nf.format(plan.gainRatio) : '—'}</dd>
            <dt>Feriados aprovechados</dt><dd>${plan.holidays.length}</dd>
        </dl>
        ${note ? `<p class="same">${note}</p>` : ''}
        <button class="btn ghost sm" type="button" data-plan="${esc(plan.key)}">${active ? '<span class="material-icons-outlined" aria-hidden="true" style="font-size:16px">check</span> En el calendario' : 'Ver en el calendario'}</button>
      </div>`;
    }

    let planIndex = new Map();
    function renderCompare(rec) {
        planIndex = new Map();
        const single = state.strategy === 'B' ? res.singleB[0] : res.singleA[0];
        const items = [
            ['Mejor período único', state.preference === 'many' ? null : single, state.preference === 'many' ? 'Excluido por preferencia de varios períodos.' : ''],
            ['Mejor combinación de varios', state.preference === 'one' ? null : res.multiBest, state.preference === 'one' ? 'Excluido por preferencia de un solo período.' : (state.maxPeriods < 2 ? 'Aumentá el máximo de períodos a 2 o más.' : '')],
            ['Mejor rendimiento', res.recB, ''],
            ['Máximo descanso seguido', res.recA.k === 1 ? res.recA : res.singleA[0], '']
        ];
        items.forEach(([, p]) => { if (p) planIndex.set(p.key, p); });
        const seen = new Map();
        const cards = items.map(([t, p, n]) => {
            let note = n;
            if (p && seen.has(p.key)) note = `Es la misma opción que «${seen.get(p.key)}».`;
            if (p && !seen.has(p.key)) seen.set(p.key, t);
            return optCard(t, p, note);
        }).join('');

        $('#compare').innerHTML = `<h3 class="h">Comparar alternativas</h3><div class="cmp">${cards}</div>${verdictHTML()}`;
        $('#compare').querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
            preview = planIndex.get(b.dataset.plan);
            renderCompare(rec);
            renderCalendar(preview);
        });
    }

    function verdictHTML() {
        const one = res.singleA[0], many = res.multiBest;
        if (!many || state.preference !== 'none') return '';
        let txt;
        if (state.strategy === 'A') txt = `Si buscás el descanso seguido más largo, conviene concentrar: un solo período te da ${one.M} días seguidos, mientras que dividir en ${many.k} baja el bloque más largo a ${many.M}.`;
        else if (state.strategy === 'C') txt = many.D > one.D ? `Dividir rinde más descanso total: ${many.k} períodos suman ${many.D} días contra ${one.D} de uno único, a cambio de que el bloque más largo sea de ${many.M} días en vez de ${one.M}.` : `Concentrar no pierde descanso total: un período único te da ${one.D} días y dividir no lo supera.`;
        else {
            const sb = res.singleB[0], mb = res.multiBestB;
            txt = mb && E.cmp.B(mb, sb) < 0 ? `Dividir rinde más por día descontado: ${gainText(mb)} contra ${gainText(sb)} del mejor período único.` : `El mejor rendimiento se logra con un solo período (${gainText(sb)}); dividir no lo mejora.`;
        }
        return `<p class="verdict">${esc(txt)}</p>`;
    }

    function renderAlts(rec) {
        let list, title;
        if (state.strategy === 'C') {
            list = res.multiByK.slice();
            if (state.preference !== 'many') list.unshift(res.singleA[0]);
            title = 'Según la cantidad de períodos';
        } else {
            const src = state.strategy === 'B' ? res.singleB : res.singleA;
            list = src.filter(p => p.key !== rec.key).slice(0, 5);
            title = 'Otras opciones destacadas';
        }
        list = list.filter(p => p && (state.preference !== 'one' || p.k === 1));
        if (!list.length) { $('#alts').innerHTML = ''; return; }
        list.forEach(p => planIndex.set(p.key, p));
        $('#alts').innerHTML = `<h3 class="h">${title}</h3><ul class="alts">${list.map(p => `<li><div><b>${p.periods.map(x => esc(`${fmtShort(x.start)}${x.end !== x.start ? ' a ' + fmtShort(x.end) : ''}`)).join(' + ')}</b>
        <div class="meta">${plural(p.k, 'período', 'períodos')}: ${plural(p.cost, 'día descontado', 'días descontados')}, ${p.D} de descanso, bloque más largo ${p.M}, ${gainText(p)} de descanso nuevo</div></div>
        <button class="btn ghost sm" type="button" data-plan="${esc(p.key)}">Ver</button></li>`).join('')}</ul>`;
        $('#alts').querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
            preview = planIndex.get(b.dataset.plan);
            renderCompare(rec);
            renderCalendar(preview);
            document.getElementById('cal-h')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    function renderEmpty() {
        const st = res.stats || {};
        let msg;
        if (res.empty === 'saldo') msg = 'Con saldo 0 no hay vacaciones para planificar. El calendario muestra igual tus días libres del año.';
        else if (res.empty === 'conflicto') msg = res.notes.join(' ');
        else {
            const why = [];
            if (st.overBalance) why.push('el saldo no alcanza para cumplir el mínimo de días por período');
            if (st.excluded) why.push('las fechas a evitar cortan los períodos posibles');
            if (st.noGain) why.push('en el rango elegido no hay días de trabajo que liberar');
            msg = `No hay ningún período que cumpla todas las condiciones${why.length ? ': ' + why.join('; ') : ''}. Probá ampliar el rango de fechas, bajar el mínimo de días o quitar fechas a evitar.`;
        }
        $('#hero').innerHTML = `<div class="empty"><h3 style="font-family:var(--font-display);margin:0 0 8px">Sin recomendaciones disponibles</h3><p style="margin:0;color:var(--ink-muted)">${esc(msg)}</p></div>`;
        $('#compare').innerHTML = '';
        $('#alts').innerHTML = '';
    }

    function renderCalendar(plan) {
        const cfgE = effective();
        const vac = new Map(), blk = new Set();
        if (plan) {
            plan.periods.forEach(p => {
                for (let i = p.bs; i <= p.be; i++) {
                    blk.add(i);
                    if (i >= p.si && i <= p.ei) vac.set(i, true);
                }
            });
        }
        if ($('#cal-showing')) {
            $('#cal-showing').textContent = plan ? `Mostrando en calendario: ${plan.periods.map(p => `${fmtShort(p.start)}${p.end !== p.start ? ' a ' + fmtShort(p.end) : ''}`).join(' + ')}.` : '';
        }
        const c = cal || E.buildCalendar(cfgE, allHolidays());

        // Generar lista de meses desde el inicio del horizonte hasta el final
        const sDate = new Date(E.parseISO(cfgE.rangeStart));
        const eDate = new Date(E.parseISO(cfgE.rangeEnd));
        const monthsList = [];
        let curY = sDate.getUTCFullYear(), curM = sDate.getUTCMonth();
        const limitY = eDate.getUTCFullYear(), limitM = eDate.getUTCMonth();

        while (curY < limitY || (curY === limitY && curM <= limitM)) {
            monthsList.push({ year: curY, month: curM });
            curM++;
            if (curM > 11) {
                curM = 0;
                curY++;
            }
        }

        let html = '';
        for (const { year: yr, month: m } of monthsList) {
            const first = `${yr}-${String(m + 1).padStart(2, '0')}-01`;
            const off = (E.dowOf(first) + 6) % 7;
            let cells = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join('') + '<span></span>'.repeat(off);
            let ix = c.index.get(first);
            if (ix !== undefined) {
                while (ix < c.days.length && c.days[ix].date.slice(0, 7) === first.slice(0, 7)) {
                    const d = c.days[ix], isV = vac.has(ix), inB = blk.has(ix);
                    const cls = ['c'];
                    if (isV) cls.push(d.consumes_vacation_balance ? 'c-vac' : 'c-vac0');
                    else if (d.holidayApplies) cls.push('c-hol');
                    else if (d.is_non_working_day) cls.push('c-off');
                    if (d.isHoliday && !d.holidayApplies) cls.push('c-holign');
                    if (inB && !isV) cls.push('c-ext');
                    if (!d.inRange) cls.push('c-out');
                    if (d.excluded) cls.push('c-excl');
                    if (d.date === TODAY) cls.push('c-today');
                    const lab = dayLabel(d, isV, inB) + (d.excluded ? ', fecha a evitar' : '') + (!d.inRange ? ', fuera del rango elegido' : '');
                    cells += `<span class="${cls.join(' ')}" role="gridcell" aria-label="${esc(fmt(d.date, true) + ': ' + lab)}" title="${esc(lab)}">${+d.date.slice(8)}</span>`;
                    ix++;
                }
            }
            html += `<div class="month"><h4>${MESES[m]} ${yr}</h4><div class="grid7" role="grid" aria-label="${MESES[m]} ${yr}">${cells}</div></div>`;
        }
        if ($('#months')) $('#months').innerHTML = html;
    }

    function runTestsUI() {
        if (!window.runTests) return;
        const r = window.runTests(E), ok = r.filter(x => x.ok).length;
        const list = $('#tests');
        if (list) {
            list.innerHTML = `<li><b>${ok} de ${r.length} pruebas pasadas correctamente.</b></li>` + r.map(x => `<li class="${x.ok ? 'ok' : 'bad'}"><span class="material-icons-outlined" aria-hidden="true" style="font-size:16px;vertical-align:text-bottom">${x.ok ? 'check_circle' : 'cancel'}</span> ${esc(x.name)}${x.detail ? ': ' + esc(x.detail) : ''}</li>`).join('');
        }
    }

    /* ---------- Arranque ---------- */
    if (state.year < CUR_YEAR - 1 || state.year > CUR_YEAR + 1) state.year = CUR_YEAR;
    initTheme();
    initControls();
    syncControls();
    renderSourceStatus();
    loadHolidaysForRange();
})();
