/* PondWise UI: no inline handlers, no framework, no build step. */
(() => {
  'use strict';
  const D = PondDomain, S = PondStorage, $ = id => document.getElementById(id);
  const titles = { overview: 'Overview', ponds: 'Ponds', tasks: 'Tasks', records: 'Records', money: 'Money', tools: 'Feed & tools', helper: 'Helper', profile: 'Profile', settings: 'Settings', plans: 'Plans', more: 'More' };
  const aliases = { dashboard: 'overview', feed: 'tools', finance: 'money', guide: 'settings', help: 'helper' };
  const labels = { feedLogs: 'Feeding', waterLogs: 'Water', healthLogs: 'Fish health', maintLogs: 'Maintenance', expenses: 'Bought', sales: 'Sold', tasks: 'Task' };
  const now = () => new Date().toISOString();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = v => structuredClone(v);
  let demo = false, store, state, opened, page = 'overview', drafts = {}, editing = null, recordType = 'feedLogs', moneyType = 'expenses', preview = null, restoreGeneration = 0, selectedDay = null, cursor = null, day = '', conflict = false;
  const filters = { records: { scope: '', q: '', type: '', from: '', to: '', page: 1 }, money: { scope: '', q: '', type: '', from: '', to: '', page: 1 }, tasks: { scope: '', q: '', type: '', from: '', to: '', page: 1 } };
  const browserStorage = { getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key) };
  let tier = 'start';
  function access() { return D.capabilities(tier); }
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
  function button(label, action, data = '', cls = '') { return `<button type="button" class="${cls}" data-action="${action}" ${data}>${actionIcons[action] ? icon(actionIcons[action]) : ''}${esc(label)}</button>`; }
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
  const icon = name => PondIcons(name);
  const actionIcons = { 'add-record':'plus', 'pond-create':'plus', 'record-type':'plus', 'money-type':'wallet', 'export':'cloud-download', 'draft-export':'cloud-download', 'rollback':'backup', 'plan':'crown', 'purchase':'credit-card', 'edit':'pencil', 'trash':'trash-2', 'recover':'rotate-ccw', 'archive':'archive', 'filter':'filter', 'filter-reset':'rotate-ccw', 'workspace':'fish', 'species-search':'search', 'task-toggle':'check' };
  function nav() {
    $('desktopNav').innerHTML = Object.entries(titles).filter(([k]) => k !== 'more').map(([k, v]) => `<a href="#${k}" ${page === k ? 'aria-current="page"' : ''}>${icon(k)}<span>${v}</span></a>`).join('');
    $('mobileNav').innerHTML = [['overview', 'Home', 'home'], ['ponds', 'Ponds', 'ponds'], ['records', 'Add record', 'plus'], ['tasks', 'Tasks', 'tasks'], ['more', 'More', 'more']].map(([k, v, i]) => `<a href="#${k}" class="${k === 'records' ? 'nav-add' : ''}" ${k === 'records' ? 'data-action="add-record"' : ''} ${(page === k || (k === 'more' && ['money', 'tools', 'helper', 'profile', 'settings', 'plans'].includes(page))) ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(i)}</span><span>${v}</span></a>`).join('');
    const available = state.data.ponds.filter(p => !p.archived && !p.deletedAt);
    $('pondContext').innerHTML = available.length ? available.map(p => `<option value="${esc(p.id)}" ${p.id === state.data.activePondId ? 'selected' : ''}>${esc(p.name)}</option>`).join('') : '<option value="">No active ponds</option>';
    $('pondContext').disabled = !usable() || !available.length;
    $('workspaceBanner').hidden = usable();
    let banner = '';

    if (opened.status === 'migration') banner += `<p><strong>Legacy data found.</strong> Review ${counts(state)}. Valid amounts convert to centavos; historical dates stay unchanged; completion times remain unknown. The original pondwise_v1 will remain untouched.</p>${button('Migrate safely', 'migrate', '', 'primary')}${button('Export original data', 'raw')}`;
    if (store.blocked) banner += `<p><strong>Recovery required.</strong> ${esc(opened.error?.message || 'Storage unavailable.')} Ordinary saves are blocked. Export original data, then use Help & settings to restore a validated backup.</p>${button('Export raw workspace', 'raw')}${link('Open recovery tools', 'settings')}`;
    if (conflict) banner += `<p><strong>Workspace changed in another tab.</strong> Saves are paused. Drafts are retained here; download them before reloading.</p>${button('Export drafts', 'draft-export')}${button('Reload saved workspace', 'reload')}`;
    $('workspaceBanner').innerHTML = banner; $('workspaceBanner').dataset.status = demo && usable() ? 'demo' : 'attention';
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
    if (preserve) capture();
    const signedIn = PondAccount.signedIn(), legal = ['terms', 'privacy'].includes(location.hash.slice(1));
    document.body.classList.toggle('signed-out', !signedIn);
    if (!signedIn || legal) {
      $('main').dataset.page = legal ? 'legal' : 'signup';
      $('main').innerHTML = legal ? PondAccount.legalView(location.hash.slice(1)) : PondAccount.authView();
      $('notice').textContent = ''; $('planOffer').innerHTML = ''; if ($('purchaseDialog').open) $('purchaseDialog').close(); polish(); return;
    }
    nav();
    const routes = { overview: overviewView, ponds: pondsView, tasks: tasksView, records: recordsView, money: moneyView, tools: toolsView, helper: helperView, settings: settingsView, profile: () => PondAccount.profileView(tier), plans: plansView, more: moreView };
    $('main').dataset.page = page; $('main').innerHTML = routes[page](); hydrate(); polish(); renderOffer(); mountChat();
    document.querySelectorAll('form[data-draft]').forEach(form => { if (!usable()) form.querySelectorAll('button[type=submit]').forEach(b => { b.disabled = true; }); });
    if (page === 'tools') searchSpecies('');
    const focusTarget = focusId ? $(focusId) : focusData ? [...document.querySelectorAll('[data-action]')].find(e => Object.entries(focusData).every(([k, v]) => e.dataset[k] === v)) : null;
    if (focusTarget) focusTarget.focus({ preventScroll: true }); else if (focused?.closest('main')) $('main').focus({ preventScroll: true });
    if (editing) document.querySelector('form[data-editing]:not([data-editing=""])')?.scrollIntoView({ block: 'start' });
  }
  function route() {
    capture(); $('notice').textContent = ''; const hash = location.hash.slice(1); page = aliases[hash] || (titles[hash] ? hash : 'overview'); render(false); $('main').focus({ preventScroll: true }); if (!editing) window.scrollTo({ top: 0, behavior: 'instant' });
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
    const p = active(), tasks = D.live(state.data.tasks).filter(t => t.pondId === p?.id);
    const due = tasks.filter(t => !t.done && t.date <= day).sort((a,b) => a.date.localeCompare(b.date));
    const water = p ? D.latestWater(state.data, p.id) : null;
    const feed = D.live(state.data.feedLogs).filter(r => r.pondId === p?.id && r.date === day).reduce((sum,r) => sum+r.kg,0);
    const rec = D.recommendation(p?.stock.count ?? null,p?.stock.avgWeightG ?? null);
    const stat = (name,value,unit,i,help) => `<section class="pond-stat"><div class="stat-label">${icon(i)}<span>${name}</span>${PondUI.info(name,help)}</div><div class="stat-value">${esc(value)} <span>${unit}</span></div></section>`;
    return `<div class="overview-heading"><div><p class="date-line">${esc(new Intl.DateTimeFormat('en',{dateStyle:'full',timeZone:state.settings.timezone}).format(new Date()))}</p><h1>${p ? 'Today at '+esc(p.name) : 'Your pond, at a glance'}</h1></div><a class="button" href="#ponds">${icon('ponds')}Manage ponds</a></div>
    ${!p ? `<section class="panel start-pond"><h2>Start with your first pond</h2><a class="button primary" href="#ponds">${icon('plus')}Create a pond</a></section>` : ''}
    <div class="pond-stats">${stat('Feed today',p ? feed.toFixed(2) : '—','kg','feed','Total feed recorded for the selected pond today.')}${stat('Daily estimate',access().autoCalculator ? (rec.kg === undefined ? '—' : rec.kg.toFixed(2)) : 'Elite',access().autoCalculator ? 'kg' : '', 'tools','Estimated from the saved stock count and average weight. Automatic estimates require PondElite; use the manual estimator on any plan.')}${stat('Latest water pH',water?.ph ?? '—','', 'water',water ? 'Recorded '+water.date+'. Saved observation, not a live sensor reading.' : 'No water reading recorded. Add a water check.')}${stat('Work due',due.length,due.length === 1 ? 'task' : 'tasks','tasks','Incomplete tasks due today or earlier for the selected pond.')}</div>
    <div class="overview-grid"><div class="overview-work"><section class="panel agenda-panel"><div class="section-heading"><h2>Needs your attention</h2><a href="#tasks">All tasks ${icon('right')}</a></div>${due.length ? due.slice(0,5).map(taskRow).join('') : `<div class="quiet-empty">${icon('check')}<h3>You’re all caught up</h3><a href="#tasks">Plan your next task</a></div>`}</section>
    <section class="panel water-panel"><div class="section-heading"><h2>Water observations</h2>${button('Record check','record-type','data-col="waterLogs"')}</div>${waterText(water)}</section>
    <section class="panel"><div class="section-heading"><h2>Recent activity</h2><a href="#records">All records ${icon('right')}</a></div>${historyRows(allRows().filter(r => r.pondId === p?.id).slice(0,4),false)}</section></div><div class="overview-assistant">${chatShell(true)}</div></div>`;
  }
  function chatShell(compact = false) {
    return `<section class="chat-shell ${compact ? 'chat-compact' : ''}" aria-label="PondWise Helper"><header class="chat-header"><span class="helper-emblem">${icon('help')}</span><div><h2>PondWise Helper</h2><span class="chat-pond">${esc(active()?.name || 'General conversation')}</span></div>${PondUI.info('About Helper','Powered by Meta Muse Spark 1.3 Contributor. Your messages and the selected pond’s stock, recent observations and tasks are sent to Meta for answers and may be used for model training. Your profile, password and financial records are excluded. Answers can be mistaken; check important decisions.')}${compact ? '<a class="icon-button" href="#helper" aria-label="Open full conversation">'+icon('arrow-up-right')+'</a>' : '<button type="button" class="button" data-chat-new>New chat</button>'}</header><div data-chat-root></div></section>`;
  }
  function helperView() { return head('A little help for your pond') + chatShell(); }
  function mountChat() {
    const root = document.querySelector('[data-chat-root]'); if (!root) return;
    const p = active();
    const recent = col => D.live(state.data[col]).filter(r => r.pondId === p?.id).sort((a,b) => b.date.localeCompare(a.date)).slice(0,12).map(({id,pondId,createdAt,updatedAt,deletedAt,...r}) => r);
    PondChat.mount(root, {key:[PondAccount.isDemo() ? 'shared' : 'personal',demo ? 'practice' : 'farm',p?.id || 'general'].join(':'), pondName:p?.name || '', context:{date:day, timezone:state.settings.timezone,pond:p ? {name:p.name,size:p.size,stock:p.stock,notes:p.notes} : null,water:recent('waterLogs'),feed:recent('feedLogs'),health:recent('healthLogs'),tasks:recent('tasks')},compact:page === 'overview'});
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
    const cards = state.data.ponds.filter(p => !p.deletedAt).map(p => `<article class="panel pond-card"><div class="pond-card-art" aria-hidden="true">${icon('fish')}${icon('waves')}</div><span class="pill">${p.archived ? 'Archived' : p.id === state.data.activePondId ? 'Active pond' : 'Pond'}</span><h2 class="wrap">${esc(p.name)}</h2><p>${p.size === null ? 'Area not recorded' : esc(p.size) + ' m²'}<br>${esc(p.stock.common || p.stock.scientific || 'Species not recorded')}<br>${p.stock.count === null ? 'Count missing' : esc(p.stock.count) + ' fish'}; ${p.stock.avgWeightG === null ? 'weight missing' : esc(p.stock.avgWeightG) + ' g average'}</p><small>Stock updated: ${esc(p.stock.updatedAt || 'Unknown (legacy or not yet recorded)')}</small><div class="actions">${!p.archived ? button('Select pond', 'select-pond', `data-id="${esc(p.id)}"`) : ''}${button(p.archived ? 'Reactivate' : 'Archive', 'archive', `data-id="${esc(p.id)}"`)}${button('Move to trash', 'trash', `data-col="ponds" data-id="${esc(p.id)}"`, 'danger')}</div></article>`).join('');
    return head('Ponds', `${count} active ponds. ${tier === 'elite' ? 'Unlimited' : D.limit(tier)} allowed on ${tier}. Existing ponds survive tier changes.`) + `<div class="cards">${cards || empty('No ponds yet. Create one below.')}</div><section class="panel" style="margin-top:24px"><h2>Create a pond</h2>${form('pond-create', field('name', 'Pond name (required)', 'text', '', 'required maxlength="120"') + num('size', 'Area (m², optional)', '', 0, Number.MAX_VALUE, true) + field('notes', 'Notes (optional)', 'textarea', '', 'maxlength="2000"', true), 'Create pond')}</section>${p ? `<section class="panel"><h2>Edit ${esc(p.name)} and fish stock</h2><p>Fish stock is a current snapshot. Sold entries and health notes do not change the count automatically.</p>${form('pond-edit', field('name', 'Pond name (required)', 'text', p.name, 'required maxlength="120"') + num('size', 'Area (m², optional)', p.size, 0, Number.MAX_VALUE, true) + field('notes', 'Pond notes (optional)', 'textarea', p.notes, 'maxlength="2000"', true) + field('common', 'Common species name (optional)', 'text', p.stock.common, 'maxlength="200"') + field('scientific', 'Scientific name (optional)', 'text', p.stock.scientific, 'maxlength="200"') + num('count', 'Fish count (optional; whole fish)', p.stock.count, 0, 10000000, true, '1') + num('avgWeightG', 'Average weight (g, optional)', p.stock.avgWeightG, 0, 1000000, true), 'Save pond and fish')}<div class="actions">${link('Look up a species', 'tools')}${button('Remove fish from pond', 'clear-stock', `data-id="${esc(p.id)}"`, 'danger')}</div><h3>Automatic feed estimate</h3>${access().autoCalculator ? feedText(p) : `<p class="empty">PondElite is required for automatic pond calculations. The manual Feed Estimator and standard feed table remain available in Tools.</p>`}</section>` : ''}`;
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
    return `<ul class="timeline">${rows.map(r => `<li class="row" data-record-kind="${esc(r.col)}"><div><span class="pill">${icon(({feedLogs:'feed',waterLogs:'water',healthLogs:'heart-pulse',maintLogs:'tools',expenses:'money',sales:'money'})[r.col])}${esc(labels[r.col])}</span><h3>${esc(describe(r))}</h3><p>${esc(r.date)} • ${esc(pondName(r.pondId))}${r.category ? ' • ' + esc(r.category) : ''}</p>${r.notes ? `<p class="wrap">${esc(r.notes)}</p>` : ''}</div>${actions ? `<div class="actions">${button('Edit', 'edit', `data-col="${r.col}" data-id="${esc(r.id)}"`)}${button('Trash', 'trash', `data-col="${r.col}" data-id="${esc(r.id)}"`, 'danger')}</div>` : ''}</li>`).join('')}</ul>`;
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
    const allowed = access().money;
    return head('Money Calculator', 'Bought, sold and profit for the selected scope. Profit here means sold minus bought; it is not full accounting profit.') +
      `<section class="panel"><h2>Bought, sold and profit</h2>${filterView('money')}<div class="metrics"><div class="metric"><strong>${currency(totals.expenses)}</strong><span>Bought</span></div><div class="metric"><strong>${currency(totals.income)}</strong><span>Sold</span></div><div class="metric"><strong class="${totals.net < 0 ? 'negative' : ''}">${currency(totals.net)}</strong><span>Profit (sold − bought)</span></div></div><p class="muted">Totals use the selected pond, dates, type and search filters above. ${rows.length} matching transactions.</p>${paginate(rows, 'money')}</section>` +
      (allowed ? `<div class="actions">${button('Record bought item', 'money-type', 'data-col="expenses"')}${button('Record sold item', 'money-type', 'data-col="sales"')}</div>${entryForm(moneyType)}` : `<section class="panel"><h2>Money Calculator requires PondPro or PondElite</h2><p>Existing transactions remain readable after a downgrade. Change your plan to add or correct bought and sold entries.</p>${link('Compare plans', 'plans')}</section>`);
  }
  function taskRow(t) { return `<div class="row"><div><h3>${esc(t.title)}</h3><p>${esc(t.date)} • ${esc(pondName(t.pondId))} • ${esc(t.type)}${t.done ? ' • Completed ' + esc(t.completedAt ? D.today(state.settings.timezone, new Date(t.completedAt)) : '(time unknown)') : t.date < day ? ' • Overdue' : ''}</p></div><div class="actions">${button(t.done ? 'Reopen' : 'Complete', 'task-toggle', `data-id="${esc(t.id)}" aria-label="${esc((t.done ? 'Reopen ' : 'Complete ') + t.title)}"`)}${button('Edit', 'edit', `data-col="tasks" data-id="${esc(t.id)}"`)}${button('Trash', 'trash', `data-col="tasks" data-id="${esc(t.id)}" aria-label="${esc('Move task ' + t.title + ' to trash')}"`, 'danger')}</div></div>`; }
  function calendarUTC(y, m, d) { const date = new Date(0); date.setUTCFullYear(y, m, d); date.setUTCHours(12, 0, 0, 0); return date; }
  function calendar() {
    const [y, m] = cursor.split('-').map(Number), first = calendarUTC(y, m - 1, 1).getUTCDay(), days = calendarUTC(y, m, 0).getUTCDate();
    const tasks = D.live(state.data.tasks).filter(t => t.pondId === active()?.id);
    const month = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarUTC(y, m - 1, 1));
    return `<div class="calendar-toolbar"><h3 aria-live="polite">${esc(month)}</h3><div>${button('‹', 'month', 'data-step="-1" aria-label="Previous month"')}${button('Today', 'today')}${button('›', 'month', 'data-step="1" aria-label="Next month"')}</div></div><div class="calendar" role="group" aria-label="${esc(month)} task dates">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span class="weekday">${d}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(first)}${Array.from({ length: days }, (_, i) => { const d = cursor + '-' + String(i + 1).padStart(2, '0'), count = tasks.filter(t => t.date === d).length; return `<button type="button" data-action="day" data-date="${d}" aria-label="${i + 1} ${esc(month)}, ${count} tasks${d === day ? ', today' : ''}" aria-pressed="${d === selectedDay}" ${d === day ? 'aria-current="date"' : ''}><span>${i + 1}</span>${count ? '<span class="task-dot" aria-hidden="true"></span>' : ''}</button>`; }).join('')}</div><p class="calendar-key">• Task planned <span>Outlined date: today</span></p><div class="calendar-picker"><label for="calendarDate">Choose a task date</label><input type="date" id="calendarDate" value="${selectedDay}"></div><div class="selected-tasks"><h3>Tasks for ${esc(selectedDay)}</h3><p class="muted">Active pond · Selected date prefills Add task below.</p>${tasks.filter(t => t.date === selectedDay).map(taskRow).join('') || empty('No tasks for this date.')}</div>`;
  }

  function tasksView() {
    const rank = t => t.done ? 3 : t.date < day ? 0 : t.date === day ? 1 : 2;
    const rows = filtered(allRows(['tasks']), 'tasks').sort((a, b) => rank(a) - rank(b) || (a.done ? (b.completedAt || '').localeCompare(a.completedAt || '') : a.date.localeCompare(b.date)) || a.id.localeCompare(b.id));
    const groups = [['Overdue', t => !t.done && t.date < day], ['Today', t => !t.done && t.date === day], ['Upcoming', t => !t.done && t.date > day], ['Completed', t => t.done]];
    return head('Tasks', 'Completing a task records its completion time. It does not create a feeding or cash record.') + `<div class="task-layout"><section class="panel task-agenda"><h2>Task agenda</h2>${filterView('tasks', false)}${paginate(rows, 'tasks', items => groups.map(([label, match]) => `<h3>${label}</h3>${items.filter(match).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map(taskRow).join('') || empty('No matching tasks on this page.')}`).join(''))}</section><section class="panel calendar-panel"><h2>Plan by date</h2>${calendar()}</section>${entryForm('tasks')}</div>`;
  }
  function toolsView() {
    const table = `<table><thead><tr><th>Average fish weight</th><th>Standard rate/day</th><th>Meals/day</th></tr></thead><tbody>${D.STAGES.map(s => `<tr><td>${s.label}</td><td>${s.rate}%</td><td>${s.meals}</td></tr>`).join('')}</tbody></table>`;
    const ponds = state.data.ponds.filter(p => !p.archived && !p.deletedAt);
    const rations = ponds.map(p => {
      const r = D.recommendation(p.stock.count, p.stock.avgWeightG);
      return `<div class="row"><div><h3>${esc(p.name)}</h3><p>${esc(p.stock.common || p.stock.scientific || 'Fish not recorded')} · ${p.stock.count === null ? 'count missing' : esc(p.stock.count) + ' fish'} · ${p.stock.avgWeightG === null ? 'weight missing' : esc(p.stock.avgWeightG) + ' g average'}</p></div><strong>${r.kg === undefined ? 'Needs stock data' : r.kg.toFixed(2) + ' kg/day'}</strong></div>`;
    }).join('');
    return head('Feed', 'Estimate feed manually, review the standard feed table, and—on PondElite—see per-pond rations.') +
      `<section class="panel"><h2>Feed Estimator</h2><p>Enter fish count and average weight. Biomass = count × grams ÷ 1,000; estimated daily feed = biomass × rate ÷ 100.</p>${form('calculator', num('count', 'Fish count (required)', active()?.stock.count, 0, 10000000, false, '1') + num('avgWeightG', 'Average weight (g, required)', active()?.stock.avgWeightG, 0, 1000000) + num('rate', 'Manual rate override (%, optional; >0 to 15)', '', 0, 15, true), 'Estimate feed')}<div id="feedResult" role="status">${feedText(active())}</div><p class="muted">This estimator does not save or change pond stock.</p></section>` +
      `<section class="panel"><h2>Standard feed table</h2>${table}<p class="muted">PondWise size guide v1. Starting estimates only; adjust for species, appetite, water conditions and local aquaculture advice.</p></section>` +
      `<section class="panel"><h2>Per-pond rations</h2>${access().pondRations ? (rations || empty('Create a pond and save fish stock to calculate rations.')) : `<p class="empty">Per-pond rations require PondElite. The Feed Estimator and standard feed table remain available.</p>${link('View plans', 'plans')}`}</section>` +
      `<section class="panel"><h2>Species lookup</h2><label for="speciesSearch">Common name, genus or scientific name</label><input type="search" id="speciesSearch" maxlength="200"><div class="actions">${button('Search species', 'species-search')}</div><p id="speciesStatus" role="status"></p><ul id="speciesResults" class="timeline"></ul></section>`;
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
    const backup = access().backup
      ? `<section class="panel"><h2>Backup data</h2><p>${store.blocked ? 'Recovery required' : opened.status === 'migration' ? 'Awaiting migration approval' : 'Local workspace readable'} • Revision ${state.revision} • Farm workspace</p><p>Downloads include ponds, archives and trash. Keep each backup in a safe location.</p><p>Last backup download requested: ${esc(lastBackup())}</p><div class="actions">${button('Download backup', 'export')}${button('Export drafts', 'draft-export')}${button('Export original legacy data', 'legacy-export')}${button('Preview rollback snapshot', 'rollback')}${button('Download raw rollback snapshot', 'rollback-export')}</div><div class="field" style="margin-top:20px"><label for="restoreFile">Preview replacement backup (JSON, maximum 5 MiB)</label><input id="restoreFile" type="file" accept=".json,application/json"></div><div id="restorePreview" role="status">${previewHTML()}</div></section>`
      : `<section class="panel"><h2>Backup data</h2><p class="empty">Backup download and restore are unavailable on PondStart and PondPro. Choose PondElite for Backup Data.</p>${link('View plans', 'plans')}</section>`;
    const tab = preview ? 'data' : settingsTab;
    const categories = [['appearance','Appearance','moon'],['farm','Farm preferences','ponds'],['account','Account & security','shield-check'],['data','Data & backup','database'],['help','Help & about','help']];
    const trashHTML = `<section class="panel"><h2>Trash</h2>${PondUI.info('Trash','Removed items stay recoverable. Recovering a pond also recovers access to its tasks, observations and transactions. There is no automatic purge.')} ${trash.map(r => `<div class="row"><div><h3>${esc(r.col === 'ponds' ? r.name : describe(r))}</h3><p>${esc(r.col)} · ${esc(r.deletedAt)}</p></div>${button('Recover','recover',`data-col="${r.col}" data-id="${esc(r.id)}"`)}</div>`).join('') || empty('Trash is empty.')}</section>`;
    const content = {appearance:PondAccount.settingsIntro(),farm:`<section class="panel"><h2>Farm timezone</h2>${form('settings',field('timezone','Timezone','text',state.settings.timezone,'required maxlength="100"'),'Save timezone')}</section>`,account:`<section class="panel"><h2>Your account</h2><div class="settings-link-row"><span>Personal details & password</span>${link('Manage profile','profile')}</div></section><section class="panel"><h2>Privacy & security</h2>${PondUI.info('Local storage','Your profile and pond records are stored in this browser. Signing out closes the session; it does not encrypt the saved records. Keep backups before clearing browser data.')}<a class="button" href="#privacy">Privacy policy</a></section><section class="panel"><h2>Sign out</h2><button type="button" class="danger" data-account-action="logout">Sign out</button></section>`,data:backup+trashHTML,help:PondAccount.settingsFooter() + (PondAccount.isDemo() ? '' : `<section class="panel"><h2>Notebook</h2>${button('Switch notebook','workspace')}</section>`)};
    return head('Settings') + `<div class="settings-layout"><nav class="settings-categories" aria-label="Settings categories">${categories.map(([id,label,i]) => `<button type="button" data-action="settings-tab" data-tab="${id}" aria-current="${tab === id ? 'page' : 'false'}">${icon(i)}${label}${icon('right')}</button>`).join('')}</nav><div class="settings-content" id="settingsContent"><h2 class="settings-category-title">${categories.find(c => c[0] === tab)[1]}</h2>${content[tab]}</div></div>`;
  }
  let settingsTab = 'appearance';

  function lastBackup() { try { return localStorage.getItem(store.key + '_last_export') || 'No download requested in this browser'; } catch (_) { return 'Unavailable'; } }
  function previewHTML() { return preview ? `<h3>Replacement preview</h3><p>${esc(counts(preview))}</p><p>${preview.data.ponds.filter(p => !p.archived && !p.deletedAt).length} active ponds; tier limit ${D.limit(tier)}. Over-limit data will be retained, with creation/reactivation blocked. This replaces only the selected workspace and retains a rollback snapshot. Existing drafts will stay available.</p><div class="actions">${button('Restore this backup', 'restore', '', 'primary')}${button('Cancel restore', 'restore-cancel')}</div>` : ''; }
  const plans = [
    {id:'start',name:'PondStart',label:'Free',icon:'waves',limit:'1 active pond',intro:'The essentials for your first pond.',features:['Manual feed estimator','Daily tasks and records','PondWise Helper']},
    {id:'pro',name:'PondPro',monthlyPrice:199,label:'Pro',icon:'sparkles',limit:'Up to 5 active ponds',intro:'More room for your growing farm.',features:['Everything in Free','Bought and sold records','Money Calculator']},
    {id:'elite',name:'PondElite',monthlyPrice:499,label:'Elite',icon:'crown',limit:'Unlimited active ponds',intro:'Your complete pond toolkit.',features:['Everything in Pro','Automatic feed and pond rations','Backup and restore']}
  ];
  function planPrice(p) {
    return p.monthlyPrice ? `<div class="plan-price"><strong>₱${esc(p.monthlyPrice)}</strong><span>/ month</span></div>` : '';
  }
  function plansView() {
    return head('Find your pond plan', 'Prices are for display only. Selecting a plan does not collect a payment.') + `<div class="cards plan-grid">${plans.map(p => `<section class="panel plan-card plan-${p.id} ${tier === p.id ? 'plan-selected' : ''}"><div class="plan-top"><span class="feature-icon">${icon(p.icon)}</span><span class="plan-label">${tier === p.id ? 'Current plan' : p.label}</span></div><h2>${p.name}</h2><p>${p.intro}</p><div class="plan-price-slot">${planPrice(p)}</div><strong class="plan-limit">${p.limit}</strong><ul class="plan-features">${p.features.map(f => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>${button(tier === p.id ? 'Current plan' : 'Choose ' + p.name, 'plan', `data-tier="${p.id}" ${tier === p.id ? 'disabled' : ''}`, 'primary')}${p.id !== 'start' ? button('Choose '+p.label, 'purchase', `data-tier="${p.id}"`) : ''}</section>`).join('')}</div><p class="plan-note">${icon('shield-check')}<span>Changing your plan keeps your ponds and records intact.</span></p>`;
  }
  function moreView() {
    const items = [['helper','Helper','Ask anything about your pond.'],['money','Money','Track bought, sold and cash flow.'],['tools','Feed & tools','Estimate feed and explore species.'],['profile','Profile','Your photo and personal details.'],['settings','Settings','Preferences, privacy and saved data.'],['plans','Plans','Compare Free, Pro and Elite.']];
    return head('Your pond toolkit', 'Everything else you need to care for your farm.') + `<div class="more-grid">${items.map(([id,title,description]) => `<a class="panel more-card" href="#${id}"><span class="feature-icon">${icon(id)}</span><div><h2>${title}</h2><p>${description}</p></div>${icon('right')}</a>`).join('')}</div>`;
  }
  function polish() {
    const main = $('main');
    PondUI.compact(main);
    main.dataset.tone = ({ponds:'teal',tasks:'amber',records:'blue',money:'teal',tools:'amber',profile:'blue',settings:'teal',plans:'amber'})[page] || 'blue';
    const header = main.querySelector('.page-head');
    if (header) { header.classList.add('visual-page-head'); header.insertAdjacentHTML('afterbegin', `<span class="page-mark">${icon(page)}</span>`); }
    const headings = [['backup|rollback','backup'],['privacy|security','shield-check'],['password','lock-keyhole'],['picture|photo','camera'],['profile','profile'],['dark','moon'],['support|helper','help'],['about','info'],['terms','file-text'],['log out','log-out'],['trash|data|settings','database'],['feed|ration','feed'],['species|stock|fish','fish'],['task|date|completed|work','tasks'],['water','water'],['bought|sold|profit|money','money'],['pond|practice','ponds']];
    main.querySelectorAll('.panel > h2, .setting-row h2, .setting-detail summary').forEach(h => {
      if (h.closest('.plan-card, .profile-summary, .pond-card')) return;
      const key = headings.find(([pattern]) => new RegExp(pattern,'i').test(h.textContent))?.[1] || page;
      h.classList.add('section-title'); h.insertAdjacentHTML('afterbegin', `<span class="section-icon">${icon(key)}</span>`);
    });
    main.querySelectorAll('.metric').forEach((m,i) => m.insertAdjacentHTML('afterbegin', `<span class="metric-icon">${icon(page === 'money' ? ['wallet','arrow-up-right','money'][i] : ['feed','records','tasks'][i])}</span>`));
    const add = document.querySelector('.context [data-action="add-record"]');
    if (add && !add.querySelector('svg')) { add.setAttribute('aria-label','Add record'); add.insertAdjacentHTML('afterbegin',icon('plus')); }
  }
  function offerKey() { return planKey() + '_offer_dismissed_v1'; }
  function renderOffer() {
    let dismissed = false; try { dismissed = localStorage.getItem(offerKey()) === 'true'; } catch (_) { /* Dismissal still works in memory. */ }
    $('planOffer').innerHTML = page === 'overview' && tier !== 'elite' && !dismissed && !offerDismissed ? `<aside class="plan-offer" aria-labelledby="offerTitle"><button type="button" class="icon-button offer-close" data-action="offer-close" aria-label="Close plan offer">${icon('x')}</button><div class="offer-heading"><span class="feature-icon">${icon('crown')}</span><div><span class="offer-eyebrow">MORE FOR YOUR PONDS</span><h2 id="offerTitle">Make room for Elite.</h2></div></div><p>Unlimited ponds, automatic feed estimates, and backup & restore.</p><div class="offer-actions">${button('View plan', 'purchase', 'data-tier="elite"', 'primary')}<a href="#plans">Compare plans ${icon('arrow-right')}</a></div></aside>` : '';
  }
  let offerDismissed = false;
  function purchasePlan(id) {
    const p = plans.find(p => p.id === id && p.id !== 'start'); if (!p) return;
    const dialog = $('purchaseDialog');
    dialog.innerHTML = `<div class="purchase-header"><span class="feature-icon">${icon(p.icon)}</span><button type="button" class="icon-button" data-action="purchase-close" aria-label="Close purchase details">${icon('x')}</button></div><p class="eyebrow">YOUR NEXT PLAN</p><h2 id="purchaseTitle">${p.name}</h2><p>${p.intro}</p>${planPrice(p)}<ul class="plan-features">${p.features.map(f => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul><div class="checkout-note" id="purchaseDescription">No payment will be collected when you select this plan.</div><div class="purchase-actions">${button('Choose '+p.label, 'plan', `data-tier="${p.id}"`, 'primary')}${button('Close', 'purchase-close')}</div>`;
    dialog.showModal();
  }
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
    if (event.target.matches('[data-account], .chat-composer') || !PondAccount.signedIn()) return;
    event.preventDefault(); const form = event.target; const v = values(form);
    try {
      if (form.id === 'calculator') { const r = D.recommendation(n(v.count), n(v.avgWeightG), n(v.rate)); if (r.kg === undefined) D.fail('count', r.warnings[0]); $('feedResult').innerHTML = feedText({ stock: { count: n(v.count), avgWeightG: n(v.avgWeightG) } }, n(v.rate)); return; }
      capture(); const next = clone(state), p = active(), timestamp = now();
      if (form.id === 'settings') next.settings.timezone = D.timezone(v.timezone.trim());
      else if (form.id === 'pond-create') {
        if (!D.canActivate(next.data, tier)) throw new Error('Active pond limit reached. Archive a pond or change your plan.');
        const pond = { id: crypto.randomUUID(), name: v.name, size: n(v.size), notes: v.notes, archived: false, deletedAt: null, createdAt: timestamp, updatedAt: timestamp, stock: { common: '', scientific: '', count: null, avgWeightG: null, updatedAt: null } };
        next.data.ponds.push(pond); next.data.activePondId = pond.id;
      } else if (form.id === 'pond-edit') {
        requirePond(); const target = next.data.ponds.find(r => r.id === p.id);
        Object.assign(target, { name: v.name, size: n(v.size), notes: v.notes, updatedAt: timestamp, stock: { common: v.common, scientific: v.scientific, count: n(v.count), avgWeightG: n(v.avgWeightG), updatedAt: timestamp } });
      } else {
        const col = form.id.slice(6); if (!D.COLLECTIONS.slice(1).includes(col)) throw new Error('Unknown form.');
        if (['expenses', 'sales'].includes(col) && !access().money) throw new Error('Choose PondPro or PondElite to change money records.');
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
    if (!PondAccount.signedIn()) return;
    const a = el.dataset.action, id = el.dataset.id, col = el.dataset.col;
    capture();
    if (a === 'settings-tab') { settingsTab = el.dataset.tab; render(); document.querySelector('#settingsContent > h2')?.setAttribute('tabindex','-1'); document.querySelector('#settingsContent > h2')?.focus({preventScroll:true}); return; }
    if (a === 'offer-close') { offerDismissed = true; try { localStorage.setItem(offerKey(), 'true'); } catch (_) {} $('planOffer').innerHTML = ''; $('main').focus({preventScroll:true}); return; }
    if (a === 'purchase') { purchasePlan(el.dataset.tier); return; }
    if (a === 'purchase-close') { $('purchaseDialog').close(); return; }
    if (a === 'add-record') { if (page === 'records') { $('recordType').focus(); } else location.hash = 'records'; return; }
    if (a === 'workspace') { if (PondAccount.isDemo()) throw new Error('This account uses its own notebook. Sign out to switch profiles.'); editing = null; preview = null; openWorkspace(!demo); if (demo && opened.status === 'new') seedDemo(); render(false); notify('Workspace opened.'); return; }
    if (a === 'export') { if (!access().backup) throw new Error('Backup Data requires PondElite.'); if (store.blocked) throw new Error('Export raw workspace while in recovery.'); await download(store.export(), `pondwise-${day}-r${state.revision}.json`); try { localStorage.setItem(store.key + '_last_export', now()); } catch (_) { /* export already requested */ } notify('Backup download requested. Check your downloads and keep the file safe.'); return; }
    if (a === 'raw' || a === 'legacy-export') { const raw = localStorage.getItem(a === 'legacy-export' || opened.status === 'migration' ? S.LEGACY : store.recoveryKey); if (raw === null) throw new Error('No original data exists for this key.'); download(raw, 'pondwise-original-' + day + '.json'); return; }
    if (a === 'draft-export') { download(JSON.stringify(drafts, null, 2), 'pondwise-drafts-' + day + '.json'); notify('Draft download requested. This is a reference file, not a restorable notebook backup.'); return; }
    if (a === 'reload') { openWorkspace(demo); render(false); notify('Saved workspace reloaded. Drafts retained.'); return; }
    if (a === 'migrate') { commit(state, 'Migration verified. Original legacy data remains available.', null, true); return; }
    if (a === 'rollback-export') { if (!access().backup) throw new Error('Backup Data requires PondElite.'); const raw = localStorage.getItem(store.key + '_rollback'); if (raw === null) throw new Error('No rollback snapshot exists.'); download(raw, 'pondwise-rollback-' + day + '.json'); return; }
    if (a === 'rollback') { if (!access().backup) throw new Error('Backup Data requires PondElite.'); restoreGeneration++; preview = store.rollback(); render(); return; }
    if (a === 'restore-cancel') { restoreGeneration++; preview = null; render(); return; }
    if (a === 'restore') { if (!access().backup) throw new Error('Backup Data requires PondElite.'); if (!preview) return; commit(preview, 'Backup restored and verified. Previous workspace retained as rollback.', null, true); preview = null; day = D.today(state.settings.timezone); render(); return; }
    if (a === 'plan') { if ($('purchaseDialog').open) $('purchaseDialog').close(); localStorage.setItem(planKey(), D.plan(el.dataset.tier)); tier = D.plan(el.dataset.tier); preview = null; render(); notify('Plan updated. All existing data was kept.'); return; }
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
      render(); [...document.querySelectorAll('[data-action]')].find(e => e.dataset.action === a && (a !== 'month' || e.dataset.step === el.dataset.step) && (a !== 'day' || e.dataset.date === selectedDay))?.focus({ preventScroll: true });
      if (a !== 'month') { const input = document.querySelector('#entry-tasks [name=date]'); if (input && !input.form.dataset.editing) { input.value = selectedDay; const form = input.form; form.dataset.dirty = 'true'; capture(); } } return;
    }
    if (a === 'edit') {
      if (!D.COLLECTIONS.slice(1).includes(col)) throw new Error('Unknown collection.');
      if (['expenses', 'sales'].includes(col) && !access().money) throw new Error('Choose PondPro or PondElite to correct money records.');
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
    else if (a === 'archive') { const p = next.data.ponds.find(p => p.id === id); if (!p) throw new Error('Pond not found.'); if (p.archived && !D.canActivate(next.data, tier)) throw new Error('Pond limit reached. Archive another pond or change your plan.'); p.archived = !p.archived; p.updatedAt = now(); }
    else if (a === 'clear-stock') { const p = next.data.ponds.find(p => p.id === id && !p.deletedAt); if (!p) throw new Error('Pond not found.'); if (!confirm(`Remove the saved fish stock from ${p.name}? Pond observations and money records will remain.`)) return; p.stock = { common: '', scientific: '', count: null, avgWeightG: null, updatedAt: now() }; p.updatedAt = now(); }
    else if (a === 'task-toggle') { next.data.tasks = next.data.tasks.map(t => t.id === id ? D.toggleTask(t) : t); }
    else if (a === 'trash' || a === 'recover') {
      if (a === 'trash' && col === 'ponds') { const count = D.COLLECTIONS.slice(1).reduce((n, key) => n + state.data[key].filter(r => r.pondId === id).length, 0); if (!confirm(`Move this pond with ${count} dependent records to recoverable trash?`)) return; }
      commit(D.setDeleted(next, col, id, a === 'trash', tier), a === 'trash' ? 'Moved to trash. Recover it in Help & settings.' : 'Recovered from trash.'); if (a === 'trash') $('notice').insertAdjacentHTML('beforeend', button('Undo', 'recover', `data-col="${col}" data-id="${esc(id)}"`)); return;
    } else return;
    commit(next, a === 'task-toggle' ? 'Task updated. No observation record was created.' : a === 'clear-stock' ? 'Fish stock removed. Pond history was retained.' : 'Pond context updated. Drafts remain with their original pond.');
  }
  document.addEventListener('click', event => { if (event.target.closest('.skip')) { event.preventDefault(); $('main').focus(); return; } const el = event.target.closest('[data-action]'); if (el) action(el).catch(e => notify('Not saved. ' + e.message, true)); });
  document.addEventListener('keydown', event => {
    const dateButton = event.target.closest('[data-action="day"]');
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!dateButton || !(event.key in offsets)) return;
    event.preventDefault();
    const [y,m,d] = dateButton.dataset.date.split('-').map(Number);
    const target = calendarUTC(y,m-1,d + offsets[event.key]).toISOString().slice(0,10);
    if (!D.validDate(target)) return;
    capture(); cursor = target.slice(0,7); render();
    document.querySelector(`[data-action="day"][data-date="${target}"]`)?.focus({preventScroll:true});
  });
  document.addEventListener('change', async event => {
    let restoreToken = null;
    const targetStore = store;
    try {
      if (event.target.id === 'calendarDate') { if (!D.validDate(event.target.value)) throw new Error('Choose a valid task date.'); selectedDay = event.target.value; cursor = selectedDay.slice(0, 7); const input = document.querySelector('#entry-tasks [name=date]'); if (input && !input.form.dataset.editing) { input.value = selectedDay; input.form.dataset.dirty = 'true'; } render(); $('calendarDate')?.focus({ preventScroll: true }); }
      if (event.target.id === 'pondContext') { capture(); const next = clone(state); next.data.activePondId = event.target.value; editing = null; commit(next, 'Active pond changed. Drafts stay with their original pond.'); }
      if (event.target.id === 'recordType') { capture(); recordType = event.target.value; editing = null; render(false); }
      if (event.target.id === 'restoreFile') {
        if (!access().backup) throw new Error('Backup Data requires PondElite.');
        const file = event.target.files[0]; if (!file) return; restoreToken = ++restoreGeneration; preview = null;
        if (file.size > 5 * 1024 * 1024) throw new Error('Backup exceeds the 5 MiB limit.');
        $('restorePreview').textContent = 'Reading and validating backup…'; let raw;
        try { raw = await file.text(); } catch (_) { throw new Error('Could not read the selected file. Select it again.'); }
        if (restoreToken !== restoreGeneration || store !== targetStore || page !== 'settings') return;
        preview = D.parse(raw); $('restorePreview').innerHTML = previewHTML();
      }
    } catch (e) { if (restoreToken !== null && (restoreToken !== restoreGeneration || store !== targetStore || page !== 'settings')) return; if ($('restorePreview') && event.target.id === 'restoreFile') $('restorePreview').textContent = 'Backup rejected. ' + e.message; notify('Not saved. ' + e.message, true); nav(); }
  });
  function seedDemo() {
    const next = D.blank(), timestamp = now();
    next.data.ponds.push({ id: crypto.randomUUID(), name: 'Tilapia pond', notes: 'Main grow-out pond', size: 400, archived: false, deletedAt: null, createdAt: timestamp, updatedAt: timestamp, stock: { common: 'Nile tilapia', scientific: 'Oreochromis niloticus', count: 800, avgWeightG: 150, updatedAt: timestamp } });
    next.data.activePondId = next.data.ponds[0].id;
    next.data.tasks.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, title: 'Observe fish appetite', type: 'inspection', date: day, done: false, completedAt: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    next.data.waterLogs.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, date: day, ph: 7.2, temp: 28, notes: 'Water check', createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    next.data.feedLogs.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, date: day, kg: 3.2, skipped: false, notes: 'Morning feeding', createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    next.data.expenses.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, date: day, item: 'Feed bought', amountCentavos: 125000, category: 'Feed', createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    next.data.sales.push({ id: crypto.randomUUID(), pondId: next.data.activePondId, date: day, item: 'Fish sold', amountCentavos: 200000, category: 'Harvest', createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    state = store.commit(next); opened = { status: 'ready' };
  }
  function ensureFocusVisible() {
    const control = document.activeElement;
    document.body.classList.toggle('keyboard-open', !!control?.matches('input,textarea,select') && (window.visualViewport ? window.visualViewport.height < innerHeight * .8 : false));
    if (!control?.matches('input,textarea,select,button,a') || control.closest('.sidebar,.mobile-nav,.context')) return;
    requestAnimationFrame(() => {
      const rect = control.getBoundingClientRect(), top = document.querySelector('.context').getBoundingClientRect().bottom;
      const bar = $('mobileNav'), navHeight = getComputedStyle(bar).display === 'none' ? 0 : bar.getBoundingClientRect().height;
      const bottom = Math.min(innerHeight, window.visualViewport ? window.visualViewport.height + window.visualViewport.offsetTop : innerHeight) - navHeight;
      if (rect.top < top + 8 || rect.bottom > bottom - 8) control.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }
  document.addEventListener('focusin', event => { ensureFocusVisible(); const offer = document.querySelector('.plan-offer'); if (!offer || offer.contains(event.target) || !event.target.matches('a,button,input,select,textarea,summary')) return; const a = offer.getBoundingClientRect(), b = event.target.getBoundingClientRect(); if (b.width && b.height && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) offer.hidden = true; });
  document.addEventListener('focusout', () => requestAnimationFrame(ensureFocusVisible));
  window.visualViewport?.addEventListener('resize', ensureFocusVisible);
  window.addEventListener('hashchange', route);
  window.addEventListener('pondwise-account', event => { if (PondAccount.signedIn() && /^(Welcome back|Profile created)/.test(event.detail) && demo !== PondAccount.isDemo()) { openWorkspace(PondAccount.isDemo()); if (demo && opened.status === 'new') seedDemo(); } render(); if (PondAccount.signedIn()) notify(event.detail); });
  window.addEventListener('storage', event => { if (event.key === store.key || event.key === null || (!demo && opened.status === 'migration' && event.key === S.LEGACY)) { capture(); conflict = true; nav(); notify('Another tab changed storage. Export drafts and reload before saving.', true); } if (event.key === planKey()) { tier = D.plan(event.newValue); render(); } });
  window.addEventListener('beforeunload', event => { capture(); if (Object.keys(drafts).length) { event.preventDefault(); event.returnValue = ''; } });
  setInterval(() => { const current = D.today(state.settings.timezone); if (current !== day) { day = current; render(); notify('Farm date updated. Existing draft dates were preserved.'); } }, 30000);
  openWorkspace(PondAccount.isDemo()); if (demo && opened.status === 'new') seedDemo(); route();
})();
