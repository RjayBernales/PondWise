/* PondWise UI: no inline handlers, no framework, no build step. */
(() => {
  'use strict';
  const D = PondDomain, S = PondStorage, $ = id => document.getElementById(id);
  const titles = { overview: 'Overview', ponds: 'Ponds', tasks: 'Tasks', records: 'Records', money: 'Money', tools: 'Tools', settings: 'Help & settings', plans: 'Plan preview', more: 'More' };
  const aliases = { dashboard: 'overview', feed: 'tools', finance: 'money', guide: 'settings', help: 'settings' };
  const labels = { feedLogs: 'Feeding', waterLogs: 'Water', healthLogs: 'Fish health', maintLogs: 'Maintenance', expenses: 'Expense', sales: 'Income', tasks: 'Task' };
  const now = () => new Date().toISOString();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = v => structuredClone(v);
  let demo = false, store, state, opened, page = 'overview', drafts = {}, editing = null, recordType = 'feedLogs', moneyType = 'expenses', preview = null, restoreGeneration = 0, selectedDay = null, cursor = null, day = '', conflict = false;
  const filters = { records: { scope: '', q: '', type: '', from: '', to: '', page: 1 }, money: { scope: '', q: '', type: '', from: '', to: '', page: 1 }, tasks: { scope: '', q: '', type: '', from: '', to: '', page: 1 } };
  const browserStorage = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) };
  let tier = 'start';
  function planKey() { return demo ? 'pondwise_demo_plan' : 'pondwise_plan'; }
  function openWorkspace(isDemo) {
    demo = isDemo;
    try { tier = D.plan(browserStorage.getItem(planKey())); } catch (_) { tier = 'start'; }
    for (const f of Object.values(filters)) Object.assign(f, { scope: '', q: '', type: '', from: '', to: '', page: 1 });
    store = new S.Store(browserStorage, demo); opened = store.open(); state = opened.state || D.blank(); conflict = false;
    day = D.today(state.settings.timezone); selectedDay = day; cursor = day.slice(0, 7);
  }
  function active() { return state.data.ponds.find(p => p.id === state.data.activePondId && !p.deletedAt && !p.archived); }
  function pondName(id) { return state.data.ponds.find(p => p.id === id)?.name || 'Unknown pond'; }
  function usable() { return !store.blocked && opened.status !== 'migration' && !conflict; }
  function notify(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; $('notice').setAttribute('role', error ? 'alert' : 'status'); }
  function button(label, action, data = '', cls = '') { return `<button type="button" class="${cls}" data-action="${action}" ${data}>${esc(label)}</button>`; }
  function link(label, route, cls = 'button') { return `<a class="${cls}" href="#${route}">${esc(label)}</a>`; }
  function head(title, sub = '') { return `<div class="page-head"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`; }
  function empty(message = 'No records yet. Add a record to begin.') { return `<p class="empty">${esc(message)}</p>`; }
  function amountText(cents) { const n = BigInt(cents); return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`; }
  function currency(cents) { const n = BigInt(cents), abs = n < 0n ? -n : n; const parts = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).formatToParts(abs / 100n); return (n < 0n ? '−' : '') + parts.map(p => p.type === 'fraction' ? String(abs % 100n).padStart(2, '0') : p.value).join(''); }
  function feedText(p, override = null) {
    const r = D.recommendation(p?.stock.count ?? null, p?.stock.avgWeightG ?? null, override);
    if (r.kg === undefined) return empty(r.warnings[0]);
    return `<p><strong>${r.kg.toFixed(2)} kg/day estimated</strong></p><p>${r.biomass.toFixed(2)} kg biomass × ${r.rate}% per day. ${esc(r.meals)} meals/day.</p><small>${esc(r.source)}; ${esc(r.stage)}. ${esc(r.warnings[0])}</small>`;
  }
  function waterText(w) {
    if (!w) return empty('No measurement recorded. Add a water check.');
    const stale = (new Date(day + 'T12:00:00Z') - new Date(w.date + 'T12:00:00Z')) / 86400000 > 7;
    return `<p><strong>${esc(w.date)}${stale ? ' • More than 7 days old' : ''}</strong></p><p>pH: ${w.ph === null ? 'Not measured' : esc(w.ph)}<br>Temperature: ${w.temp === null ? 'Not measured' : esc(w.temp) + ' °C'}</p><p class="wrap">${esc(w.notes)}</p><small>Readings alone do not establish fish health. Recheck unusual readings and consult local aquaculture support before treatment.</small>`;
  }
  function nav() {
    $('desktopNav').innerHTML = Object.entries(titles).filter(([k]) => k !== 'more').map(([k, v]) => `<a href="#${k}" ${page === k ? 'aria-current="page"' : ''}>${v}</a>`).join('');
    $('mobileNav').innerHTML = [['overview', 'Home'], ['ponds', 'Ponds'], ['tasks', 'Tasks'], ['records', 'Records'], ['more', 'More']].map(([k, v]) => `<a href="#${k}" ${(page === k || (k === 'more' && ['money', 'tools', 'settings', 'plans'].includes(page))) ? 'aria-current="page"' : ''}>${v}</a>`).join('');
    const available = state.data.ponds.filter(p => !p.archived && !p.deletedAt);
    $('pondContext').innerHTML = available.length ? available.map(p => `<option value="${esc(p.id)}" ${p.id === state.data.activePondId ? 'selected' : ''}>${esc(p.name)}</option>`).join('') : '<option value="">No active ponds</option>';
    $('pondContext').disabled = !usable() || !available.length;
    $('workspaceBanner').hidden = usable() && !demo;
    let banner = '';
    if (demo) banner += `<p><strong>Demo workspace</strong> — your farm notebook is separate.</p>${button('Return to farm notebook', 'workspace')}`;
    if (opened.status === 'migration') banner += `<p><strong>Legacy data found.</strong> Review ${counts(state)}. Valid amounts convert to centavos; historical dates stay unchanged; completion times remain unknown. The original pondwise_v1 will remain untouched.</p>${button('Migrate safely', 'migrate', '', 'primary')}${button('Export original data', 'raw')}`;
    if (store.blocked) banner += `<p><strong>Recovery required.</strong> ${esc(opened.error?.message || 'Storage unavailable.')} Ordinary saves are blocked. Export original data, then use Help & settings to restore a validated backup.</p>${button('Export raw workspace', 'raw')}${link('Open recovery tools', 'settings')}`;
    if (conflict) banner += `<p><strong>Workspace changed in another tab.</strong> Saves are paused. Drafts are retained here; download them before reloading.</p>${button('Export drafts', 'draft-export')}${button('Reload saved workspace', 'reload')}`;
    $('workspaceBanner').innerHTML = banner;
  }
  function counts(s) { return D.COLLECTIONS.map(k => `${s.data[k].length} ${k}`).join(', '); }
  function draftKey(form) { return [demo ? 'demo' : 'farm', state.data.activePondId || 'none', form.id].join(':'); }
  function savedDraft(formId) { return drafts[[demo ? 'demo' : 'farm', state.data.activePondId || 'none', formId].join(':')]; }
  function capture() {
    document.querySelectorAll('form[data-draft]').forEach(form => {
      const values = {}; Array.from(form.elements).filter(e => e.name).forEach(e => { values[e.name] = e.type === 'checkbox' ? e.checked : e.value; });
      if (form.dataset.dirty === 'true') drafts[draftKey(form)] = { values, editing: form.dataset.editing || '' };
    });
  }
  function hydrate() {
    document.querySelectorAll('form[data-draft]').forEach(form => {
      const draft = drafts[draftKey(form)]; if (!draft) return;
      Object.entries(draft.values).forEach(([name, value]) => { const e = form.elements.namedItem(name); if (e) { if (e.type === 'checkbox') e.checked = value; else e.value = value; } });
      form.dataset.dirty = 'true'; form.dataset.editing = draft.editing;
    });
  }
  function render(preserve = true) {
    const focused = document.activeElement;
    const focusId = focused?.id, focusData = focused?.dataset.action ? { ...focused.dataset } : null;
    if (preserve) capture(); nav();
    const routes = { overview: overviewView, ponds: pondsView, tasks: tasksView, records: recordsView, money: moneyView, tools: toolsView, settings: settingsView, plans: plansView, more: moreView };
    $('main').innerHTML = routes[page](); hydrate();
    document.querySelectorAll('form[data-draft]').forEach(form => { if (!usable()) form.querySelectorAll('button[type=submit]').forEach(b => { b.disabled = true; }); });
    if (page === 'tools') searchSpecies('');
    const focusTarget = focusId ? $(focusId) : focusData ? [...document.querySelectorAll('[data-action]')].find(e => Object.entries(focusData).every(([k, v]) => e.dataset[k] === v)) : null;
    if (focusTarget) focusTarget.focus({ preventScroll: true }); else if (focused?.closest('main')) $('main').focus({ preventScroll: true });
    if (editing) document.querySelector('form[data-editing]:not([data-editing=""])')?.scrollIntoView({ block: 'start' });
  }
  function route() {
    capture(); const hash = location.hash.slice(1); page = aliases[hash] || (titles[hash] ? hash : 'overview'); render(false); $('main').focus({ preventScroll: true }); if (!editing) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function commit(next, message, form = null, recovery = false) {
    if (!recovery && !usable()) throw new Error('Finish migration or resolve recovery/conflict before saving.');
    const savedDraftKey = form ? draftKey(form) : null;
    state = store.commit(next, recovery); opened = { status: 'ready', state };
    if (form) { delete drafts[savedDraftKey]; form.dataset.dirty = 'false'; form.reset(); }
    editing = null; render(false); notify(message); return true;
  }
  function requirePond() { const p = active(); if (!p) throw new Error('Select or create an active pond first.'); return p; }
  function overviewView() {
    const p = active();
    if (!p) return head('Your pond notebook', 'A record of the work, water and fish in your care.') + `<section class="panel attention"><h2>Start with a pond</h2><p>Create your first pond, then save a stock snapshot and a daily observation.</p><div class="actions">${link('Create a pond', 'ponds', 'button primary')}${button('Explore the demo', 'workspace')}</div></section>`;
    const tasks = D.live(state.data.tasks).filter(t => t.pondId === p.id), open = tasks.filter(t => !t.done && t.date <= day).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const rec = D.recommendation(p.stock.count, p.stock.avgWeightG), actual = D.live(state.data.feedLogs).filter(r => r.pondId === p.id && r.date === day).reduce((n, r) => n + r.kg, 0);
    return head('Today at ' + p.name, `${day} • ${state.settings.timezone}`) + `<section class="panel attention"><h2>Work needing attention</h2>${open.length ? open.map(taskRow).join('') : empty('No overdue or today tasks. Plan upcoming work in Tasks.')}${link('Open task agenda', 'tasks')}</section><div class="metrics"><div class="metric"><strong>${rec.kg === undefined ? 'Incomplete stock' : rec.kg.toFixed(2) + ' kg'}</strong><span>Daily feed estimate</span></div><div class="metric"><strong>${actual.toFixed(2)} kg</strong><span>Feed logged today</span></div><div class="metric"><strong>${rec.kg === undefined ? '—' : Math.max(0, rec.kg - actual).toFixed(2) + ' kg'}</strong><span>Remaining estimate, not a feeding instruction</span></div></div><div class="split"><section class="panel"><h2>Latest water observation</h2>${waterText(D.latestWater(state.data, p.id))}${button('Record a water check', 'record-type', 'data-col="waterLogs"')}</section><section class="panel"><h2>Completed today</h2>${tasks.filter(t => D.completedToday(t, state.settings.timezone)).map(taskRow).join('') || empty('No tasks completed today. Older completions with unknown times stay in task history.')}<h2>Recent activity</h2>${historyRows(allRows().filter(r => r.pondId === p.id).slice(0, 5), false)}${link('View complete history', 'records')}</section></div>`;
  }
  function field(name, label, type = 'text', value = '', attrs = '', full = false) {
    const id = 'field-' + name;
    const control = type === 'textarea' ? `<textarea id="${id}" name="${name}" ${attrs}>${esc(value)}</textarea>` : `<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}>`;
    return `<div class="field ${full ? 'full' : ''}"><label for="${id}">${esc(label)}</label>${control}</div>`;
  }
  const num = (name, label, value, min, max, optional = false, step = 'any') => field(name, label, 'number', value ?? '', `min="${min}" max="${max}" step="${step}" ${optional ? '' : 'required'}`);
  function form(id, content, label = 'Save record', edit = '') { content = content.replaceAll('id="field-', `id="${id}-field-`).replaceAll('for="field-', `for="${id}-field-`); return `<form id="${id}" data-draft data-editing="${esc(edit)}" novalidate><div class="form-error" role="alert" tabindex="-1" hidden></div><div class="form-grid">${content}</div><p class="draft-note">Drafts stay with this pond while you move between screens. Export drafts in Settings before leaving or reloading.</p><div class="actions"><button class="primary" type="submit">${esc(label)}</button>${button('Discard draft', 'discard', `data-form="${id}"`)}</div></form>`; }
  function pondsView() {
    const p = active(), count = state.data.ponds.filter(p => !p.archived && !p.deletedAt).length;
    const cards = state.data.ponds.filter(p => !p.deletedAt).map(p => `<article class="panel"><span class="pill">${p.archived ? 'Archived' : p.id === state.data.activePondId ? 'Active pond' : 'Pond'}</span><h2 class="wrap">${esc(p.name)}</h2><p>${p.size === null ? 'Area not recorded' : esc(p.size) + ' m²'}<br>${esc(p.stock.common || p.stock.scientific || 'Species not recorded')}<br>${p.stock.count === null ? 'Count missing' : esc(p.stock.count) + ' fish'}; ${p.stock.avgWeightG === null ? 'weight missing' : esc(p.stock.avgWeightG) + ' g average'}</p><small>Stock updated: ${esc(p.stock.updatedAt || 'Unknown (legacy or not yet recorded)')}</small><div class="actions">${!p.archived ? button('Select pond', 'select-pond', `data-id="${esc(p.id)}"`) : ''}${button(p.archived ? 'Reactivate' : 'Archive', 'archive', `data-id="${esc(p.id)}"`)}${button('Move to trash', 'trash', `data-col="ponds" data-id="${esc(p.id)}"`, 'danger')}</div></article>`).join('');
    return head('Ponds', `${count} active ponds. ${tier === 'elite' ? 'Unlimited' : D.limit(tier)} allowed in ${tier} preview. Existing ponds survive tier changes.`) + `<div class="cards">${cards || empty('No ponds yet. Create one below.')}</div><section class="panel" style="margin-top:24px"><h2>Create a pond</h2>${form('pond-create', field('name', 'Pond name (required)', 'text', '', 'required maxlength="120"') + num('size', 'Area (m², optional)', '', 0, Number.MAX_VALUE, true) + field('notes', 'Notes (optional)', 'textarea', '', 'maxlength="2000"', true), 'Create pond')}</section>${p ? `<section class="panel"><h2>Edit ${esc(p.name)} and stock snapshot</h2><p>Stock is a current snapshot. Sales and health notes do not change the count.</p>${form('pond-edit', field('name', 'Pond name (required)', 'text', p.name, 'required maxlength="120"') + num('size', 'Area (m², optional)', p.size, 0, Number.MAX_VALUE, true) + field('notes', 'Pond notes (optional)', 'textarea', p.notes, 'maxlength="2000"', true) + field('common', 'Common species name (optional)', 'text', p.stock.common, 'maxlength="200"') + field('scientific', 'Scientific name (optional)', 'text', p.stock.scientific, 'maxlength="200"') + num('count', 'Fish count (optional; whole fish)', p.stock.count, 0, 10000000, true, '1') + num('avgWeightG', 'Average weight (g, optional)', p.stock.avgWeightG, 0, 1000000, true), 'Save pond and stock')}<div class="actions">${link('Look up a species', 'tools')}</div><h3>Shared feed estimate</h3>${feedText(p)}</section>` : ''}`;
  }
  function scopeOptions(scope) { return `<option value="active" ${!scope || scope === 'active' ? 'selected' : ''}>Active pond</option><option value="all" ${scope === 'all' ? 'selected' : ''}>All ponds</option>` + state.data.ponds.filter(p => !p.deletedAt).map(p => `<option value="${esc(p.id)}" ${scope === p.id ? 'selected' : ''}>${esc(p.name)}${p.archived ? ' (archived)' : ''}</option>`).join(''); }
  function filterView(kind, types = true) {
    const f = filters[kind];
    return `<div class="filters" data-filters="${kind}"><div><label for="scope">History scope</label><select id="scope" data-filter="scope">${scopeOptions(f.scope)}</select></div><div><label for="history-search">Search history</label><input id="history-search" type="search" data-filter="q" value="${esc(f.q)}" maxlength="200"></div>${types ? `<div><label for="type-filter">Record type</label><select id="type-filter" data-filter="type"><option value="">All types</option>${Object.entries(labels).filter(([k]) => kind === 'money' ? ['expenses', 'sales'].includes(k) : ['feedLogs', 'waterLogs', 'healthLogs', 'maintLogs'].includes(k)).map(([k, v]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}<div><label for="from">From date</label><input id="from" type="date" data-filter="from" value="${f.from}"></div><div><label for="to">Through date</label><input id="to" type="date" data-filter="to" value="${f.to}"></div><div>${button('Apply filters', 'filter', `data-kind="${kind}"`)}${button('Reset filters', 'filter-reset', `data-kind="${kind}"`)}</div></div>`;
  }
  function allRows(cols = D.COLLECTIONS.slice(2)) {
    const retained = new Set(state.data.ponds.filter(p => !p.deletedAt).map(p => p.id));
    return D.sorted(cols.flatMap(col => D.live(state.data[col]).filter(r => retained.has(r.pondId)).map(r => ({ ...r, col }))));
  }
  function filtered(rows, kind) {
    const f = filters[kind], scope = !f.scope || f.scope === 'active' ? active()?.id : f.scope;
    return rows.filter(r => (scope === 'all' || r.pondId === scope) && (!f.type || r.col === f.type) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to) && (!f.q || [r.title, r.type, r.done ? 'completed' : 'open', r.item, r.note, r.notes, r.category, r.date, describe(r), labels[r.col], pondName(r.pondId)].join(' ').toLowerCase().includes(f.q.toLowerCase())));
  }
  function describe(r) {
    if (r.col === 'feedLogs') return r.skipped ? 'Skipped feeding' : r.kg + ' kg feed';
    if (r.col === 'waterLogs') return `pH ${r.ph ?? 'not measured'}; temperature ${r.temp === null ? 'not measured' : r.temp + ' °C'}`;
    if (r.col === 'expenses' || r.col === 'sales') return `${r.item}: ${currency(r.amountCentavos)}`;
    return r.note || r.title;
  }
  function historyRows(rows, actions = true) {
    if (!rows.length) return empty('No matching records. Add a record or reset your filters.');
    return `<ul class="timeline">${rows.map(r => `<li class="row"><div><span class="pill">${esc(labels[r.col])}</span><h3>${esc(describe(r))}</h3><p>${esc(r.date)} • ${esc(pondName(r.pondId))}${r.category ? ' • ' + esc(r.category) : ''}</p>${r.notes ? `<p class="wrap">${esc(r.notes)}</p>` : ''}</div>${actions ? `<div class="actions">${button('Edit', 'edit', `data-col="${r.col}" data-id="${esc(r.id)}"`)}${button('Trash', 'trash', `data-col="${r.col}" data-id="${esc(r.id)}"`, 'danger')}</div>` : ''}</li>`).join('')}</ul>`;
  }
  function paginate(rows, kind, renderer = historyRows) {
    const f = filters[kind], pages = Math.max(1, Math.ceil(rows.length / 12)); f.page = Math.min(f.page, pages);
    return renderer(rows.slice((f.page - 1) * 12, f.page * 12)) + `<div class="pagination">${button('Previous page', 'page', `data-kind="${kind}" data-step="-1" ${f.page <= 1 ? 'disabled' : ''}`)}<span>${rows.length} records • Page ${f.page} of ${pages}</span>${button('Next page', 'page', `data-kind="${kind}" data-step="1" ${f.page >= pages ? 'disabled' : ''}`)}</div>`;
  }
  function entryForm(col) {
    // A correction draft can outlive the transient `editing` flag when the
    // operator changes pond, route, or money/record type. Restore its target
    // before rendering so the heading and submit action cannot look like a
    // new entry while still updating an existing row.
    const draft = savedDraft('entry-' + col);
    const editingId = editing?.col === col ? editing.id : draft?.editing;
    const row = editingId ? state.data[col].find(r => r.id === editingId) : null;
    let content = field('date', col === 'tasks' ? 'Due date (required; future dates allowed)' : 'Observation date (required)', 'date', row?.date || (col === 'tasks' ? selectedDay : day), `required ${col !== 'tasks' ? 'max="' + day + '"' : ''}`);
    if (col === 'tasks') content += field('title', 'Task title (required)', 'text', row?.title || '', 'required maxlength="120"') + `<div class="field"><label for="field-type">Task type</label><select name="type" id="field-type">${D.TASK_TYPES.map(t => `<option ${row?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    if (col === 'feedLogs') content += num('kg', 'Feed given (kg, required unless skipped)', row?.kg, 0, 1000000, true) + `<label class="check"><input type="checkbox" name="skipped" ${row?.skipped ? 'checked' : ''}>Skipped feeding (0 kg)</label>` + field('notes', 'Notes (optional)', 'textarea', row?.notes || '', 'maxlength="2000"', true);
    if (col === 'waterLogs') content += num('ph', 'pH (0–14, optional)', row?.ph, 0, 14, true) + num('temp', 'Temperature (°C, 0–60, optional)', row?.temp, 0, 60, true) + field('notes', 'Water observation (required if no measurements)', 'textarea', row?.notes || '', 'maxlength="2000"', true);
    if (col === 'healthLogs' || col === 'maintLogs') content += field('note', col === 'healthLogs' ? 'Fish health observation (required)' : 'Maintenance note (required)', 'textarea', row?.note || '', 'required maxlength="2000"', true);
    if (col === 'expenses' || col === 'sales') content += field('item', 'Description (required)', 'text', row?.item || '', 'required maxlength="120"') + field('amount', 'Amount (PHP, required; up to 2 decimal places)', 'text', row ? amountText(row.amountCentavos) : '', 'required inputmode="decimal"') + field('category', 'Category (optional)', 'text', row?.category || '', 'maxlength="120"');
    return `<section class="panel"><h2>${row ? 'Edit' : 'Add'} ${esc(labels[col].toLowerCase())}</h2><p>For <strong>${esc(row ? pondName(row.pondId) : active()?.name || 'no active pond')}</strong>.</p>${form('entry-' + col, content, row ? 'Save correction' : 'Save ' + labels[col].toLowerCase(), row?.id || '')}</section>`;
  }
  function recordsView() { return head('Records', 'Feeding, water, fish health and maintenance in one complete history.') + `<div class="panel"><label for="recordType">What would you like to record?</label><select id="recordType">${Object.entries(labels).filter(([k]) => !['tasks', 'sales', 'expenses'].includes(k)).map(([k, v]) => `<option value="${k}" ${recordType === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` + entryForm(recordType) + `<section class="panel"><h2>Observation history</h2>${filterView('records')}${paginate(filtered(allRows(['feedLogs', 'waterLogs', 'healthLogs', 'maintLogs']), 'records'), 'records')}</section>`; }
  function moneyView() {
    const rows = filtered(allRows(['expenses', 'sales']), 'money');
    const totals = D.totals({ expenses: rows.filter(r => r.col === 'expenses'), sales: rows.filter(r => r.col === 'sales') }, 'all');
    const access = tier !== 'start';
    return head('Money', 'Cash received less cash paid. This does not calculate accounting profit.') + `<section class="panel"><h2>Cash ledger</h2>${filterView('money')}<div class="metrics"><div class="metric"><strong>${currency(totals.income)}</strong><span>Income</span></div><div class="metric"><strong>${currency(totals.expenses)}</strong><span>Expenses</span></div><div class="metric"><strong class="${totals.net < 0 ? 'negative' : ''}">${currency(totals.net)}</strong><span>Net cash flow</span></div></div><p class="muted">Totals use the history scope, dates, type and search filters above. ${rows.length} matching transactions.</p>${paginate(rows, 'money')}</section>${access ? `<div class="actions">${button('Record expense', 'money-type', 'data-col="expenses"')}${button('Record income', 'money-type', 'data-col="sales"')}</div>${entryForm(moneyType)}` : `<section class="panel"><h2>Money entry is a Pro preview feature</h2><p>Existing transactions stay readable and exportable after a downgrade. Change the browser preview tier to add or correct transactions.</p>${link('Compare preview tiers', 'plans')}</section>`}`;
  }
  function taskRow(t) { return `<div class="row"><div><h3>${esc(t.title)}</h3><p>${esc(t.date)} • ${esc(pondName(t.pondId))} • ${esc(t.type)}${t.done ? ' • Completed ' + esc(t.completedAt ? D.today(state.settings.timezone, new Date(t.completedAt)) : '(time unknown)') : t.date < day ? ' • Overdue' : ''}</p></div><div class="actions">${button(t.done ? 'Reopen' : 'Complete', 'task-toggle', `data-id="${esc(t.id)}" aria-label="${esc((t.done ? 'Reopen ' : 'Complete ') + t.title)}"`)}${button('Edit', 'edit', `data-col="tasks" data-id="${esc(t.id)}"`)}${button('Trash', 'trash', `data-col="tasks" data-id="${esc(t.id)}" aria-label="${esc('Move task ' + t.title + ' to trash')}"`, 'danger')}</div></div>`; }
  function calendarUTC(y, m, d) { const date = new Date(0); date.setUTCFullYear(y, m, d); date.setUTCHours(12, 0, 0, 0); return date; }
  function calendar() {
    const [y, m] = cursor.split('-').map(Number), first = calendarUTC(y, m - 1, 1).getUTCDay(), days = calendarUTC(y, m, 0).getUTCDate();
    const tasks = D.live(state.data.tasks).filter(t => t.pondId === active()?.id);
    return `<details><summary>Month calendar</summary><div class="actions">${button('Previous month', 'month', 'data-step="-1"')}<strong>${esc(cursor)}</strong>${button('Next month', 'month', 'data-step="1"')}${button('Today', 'today')}</div><div class="field"><label for="calendarDate">Choose a task date</label><input type="date" id="calendarDate" value="${selectedDay}"></div><div class="calendar" aria-label="Month dates">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span aria-hidden="true">${d}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({ length: days }, (_, i) => { const d = cursor + '-' + String(i + 1).padStart(2, '0'), count = tasks.filter(t => t.date === d).length; return button(i + 1, 'day', `data-date="${d}" aria-label="${d}, ${count} tasks" aria-pressed="${d === selectedDay}"`, count ? 'has-task' : ''); }).join('')}</div><h3>Selected date: ${esc(selectedDay)}</h3>${tasks.filter(t => t.date === selectedDay).map(taskRow).join('') || empty('No tasks for this date.')}</details>`;
  }
  function tasksView() {
    const rank = t => t.done ? 3 : t.date < day ? 0 : t.date === day ? 1 : 2;
    const rows = filtered(allRows(['tasks']), 'tasks').sort((a, b) => rank(a) - rank(b) || (a.done ? (b.completedAt || '').localeCompare(a.completedAt || '') : a.date.localeCompare(b.date)) || a.id.localeCompare(b.id));
    const groups = [['Overdue', t => !t.done && t.date < day], ['Today', t => !t.done && t.date === day], ['Upcoming', t => !t.done && t.date > day], ['Completed', t => t.done]];
    return head('Tasks', 'Completing a task records its completion time. It does not create a feeding or cash record.') + `<section class="panel"><h2>Task agenda</h2>${filterView('tasks', false)}${paginate(rows, 'tasks', items => groups.map(([label, match]) => `<h3>${label}</h3>${items.filter(match).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map(taskRow).join('') || empty('No matching tasks on this page.')}`).join(''))}</section><section class="panel"><h2>Plan by date</h2>${calendar()}</section>${entryForm('tasks')}`;
  }
  function toolsView() {
    return head('Tools', 'Calculate an estimate or look up a species without changing your saved stock.') + `<section class="panel"><h2>Feed calculator</h2><p>Biomass = fish count × average grams ÷ 1,000. Daily estimate = biomass × rate ÷ 100.</p>${form('calculator', num('count', 'Fish count (required)', active()?.stock.count, 0, 10000000, false, '1') + num('avgWeightG', 'Average weight (g, required)', active()?.stock.avgWeightG, 0, 1000000) + num('rate', 'Manual rate override (%, optional; >0 to 15)', '', 0, 15, true), 'Calculate feed')}<div id="feedResult" role="status">${feedText(active())}</div><details><summary>Size-based guide and assumptions</summary><table><thead><tr><th>Average weight</th><th>Rate/day</th><th>Meals/day</th></tr></thead><tbody>${D.STAGES.map(s => `<tr><td>${s.label}</td><td>${s.rate}%</td><td>${s.meals}</td></tr>`).join('')}</tbody></table><p>All surfaces use this same version 1 size guide. It needs species-aware aquaculture review.</p></details></section><section class="panel"><h2>Species lookup</h2><label for="speciesSearch">Common name, genus or scientific name</label><input type="search" id="speciesSearch" maxlength="200"><div class="actions">${button('Search species', 'species-search')}</div><p id="speciesStatus" role="status"></p><ul id="speciesResults" class="timeline"></ul></section>`;
  }
  const speciesSearch = PondSpecies.createSearch(SPECIES_LIST, (...args) => fetch(...args));
  function searchSpecies(q) {
    speciesSearch(q, (rows, status) => {
      if (page !== 'tools' || !$('speciesResults')) return;
      $('speciesStatus').textContent = status;
      const unique = [...new Map(rows.map(r => [r.scientific, r])).values()];
      $('speciesResults').innerHTML = unique.map(r => `<li class="row"><div><h3>${esc(r.common || r.scientific)}</h3><p>${esc(r.scientific)}</p></div>${button('Use in stock draft', 'use-species', `data-common="${esc(r.common)}" data-scientific="${esc(r.scientific)}"`)}</li>`).join('') || empty('No matching species. You can enter a species name directly in Ponds.');
    });
  }
  function settingsView() {
    const trash = D.COLLECTIONS.flatMap(col => state.data[col].filter(r => r.deletedAt).map(r => ({ ...r, col })));
    return head('Help & settings', 'This notebook is stored on this browser and origin. It has no account or cloud sync.') + `<section class="panel"><h2>Backup and recovery</h2><p>${store.blocked ? 'Recovery required' : opened.status === 'migration' ? 'Awaiting migration approval' : 'Local workspace readable'} • Revision ${state.revision} • ${demo ? 'Demo' : 'Farm'} workspace</p><p>Export a backup before clearing browser data or changing devices. Backups include all ponds, archives and trash; they never change your tier. Keep each download in a safe location.</p><p>Last backup download requested: ${esc(lastBackup())}</p><div class="actions">${button('Download backup', 'export')}${button('Export drafts', 'draft-export')}${button('Export original legacy data', 'legacy-export')}${button('Preview rollback snapshot', 'rollback')}${button('Download raw rollback snapshot', 'rollback-export')}</div><div class="field" style="margin-top:20px"><label for="restoreFile">Preview replacement backup (JSON, maximum 5 MiB)</label><input id="restoreFile" type="file" accept=".json,application/json"></div><div id="restorePreview" role="status">${previewHTML()}</div></section><section class="panel"><h2>Farm settings</h2>${form('settings', field('timezone', 'Farm timezone (IANA name, required)', 'text', state.settings.timezone, 'required maxlength="100"'), 'Save timezone')}</section><section class="panel"><h2>Trash</h2><p>Items stay recoverable until restored. Trashed ponds retain every dependent task, observation and transaction. There is no automatic purge.</p>${trash.map(r => `<div class="row"><div><h3>${esc(r.col === 'ponds' ? r.name : describe(r))}</h3><p>${esc(r.col)} • ${esc(r.deletedAt)}</p></div>${button('Recover', 'recover', `data-col="${r.col}" data-id="${esc(r.id)}"`)}</div>`).join('') || empty('Trash is empty.')}</section><section class="panel"><h2>Rule-based pond guide</h2><p>This guide uses keywords and your saved observations. It cannot diagnose disease.</p><form id="helper"><label for="question">Ask about feed, water, stock, tasks or backups</label><input id="question" name="question" maxlength="200" required><div class="actions"><button class="primary" type="submit">Show guidance</button></div></form><div id="helperAnswer" class="helper-answer" role="status"></div></section><section class="panel"><h2>Practice separately</h2><p>Demo records use a separate storage key. Returning to your farm leaves both workspaces intact.</p>${button(demo ? 'Return to farm notebook' : 'Open demo workspace', 'workspace')}</section>`;
  }
  function lastBackup() { try { return localStorage.getItem(store.key + '_last_export') || 'No download requested in this browser'; } catch (_) { return 'Unavailable'; } }
  function previewHTML() { return preview ? `<h3>Replacement preview</h3><p>${esc(counts(preview))}</p><p>${preview.data.ponds.filter(p => !p.archived && !p.deletedAt).length} active ponds; tier limit ${D.limit(tier)}. Over-limit data will be retained, with creation/reactivation blocked. This replaces only the ${demo ? 'demo' : 'farm'} workspace and retains a rollback snapshot. Existing drafts will stay available.</p><div class="actions">${button('Restore this backup', 'restore', '', 'primary')}${button('Cancel restore', 'restore-cancel')}</div>` : ''; }
  function plansView() { return head('Plan preview', 'Browser-selected tiers only. No billing, account or payment processing.') + `<div class="cards">${[['start', 'PondStart', '1 active pond'], ['pro', 'PondPro', '5 active ponds'], ['elite', 'PondElite', 'Unlimited active ponds']].map(([id, name, benefit]) => `<section class="panel ${tier === id ? 'plan-selected' : ''}"><h2>${name}</h2><p>${benefit}</p><p>All tiers: observations, tasks, feed calculator, readable history, backup and recovery.</p><p>${id === 'start' ? 'Existing money records remain readable.' : 'Money entry and correction.'}</p>${button(tier === id ? 'Current preview' : 'Choose ' + name, 'plan', `data-tier="${id}" ${tier === id ? 'disabled' : ''}`)}</section>`).join('')}</div><p class="muted" style="margin-top:24px">Changing tiers preserves all saved data. Limits apply to creation and reactivation; replacement restores preserve over-limit ponds.</p>`; }
  function moreView() { return head('More', 'Tools and settings for your pond notebook.') + `<div class="panel actions">${link('Money', 'money')}${link('Tools', 'tools')}${link('Help & settings', 'settings')}${link('Plan preview', 'plans')}</div>`; }
  function formError(form, error) {
    form.querySelectorAll('.field-error').forEach(e => e.remove()); form.querySelectorAll('[aria-invalid]').forEach(e => { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-describedby'); });
    const summary = form.querySelector('.form-error'); summary.hidden = false; summary.textContent = 'Not saved. ' + error.message;
    const input = error.field && form.elements.namedItem(error.field);
    if (input) { input.setAttribute('aria-invalid', 'true'); const help = document.createElement('span'); help.id = input.id + '-error'; help.className = 'field-error'; help.textContent = error.message; input.setAttribute('aria-describedby', help.id); input.after(help); }
    summary.focus(); notify('Not saved. Your draft is preserved. ' + error.message, true); capture();
  }
  function values(form) { return Object.fromEntries(new FormData(form)); }
  function n(value) { return value === '' || value === undefined ? null : Number(value); }
  document.addEventListener('input', event => { const form = event.target.closest('form[data-draft]'); if (form) { form.dataset.dirty = 'true'; capture(); } });
  document.addEventListener('submit', event => {
    event.preventDefault(); const form = event.target; const v = values(form);
    try {
      if (form.id === 'helper') { helper(v.question); return; }
      if (form.id === 'calculator') { const r = D.recommendation(n(v.count), n(v.avgWeightG), n(v.rate)); if (r.kg === undefined) D.fail('count', r.warnings[0]); $('feedResult').innerHTML = feedText({ stock: { count: n(v.count), avgWeightG: n(v.avgWeightG) } }, n(v.rate)); return; }
      capture(); const next = clone(state), p = active(), timestamp = now();
      if (form.id === 'settings') next.settings.timezone = D.timezone(v.timezone.trim());
      else if (form.id === 'pond-create') {
        if (!D.canActivate(next.data, tier)) throw new Error('Active pond limit reached. Archive a pond or change the preview tier.');
        const pond = { id: crypto.randomUUID(), name: v.name, size: n(v.size), notes: v.notes, archived: false, deletedAt: null, createdAt: timestamp, updatedAt: timestamp, stock: { common: '', scientific: '', count: null, avgWeightG: null, updatedAt: null } };
        next.data.ponds.push(pond); next.data.activePondId = pond.id;
      } else if (form.id === 'pond-edit') {
        requirePond(); const target = next.data.ponds.find(r => r.id === p.id);
        Object.assign(target, { name: v.name, size: n(v.size), notes: v.notes, updatedAt: timestamp, stock: { common: v.common, scientific: v.scientific, count: n(v.count), avgWeightG: n(v.avgWeightG), updatedAt: timestamp } });
      } else {
        const col = form.id.slice(6); if (!D.COLLECTIONS.slice(1).includes(col)) throw new Error('Unknown form.');
        if (['expenses', 'sales'].includes(col) && tier === 'start') throw new Error('Choose Pro or Elite preview to change money records.');
        const id = form.dataset.editing, old = id ? next.data[col].find(r => r.id === id) : null;
        if (id && !old) throw new Error('The record being edited no longer exists.');
        if (!old) requirePond();
        const row = { ...(old || { id: crypto.randomUUID(), pondId: p.id, createdAt: timestamp, deletedAt: null }), updatedAt: timestamp, date: v.date };
        if (col === 'tasks') Object.assign(row, { title: v.title, type: v.type, done: old?.done || false, completedAt: old?.completedAt || null });
        if (col === 'feedLogs') Object.assign(row, { kg: v.skipped ? 0 : n(v.kg), skipped: !!v.skipped, notes: v.notes });
        if (col === 'waterLogs') Object.assign(row, { ph: n(v.ph), temp: n(v.temp), notes: v.notes });
        if (['healthLogs', 'maintLogs'].includes(col)) row.note = v.note;
        if (['expenses', 'sales'].includes(col)) Object.assign(row, { item: v.item, category: v.category, amountCentavos: D.money(v.amount) });
        if (old) next.data[col] = next.data[col].map(r => r.id === id ? row : r); else next.data[col].push(row);
      }
      // Remove the old pond's draft only after the write succeeds, even when creating a new active pond.
      const key = draftKey(form), savedCol = form.id.startsWith('entry-') ? form.id.slice(6) : null, savedPondId = savedCol && form.dataset.editing ? next.data[savedCol].find(r => r.id === form.dataset.editing)?.pondId : next.data.activePondId; commit(next, 'Saved ' + (savedCol ? labels[savedCol].toLowerCase() + ' for ' + pondName(savedPondId) : 'changes') + '.', form); delete drafts[key];
      day = D.today(state.settings.timezone); render(false);
    } catch (e) { formError(form, e); }
  });
  async function download(text, name) { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function action(el) {
    const a = el.dataset.action, id = el.dataset.id, col = el.dataset.col;
    capture();
    if (a === 'add-record') { if (page === 'records') { $('recordType').focus(); } else location.hash = 'records'; return; }
    if (a === 'workspace') { editing = null; preview = null; openWorkspace(!demo); if (demo && opened.status === 'new') seedDemo(); render(false); notify(demo ? 'Opened the separate demo workspace.' : 'Returned to your farm notebook.'); return; }
    if (a === 'export') { if (store.blocked) throw new Error('Export raw workspace while in recovery.'); await download(store.export(), `pondwise-${demo ? 'demo' : 'farm'}-${day}-r${state.revision}.json`); try { localStorage.setItem(store.key + '_last_export', now()); } catch (_) { /* export already requested */ } notify('Backup download requested. Check your downloads and keep the file safe.'); return; }
    if (a === 'raw' || a === 'legacy-export') { const raw = localStorage.getItem(a === 'legacy-export' || opened.status === 'migration' ? S.LEGACY : store.recoveryKey); if (raw === null) throw new Error('No original data exists for this key.'); download(raw, 'pondwise-original-' + day + '.json'); return; }
    if (a === 'draft-export') { download(JSON.stringify(drafts, null, 2), 'pondwise-drafts-' + day + '.json'); notify('Draft download requested. This is a reference file, not a restorable notebook backup.'); return; }
    if (a === 'reload') { openWorkspace(demo); render(false); notify('Saved workspace reloaded. Drafts retained.'); return; }
    if (a === 'migrate') { commit(state, 'Migration verified. Original legacy data remains available.', null, true); return; }
    if (a === 'rollback-export') { const raw = localStorage.getItem(store.key + '_rollback'); if (raw === null) throw new Error('No rollback snapshot exists.'); download(raw, 'pondwise-rollback-' + day + '.json'); return; }
    if (a === 'rollback') { restoreGeneration++; preview = store.rollback(); render(); return; }
    if (a === 'restore-cancel') { restoreGeneration++; preview = null; render(); return; }
    if (a === 'restore') { if (!preview) return; commit(preview, 'Backup restored and verified. Previous workspace retained as rollback.', null, true); preview = null; day = D.today(state.settings.timezone); render(); return; }
    if (a === 'plan') { localStorage.setItem(planKey(), D.plan(el.dataset.tier)); tier = D.plan(el.dataset.tier); render(); notify('Preview tier changed. All existing data was kept.'); return; }
    if (a === 'discard') { const form = $(el.dataset.form); delete drafts[draftKey(form)]; form.dataset.dirty = 'false'; editing = null; render(false); notify('Draft discarded.'); return; }
    if (a === 'species-search') { searchSpecies($('speciesSearch').value); return; }
    if (a === 'use-species') {
      requirePond(); const key = [demo ? 'demo' : 'farm', state.data.activePondId, 'pond-edit'].join(':');
      const p = active(); const values = drafts[key]?.values || { name: p.name, size: p.size ?? '', notes: p.notes, count: p.stock.count ?? '', avgWeightG: p.stock.avgWeightG ?? '' };
      drafts[key] = { values: { ...values, common: el.dataset.common, scientific: el.dataset.scientific }, editing: '' }; location.hash = 'ponds'; notify('Species added to this pond’s stock draft. Save it in Ponds.'); return;
    }
    if (a === 'filter' || a === 'filter-reset') {
      const kind = el.dataset.kind, f = filters[kind];
      if (a === 'filter-reset') Object.assign(f, { scope: '', q: '', type: '', from: '', to: '', page: 1 });
      else { const container = el.closest('[data-filters]'); container.querySelectorAll('[data-filter]').forEach(i => { f[i.dataset.filter] = i.value; }); if ((f.from && !D.validDate(f.from)) || (f.to && !D.validDate(f.to)) || (f.from && f.to && f.from > f.to)) throw new Error('Choose a valid date range with From before Through.'); f.page = 1; }
      render(); return;
    }
    if (a === 'page') { filters[el.dataset.kind].page += Number(el.dataset.step); render(); return; }
    if (a === 'record-type') { recordType = col; editing = null; location.hash = 'records'; return; }
    if (a === 'money-type') { moneyType = col; editing = null; render(); return; }
    if (a === 'day' || a === 'month' || a === 'today') {
      if (a === 'day') selectedDay = el.dataset.date;
      if (a === 'month') { const [y, m] = cursor.split('-').map(Number); const target = calendarUTC(y, m - 1 + Number(el.dataset.step), 1).toISOString().slice(0, 7); if (!/^\d{4}-\d{2}$/.test(target) || target < '0001-01' || target > '9999-12') throw new Error('Calendar supports years 0001–9999.'); cursor = target; }
      if (a === 'today') { selectedDay = day; cursor = day.slice(0, 7); }
      render(); const details = document.querySelector('details'); if (details) details.open = true; [...document.querySelectorAll('[data-action]')].find(e => e.dataset.action === a && (a !== 'month' || e.dataset.step === el.dataset.step) && (a !== 'day' || e.dataset.date === selectedDay))?.focus({ preventScroll: true });
      if (a !== 'month') { const input = document.querySelector('#entry-tasks [name=date]'); if (input) { input.value = selectedDay; const form = input.form; form.dataset.dirty = 'true'; capture(); } } return;
    }
    if (a === 'edit') {
      if (!D.COLLECTIONS.slice(1).includes(col)) throw new Error('Unknown collection.');
      if (['expenses', 'sales'].includes(col) && tier === 'start') throw new Error('Choose Pro or Elite preview to correct money records.');
      const row = state.data[col].find(r => r.id === id); if (!row) throw new Error('Record not found.');
      const target = col === 'tasks' ? 'tasks' : ['expenses', 'sales'].includes(col) ? 'money' : 'records';
      const key = [demo ? 'demo' : 'farm', state.data.activePondId || 'none', 'entry-' + col].join(':');
      if (drafts[key] && !confirm('Replace the existing ' + labels[col] + ' draft with this record for editing?')) return;
      delete drafts[key]; document.querySelectorAll('form[data-draft]').forEach(f => { if (draftKey(f) === key) f.dataset.dirty = 'false'; }); editing = { col, id }; if (['expenses', 'sales'].includes(col)) moneyType = col; else if (col !== 'tasks') recordType = col;
      page = target; if (location.hash !== '#' + target) { location.hash = target; } else render(false);
      return;
    }
    const next = clone(state);
    if (a === 'select-pond') { if (!next.data.ponds.some(p => p.id === id && !p.archived && !p.deletedAt)) throw new Error('Select an active pond.'); next.data.activePondId = id; editing = null; }
    else if (a === 'archive') { const p = next.data.ponds.find(p => p.id === id); if (!p) throw new Error('Pond not found.'); if (p.archived && !D.canActivate(next.data, tier)) throw new Error('Pond limit reached. Archive another pond or change preview tier.'); p.archived = !p.archived; p.updatedAt = now(); }
    else if (a === 'task-toggle') { next.data.tasks = next.data.tasks.map(t => t.id === id ? D.toggleTask(t) : t); }
    else if (a === 'trash' || a === 'recover') {
      if (a === 'trash' && col === 'ponds') { const count = D.COLLECTIONS.slice(1).reduce((n, key) => n + state.data[key].filter(r => r.pondId === id).length, 0); if (!confirm(`Move this pond with ${count} dependent records to recoverable trash?`)) return; }
      commit(D.setDeleted(next, col, id, a === 'trash', tier), a === 'trash' ? 'Moved to trash. Recover it in Help & settings.' : 'Recovered from trash.'); if (a === 'trash') $('notice').insertAdjacentHTML('beforeend', button('Undo', 'recover', `data-col="${col}" data-id="${esc(id)}"`)); return;
    } else return;
    commit(next, a === 'task-toggle' ? 'Task updated. No observation record was created.' : 'Pond context updated. Drafts remain with their original pond.');
  }
  document.addEventListener('click', event => { if (event.target.closest('.skip')) { event.preventDefault(); $('main').focus(); return; } const el = event.target.closest('[data-action]'); if (el) action(el).catch(e => notify('Not saved. ' + e.message, true)); });
  document.addEventListener('change', async event => {
    let restoreToken = null;
    const targetStore = store;
    try {
      if (event.target.id === 'calendarDate') { if (!D.validDate(event.target.value)) throw new Error('Choose a valid task date.'); selectedDay = event.target.value; cursor = selectedDay.slice(0, 7); const input = document.querySelector('#entry-tasks [name=date]'); if (input) { input.value = selectedDay; input.form.dataset.dirty = 'true'; } render(); document.querySelector('details').open = true; }
      if (event.target.id === 'pondContext') { capture(); const next = clone(state); next.data.activePondId = event.target.value; editing = null; commit(next, 'Active pond changed. Drafts stay with their original pond.'); }
      if (event.target.id === 'recordType') { capture(); recordType = event.target.value; editing = null; render(false); }
      if (event.target.id === 'restoreFile') {
        const file = event.target.files[0]; if (!file) return; restoreToken = ++restoreGeneration; preview = null;
        if (file.size > 5 * 1024 * 1024) throw new Error('Backup exceeds the 5 MiB limit.');
        $('restorePreview').textContent = 'Reading and validating backup…'; let raw;
        try { raw = await file.text(); } catch (_) { throw new Error('Could not read the selected file. Select it again.'); }
        if (restoreToken !== restoreGeneration || store !== targetStore || page !== 'settings') return;
        preview = D.parse(raw); $('restorePreview').innerHTML = previewHTML();
      }
    } catch (e) { if (restoreToken !== null && (restoreToken !== restoreGeneration || store !== targetStore || page !== 'settings')) return; if ($('restorePreview') && event.target.id === 'restoreFile') $('restorePreview').textContent = 'Backup rejected. ' + e.message; notify('Not saved. ' + e.message, true); nav(); }
  });
  function helper(q) {
    const p = active(), text = q.toLowerCase(), box = $('helperAnswer');
    let answer = `<p>Context: ${esc(p?.name || 'No active pond')}; farm date ${day}.</p>`;
    if (/sick|die|dying|dead|disease|health|gasp/.test(text)) answer += '<p>Check fish behavior, oxygen availability and recent water observations. Pause automatic feeding decisions when fish are distressed. Contact local aquaculture support for assessment before treatment.</p>' + waterText(p ? D.latestWater(state.data, p.id) : null);
    else if (/feed|ration|food/.test(text)) answer += feedText(p);
    else if (/water|ph|temperature/.test(text)) answer += waterText(p ? D.latestWater(state.data, p.id) : null);
    else if (/stock|fish|species/.test(text)) answer += '<p>Save a count and average weight in Ponds. This is a snapshot, not a stocking-cycle ledger.</p>' + link('Open pond stock', 'ponds');
    else if (/task|work/.test(text)) answer += '<p>Tasks can be due in the future. Completing one saves its completion time and leaves observations separate.</p>' + link('Open tasks', 'tasks');
    else if (/backup|restore|export/.test(text)) answer += '<p>Use Backup and recovery above. Preview a restore before committing; the previous workspace is retained as rollback.</p>';
    else answer += '<p>I can show saved pond context and guidance about feed, water, stock, tasks and backups. Try “latest water” or “feed estimate”.</p>';
    box.innerHTML = answer;
  }
  function seedDemo() {
    const next = D.blank(), timestamp = now();
    [['Tilapia pond', 'Nile tilapia', 800, 150], ['Catfish pond', 'African catfish', 1200, 90], ['Carp pond', 'Common carp', 300, 250]].forEach(([name, common, count, avgWeightG]) => next.data.ponds.push({ id: crypto.randomUUID(), name, notes: 'Practice pond', size: 400, archived: false, deletedAt: null, createdAt: timestamp, updatedAt: timestamp, stock: { common, scientific: '', count, avgWeightG, updatedAt: timestamp } }));
    next.data.activePondId = next.data.ponds[0].id;
    next.data.tasks.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, title: 'Observe fish appetite', type: 'inspection', date: day, done: false, completedAt: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    next.data.waterLogs.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, date: day, ph: 7.2, temp: 28, notes: 'Demo observation', createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    state = store.commit(next); opened = { status: 'ready' };
  }
  function ensureFocusVisible() {
    const control = document.activeElement;
    if (!control?.matches('input,textarea,select,button,a') || control.closest('.sidebar,.mobile-nav,.context')) return;
    requestAnimationFrame(() => {
      const rect = control.getBoundingClientRect(), top = document.querySelector('.context').getBoundingClientRect().bottom;
      const bar = $('mobileNav'), navHeight = getComputedStyle(bar).display === 'none' ? 0 : bar.getBoundingClientRect().height;
      const bottom = Math.min(innerHeight, window.visualViewport ? window.visualViewport.height + window.visualViewport.offsetTop : innerHeight) - navHeight;
      if (rect.top < top + 8 || rect.bottom > bottom - 8) control.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  document.addEventListener('focusin', ensureFocusVisible);
  window.visualViewport?.addEventListener('resize', ensureFocusVisible);
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', event => { if (event.key === store.key || event.key === null || (!demo && opened.status === 'migration' && event.key === S.LEGACY)) { capture(); conflict = true; nav(); notify('Another tab changed storage. Export drafts and reload before saving.', true); } if (event.key === planKey()) { tier = D.plan(event.newValue); render(); } });
  window.addEventListener('beforeunload', event => { capture(); if (Object.keys(drafts).length) { event.preventDefault(); event.returnValue = ''; } });
  setInterval(() => { const current = D.today(state.settings.timezone); if (current !== day) { day = current; render(); notify('Farm date updated. Existing draft dates were preserved.'); } }, 30000);
  openWorkspace(false); route();
})();
