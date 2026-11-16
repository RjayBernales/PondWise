/* Shared, build-free domain contracts. Also loaded by the Node test harness. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PondDomain = api;
})(globalThis, function () {
  'use strict';
  const COLLECTIONS = ['ponds', 'tasks', 'feedLogs', 'waterLogs', 'healthLogs', 'maintLogs', 'expenses', 'sales'];
  const TASK_TYPES = ['feeding', 'inspection', 'cleaning', 'repair', 'other'];
  const STAGES = [
    { min: 0, max: 5, label: '0–<5 g', rate: 10, meals: '4–5' },
    { min: 5, max: 20, label: '5–<20 g', rate: 7, meals: '3–4' },
    { min: 20, max: 100, label: '20–<100 g', rate: 5, meals: '3' },
    { min: 100, max: 250, label: '100–<250 g', rate: 3, meals: '2–3' },
    { min: 250, max: Infinity, label: '250 g and above', rate: 2.5, meals: '2' }
  ];
  function fail(field, message) { const e = new Error(field + ': ' + message); e.field = field; throw e; }
  function object(v, field) { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(field, 'expected an object'); return v; }
  function text(v, field, max, required = false) {
    if (typeof v !== 'string') fail(field, 'expected text');
    const s = v.trim();
    if (s.length > max || (required && !s)) fail(field, `enter ${required ? '1–' : 'up to '}${max} characters`);
    return s;
  }
  function number(v, field, min, max, optional = false, integer = false, exclusiveMin = false) {
    if (optional && (v === '' || v === null || v === undefined)) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (exclusiveMin && v === min) || (integer && !Number.isInteger(v))) fail(field, `enter ${integer ? 'a whole number' : 'a finite number'} ${exclusiveMin ? 'greater than' : 'from'} ${min} to ${max}`);
    return v;
  }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '0001-01-01') return false;
    const d = new Date(s + 'T12:00:00Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }
  function timezone(s) { try { new Intl.DateTimeFormat('en', { timeZone: s }).format(); } catch (_) { fail('timezone', 'use an IANA timezone such as Asia/Manila'); } if (typeof s !== 'string' || !s) fail('timezone', 'required'); return s; }
  function today(zone = 'Asia/Manila', now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function date(s, field, zone, future = false) { if (!validDate(s)) fail(field, 'enter a valid calendar date'); if (!future && s > today(zone)) fail(field, 'future observations are not allowed'); return s; }
  function instant(v, field) { if (v === null || v === undefined) return null; if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) || !validDate(v.slice(0, 10)) || !Number.isFinite(Date.parse(v))) fail(field, 'invalid UTC timestamp'); return new Date(v).toISOString(); }
  function money(s) {
    if (typeof s !== 'string' || !/^\d+(\.\d{1,2})?$/.test(s.trim())) fail('amount', 'enter a positive PHP amount with at most two decimal places');
    const [whole, frac = ''] = s.trim().split('.');
    const cents = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
    if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) fail('amount', 'amount is outside the supported range');
    return Number(cents);
  }
  function blank() { return { schemaVersion: 2, revision: 0, settings: { timezone: 'Asia/Manila', currency: 'PHP' }, data: Object.assign({ activePondId: null }, Object.fromEntries(COLLECTIONS.map(k => [k, []]))) }; }
  function validate(input) {
    object(input, 'backup');
    if (input.schemaVersion !== 2) fail('schemaVersion', 'unsupported schema version');
    number(input.revision, 'revision', 0, Number.MAX_SAFE_INTEGER, false, true);
    const settings = object(input.settings, 'settings');
    const zone = timezone(settings.timezone);
    if (settings.currency !== 'PHP') fail('currency', 'only PHP is supported');
    const source = object(input.data, 'data');
    const out = blank(); out.revision = input.revision; out.settings.timezone = zone;
    const ids = new Set();
    for (const col of COLLECTIONS) {
      if (!Array.isArray(source[col])) fail(col, 'expected a collection');
      out.data[col] = source[col].map(raw => {
        object(raw, col);
        const id = text(raw.id, 'id', 200, true);
        if (ids.has(id)) fail('id', 'duplicate ID ' + id); ids.add(id);
        const r = { id, createdAt: instant(raw.createdAt, 'createdAt'), updatedAt: instant(raw.updatedAt, 'updatedAt'), deletedAt: instant(raw.deletedAt, 'deletedAt') };
        if (col === 'ponds') {
          r.name = text(raw.name, 'name', 120, true); r.size = number(raw.size, 'size', 0, Number.MAX_VALUE, true, false, true);
          r.notes = text(raw.notes, 'notes', 2000); if (typeof raw.archived !== 'boolean') fail('archived', 'expected true or false'); r.archived = raw.archived;
          const s = object(raw.stock, 'stock');
          r.stock = { common: text(s.common, 'common', 200), scientific: text(s.scientific, 'scientific', 200), count: number(s.count, 'count', 0, 10000000, true, true), avgWeightG: number(s.avgWeightG, 'avgWeightG', 0, 1000000, true, false, true), updatedAt: instant(s.updatedAt, 'stock.updatedAt') };
        } else {
          r.pondId = text(raw.pondId, 'pondId', 200, true); r.date = date(raw.date, 'date', zone, col === 'tasks');
          if (col === 'tasks') {
            r.title = text(raw.title, 'title', 120, true); if (!TASK_TYPES.includes(raw.type)) fail('type', 'unknown task type'); r.type = raw.type;
            if (typeof raw.done !== 'boolean') fail('done', 'expected true or false'); r.done = raw.done;
            r.completedAt = instant(raw.completedAt, 'completedAt'); if (!r.done && r.completedAt) fail('completedAt', 'open tasks cannot have a completion timestamp');
          } else if (col === 'feedLogs') {
            if (typeof raw.skipped !== 'boolean') fail('skipped', 'expected true or false');
            r.skipped = raw.skipped;
            r.kg = r.skipped ? number(raw.kg, 'kg', 0, 0) : number(raw.kg, 'kg', 0, 1000000, false, false, true);
            r.notes = text(raw.notes, 'notes', 2000);
          } else if (col === 'waterLogs') {
            r.ph = number(raw.ph, 'ph', 0, 14, true); r.temp = number(raw.temp, 'temp', 0, 60, true); r.notes = text(raw.notes, 'notes', 2000);
            if (r.ph === null && r.temp === null && !r.notes) fail('notes', 'record at least one water measurement or observation');
          } else if (col === 'healthLogs' || col === 'maintLogs') r.note = text(raw.note, 'note', 2000, true);
          else { r.item = text(raw.item, 'item', 120, true); r.amountCentavos = number(raw.amountCentavos, 'amount', 1, Number.MAX_SAFE_INTEGER, false, true); r.category = text(raw.category, 'category', 120); }
        }
        return r;
      });
    }
    const pondIds = new Set(out.data.ponds.map(p => p.id));
    for (const col of COLLECTIONS.slice(1)) for (const r of out.data[col]) if (!pondIds.has(r.pondId)) fail('pondId', `orphan ${col} record ${r.id}`);
    const available = out.data.ponds.filter(p => !p.archived && !p.deletedAt);
    out.data.activePondId = available.some(p => p.id === source.activePondId) ? source.activePondId : available[0]?.id || null;
    // Check both independent sums and net before Number arithmetic is allowed.
    totals(out.data, 'all');
    return out;
  }
  function legacyNumber(v) { if (v === '' || v === null || v === undefined) return null; if (typeof v !== 'number' && typeof v !== 'string') return NaN; return Number(v); }
  function migrate(raw) {
    object(raw, 'backup'); if (raw.schemaVersion !== undefined) return validate(raw);
    const out = blank();
    for (const col of COLLECTIONS) {
      if (!Array.isArray(raw[col])) fail(col, 'legacy collection missing or invalid; original data retained');
      out.data[col] = raw[col].map(v => {
        object(v, col); const r = { ...v, createdAt: null, updatedAt: null, deletedAt: null };
        if (col === 'ponds') { r.size = legacyNumber(v.size); r.archived = false; const s = object(v.stock, 'stock'); r.stock = { ...s, count: legacyNumber(s.count), avgWeightG: legacyNumber(s.avgWeightG), updatedAt: null }; }
        if (col === 'tasks') r.completedAt = null;
        if (col === 'feedLogs') { r.kg = legacyNumber(v.kg); r.skipped = false; r.notes = ''; }
        if (col === 'waterLogs') { r.ph = legacyNumber(v.ph); r.temp = legacyNumber(v.temp); }
        if (col === 'expenses' || col === 'sales') { r.amountCentavos = money(String(v.amount)); r.category = ''; }
        return r;
      });
    }
    out.data.activePondId = raw.activePondId;
    return validate(out);
  }
  function parse(raw) { if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 5 * 1024 * 1024) fail('file', 'backup exceeds the 5 MiB limit'); let v; try { v = JSON.parse(raw); } catch (_) { fail('file', 'invalid JSON'); } return migrate(v); }
  function sorted(rows) { return rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id)); }
  function live(rows) { return rows.filter(r => !r.deletedAt); }
  function latestWater(data, pondId) { return sorted(live(data.waterLogs).filter(r => r.pondId === pondId))[0] || null; }
  function totals(data, scope, from = '', to = '9999-12-31') {
    if (!scope) fail('scope', 'choose a pond or all ponds');
    const sum = col => data[col].filter(r => !r.deletedAt && (scope === 'all' || r.pondId === scope) && r.date >= from && r.date <= to).reduce((n, r) => { number(r.amountCentavos, 'amount', 1, Number.MAX_SAFE_INTEGER, false, true); return n + BigInt(r.amountCentavos); }, 0n);
    const expenses = sum('expenses'), income = sum('sales'), net = income - expenses;
    if ([expenses, income, net].some(n => n > BigInt(Number.MAX_SAFE_INTEGER) || n < -BigInt(Number.MAX_SAFE_INTEGER))) fail('amount', 'aggregate exceeds safe centavo range');
    return { expenses: Number(expenses), income: Number(income), net: Number(net) };
  }
  function recommendation(count, weight, override = null) {
    if (count === null || weight === null || count === '' || weight === '') return { warnings: ['Save fish count and positive average weight to estimate feed.'] };
    number(count, 'count', 0, 10000000, false, true); number(weight, 'avgWeightG', 0, 1000000, false, false, true);
    const stage = STAGES.find(s => weight >= s.min && weight < s.max);
    const rate = override === null ? stage.rate : number(override, 'rate', 0, 15, false, false, true);
    const biomass = count * weight / 1000, kg = biomass * rate / 100;
    if (!Number.isFinite(kg)) fail('kg', 'calculation overflow');
    return { biomass, rate, kg, meals: stage.meals, stage: stage.label, source: override === null ? 'PondWise size guide v1' : 'Manual override', warnings: ['Starting estimate only. Adjust for species, appetite and water conditions; seek local aquaculture advice.'] };
  }
  function plan(v) { return ['start', 'pro', 'elite'].includes(v) ? v : 'start'; }
  function limit(v) { return { start: 1, pro: 5, elite: Infinity }[plan(v)]; }
  function canActivate(data, tier) { return data.ponds.filter(p => !p.archived && !p.deletedAt).length < limit(tier); }
  function toggleTask(task, now = new Date().toISOString()) { return { ...task, done: !task.done, completedAt: task.done ? null : now, updatedAt: now }; }
  function completedToday(task, zone, now = new Date()) { return task.done && task.completedAt !== null && today(zone, new Date(task.completedAt)) === today(zone, now); }
  function setDeleted(envelope, col, id, deleted, tier = 'start') {
    if (!COLLECTIONS.includes(col)) fail('collection', 'unknown collection');
    const next = structuredClone(envelope), row = next.data[col].find(r => r.id === id);
    if (!row) fail('id', 'record not found');
    if (col === 'ponds' && !deleted && !row.archived && !canActivate(next.data, tier)) fail('pond', 'pond limit reached; archive another pond or change preview tier');
    row.deletedAt = deleted ? new Date().toISOString() : null;
    // Pond deletion retains its entire dependent graph; trash restores it as one unit.
    return validate(next);
  }
  return { COLLECTIONS, TASK_TYPES, STAGES, fail, number, today, validDate, date, timezone, money, blank, validate, migrate, parse, sorted, live, latestWater, totals, recommendation, plan, limit, canActivate, toggleTask, completedToday, setDeleted };
});
