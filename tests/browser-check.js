/* Optional browser integration harness. Start a static server, set AGENT_BROWSER_BIN.
   Uses only an isolated agent-browser session with synthetic storage. */
'use strict';
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const bin = process.env.AGENT_BROWSER_BIN || 'agent-browser';
const origin = process.env.PONDWISE_TEST_URL || 'http://127.0.0.1:8765';
const env = { ...process.env, AGENT_BROWSER_SESSION: 'pondwise-integration-tests-'+process.pid, AGENT_BROWSER_EXECUTABLE_PATH: process.env.AGENT_BROWSER_EXECUTABLE_PATH || '/opt/brave-bin/brave' };
function command(...args) { return execFileSync(bin, args, { env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); }
function run(code) { const out = JSON.parse(command('eval', code, '--json')); if (!out.success) throw Error(JSON.stringify(out)); return out.data.result; }
function check(code, message) { assert.equal(run(code), true, message); console.log('PASS ' + message); }
function act(code) { return run(`(async()=>{ ${code}; await new Promise(r=>setTimeout(r,80)); return true; })()`); }
const go = route => act(`location.hash=${JSON.stringify(route)}`);
const set = (selector, value) => act(`{ const e=document.querySelector(${JSON.stringify(selector)}); e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true})); }`);
const click = selector => act(`document.querySelector(${JSON.stringify(selector)}).click()`);
const submit = selector => act(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
try {
  command('open', origin);
  // Each fixture uses a separate named browser and synthetic origin. No operator data is loaded.
  run(`localStorage.clear();sessionStorage.clear()`); command('reload');
  act(`{const f=document.querySelector('#account-signup');f.elements.name.value='Test Keeper';f.elements.email.value='keeper@example.test';f.elements.password.value='unique-test-password';f.elements.confirm.value='unique-test-password';f.elements.consent.checked=true;f.requestSubmit();}`);
  command('wait', '#desktopNav a');
  go('ponds'); set('#pond-create [name=name]', 'Synthetic pond'); submit('#pond-create');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.ponds.length===1`, 'create pond persists typed envelope');
  set('#pond-edit [name=count]', '800'); set('#pond-edit [name=avgWeightG]', '150'); submit('#pond-edit');
  go('plans'); click('[data-tier=elite]'); go('overview'); check(`document.querySelector('main').textContent.includes('3.60 kg')`, 'PondElite overview automatic feed estimate');
  go('records'); set('#entry-feedLogs [name=kg]', '1.25');
  go('tasks'); go('records'); click('.skip'); check(`location.hash==='#records'`, 'skip link keeps current screen'); check(`document.querySelector('[name=kg]').value==='1.25'`, 'navigation retains record draft');
  submit('#entry-feedLogs'); check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs[0].kg===1.25`, 'feed record saves and clears draft');
  set('#entry-feedLogs [name=kg]', '-1'); submit('#entry-feedLogs');
  check(`document.querySelector('[name=kg]').value==='-1' && document.querySelector('[name=kg]').getAttribute('aria-invalid')==='true' && JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.length===1`, 'invalid feed is rejected with retained draft and field error');
  click('[data-action=discard]');
  // Fail only v2 writes, keeping real browser localStorage semantics otherwise.
  act(`window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='pondwise_v2')throw new DOMException('test quota','QuotaExceededError');return originalSet.call(this,k,v)}`);
  set('#entry-feedLogs [name=kg]', '2.5'); submit('#entry-feedLogs');
  check(`document.querySelector('[name=kg]').value==='2.5' && document.querySelector('#notice').textContent.includes('Not saved') && JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.length===1`, 'failed write retains draft and previous records');
  act(`Storage.prototype.setItem=window.originalSet`); submit('#entry-feedLogs');
  go('tasks'); set('#entry-tasks [name=title]', 'Future inspection'); set('#entry-tasks [name=date]', '2099-01-01'); submit('#entry-tasks'); click('[data-action=task-toggle]');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.tasks[0].completedAt!==null`, 'future task completion records actual timestamp');
  click('[data-action=task-toggle]'); check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.tasks[0].completedAt===null`, 'reopen clears completion timestamp');
  go('records'); click('[data-action=trash]'); click('#notice [data-action=recover]');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.every(r=>!r.deletedAt)`, 'trash undo recovers record');
  click('[data-action=edit]'); set('#entry-feedLogs [name=kg]', '4'); submit('#entry-feedLogs');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.length===2 && JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.some(r=>r.kg===4)`, 'history correction updates existing row without duplicate');
  go('plans'); click('[data-tier=pro]'); go('ponds'); set('#pond-create [name=name]', 'Second pond'); submit('#pond-create');
  go('records'); set('#entry-feedLogs [name=kg]', '3.33');
  const secondId = run(`JSON.parse(localStorage.getItem('pondwise_v2')).data.activePondId`);
  act(`{const e=document.querySelector('#pondContext');e.selectedIndex=0;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  check(`document.querySelector('[name=kg]').value===''`, 'pond switch never carries quantity into another pond');
  act(`{const e=document.querySelector('#pondContext');e.value=${JSON.stringify(secondId)};e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  check(`document.querySelector('[name=kg]').value==='3.33'`, 'original pond draft returns on reselection');
  submit('#entry-feedLogs');
  click('[data-action=edit]'); set('#entry-feedLogs [name=kg]', '3.5');
  act(`{const e=document.querySelector('#pondContext');e.selectedIndex=0;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  act(`{const e=document.querySelector('#pondContext');e.value=${JSON.stringify(secondId)};e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  check(`document.querySelector('#entry-feedLogs').closest('section').querySelector('h2').textContent.startsWith('Edit') && document.querySelector('#entry-feedLogs').dataset.editing!=='' && document.querySelector('#entry-feedLogs [type=submit]').textContent.includes('Save correction')`, 'restored correction draft remains visibly in edit mode');
  submit('#entry-feedLogs');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.some(r=>r.pondId===${JSON.stringify(secondId)}&&r.kg===3.5)`, 'restored correction draft updates its original record');
  go('plans'); click('[data-tier=start]'); go('ponds'); set('#pond-create [name=name]', 'Blocked pond'); submit('#pond-create');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.ponds.length===2 && document.querySelector('#notice').textContent.includes('limit')`, 'downgrade retains over-limit ponds and blocks creation');
  click('#pond-create [data-action=discard]');
  go('tools'); check(`document.querySelector('main').textContent.includes('Feed Estimator') && document.querySelector('main').textContent.includes('Per-pond rations require PondElite')`, 'PondStart keeps manual feed tools and locks pond rations');
  go('settings'); check(`!document.querySelector('#restoreFile') && document.querySelector('main').textContent.includes('unavailable on PondStart and PondPro')`, 'PondStart has no Backup Data controls'); const farm = run(`localStorage.getItem('pondwise_v2')`); click('[data-action=workspace]');
  check(`localStorage.getItem('pondwise_v2')===${JSON.stringify(farm)} && !!localStorage.getItem('pondwise_demo_v2')`, 'demo is isolated from farm data');
  check(`(()=>{const d=JSON.parse(localStorage.getItem('pondwise_demo_v2')).data;return d.ponds.length===1&&d.tasks.length===1&&d.feedLogs.length===1&&d.waterLogs.length===1&&d.expenses.length===1&&d.sales.length===1})()`, 'seeded dashboard demo includes one pond and complete sequence data');
  go('plans'); click('[data-tier=elite]'); check(`localStorage.getItem('pondwise_plan')==='start' && localStorage.getItem('pondwise_demo_plan')==='elite'`, 'demo tier preference is isolated from farm tier');
  click('#workspaceBanner [data-action=workspace]');
  go('finance'); check(`document.querySelector('h1').textContent==='Money Calculator'`, 'legacy finance hash aliases Money Calculator');
  go('feed'); check(`document.querySelector('h1').textContent==='Feed'`, 'legacy feed hash aliases Feed');
  command('back'); check(`document.querySelector('h1').textContent==='Money Calculator'`, 'browser Back changes visible route');
  command('forward'); check(`document.querySelector('h1').textContent==='Feed'`, 'browser Forward changes visible route');
  go('settings');
  // Simulate a separate tab's event after a persisted conflicting write.
  act(`{const s=JSON.parse(localStorage.getItem('pondwise_v2'));s.revision++;localStorage.setItem('pondwise_v2',JSON.stringify(s));dispatchEvent(new StorageEvent('storage',{key:'pondwise_v2',newValue:JSON.stringify(s)}));}`);
  check(`document.querySelector('#workspaceBanner').textContent.includes('another tab')`, 'cross-tab change pauses saves explicitly');
  click('[data-action=reload]');
  go('plans'); click('[data-tier=pro]'); go('money'); click('[data-col=sales][data-action=money-type]');
  set('#entry-sales [name=item]', 'Tiny sale'); set('#entry-sales [name=amount]', '0.10'); submit('#entry-sales');
  set('#entry-sales [name=item]', 'Second sale'); set('#entry-sales [name=amount]', '0.20'); submit('#entry-sales');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.sales.reduce((n,r)=>n+r.amountCentavos,0)===30 && document.querySelector('main').textContent.includes('₱0.30')`, 'money entry stores and displays exact centavo sums');
  set('#entry-sales [name=item]', 'Invalid sale'); set('#entry-sales [name=amount]', '1.001'); submit('#entry-sales');
  check(`document.querySelector('[name=amount]').getAttribute('aria-invalid')==='true' && JSON.parse(localStorage.getItem('pondwise_v2')).data.sales.length===2`, 'money rejects third decimal without changing ledger');
  click('#entry-sales [data-action=discard]');
  go('records'); check(`document.querySelector('#entry-feedLogs')!==null && document.querySelector('#entry-sales')===null`, 'money entry type does not leak into Records'); act(`{const e=document.querySelector('#recordType');e.value='waterLogs';e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  check(`[...document.querySelector('#type-filter').options].every(o=>!['expenses','sales'].includes(o.value))`, 'Records filter offers observation types only');
  submit('#entry-waterLogs'); check(`document.querySelector('.form-error').textContent.includes('at least one')`, 'empty water checks are rejected');
  set('#entry-waterLogs [name=notes]', 'Water is cloudy'); submit('#entry-waterLogs');
  set('#entry-waterLogs [name=ph]', '7.1'); set('#entry-waterLogs [name=date]', '2025-01-01'); submit('#entry-waterLogs');
  go('overview'); check(`document.querySelector('main').textContent.includes('Water is cloudy') && document.querySelector('main').textContent.includes('Not measured')`, 'latest-water selector retains newer observation and missing measurement state');
  go('records'); act(`{const e=document.querySelector('#recordType');e.value='healthLogs';e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  set('#entry-healthLogs [name=note]', 'Planned observation is not allowed'); set('#entry-healthLogs [name=date]', '2099-01-01'); submit('#entry-healthLogs');
  check(`document.querySelector('[name=date]').getAttribute('aria-invalid')==='true' && JSON.parse(localStorage.getItem('pondwise_v2')).data.healthLogs.length===0`, 'future observations rejected in UI');
  click('#entry-healthLogs [data-action=discard]');
  go('settings'); check(`!document.querySelector('#restoreFile')`, 'PondPro has no Backup Data controls');
  go('tools'); check(`document.querySelector('main').textContent.includes('Per-pond rations require PondElite')`, 'PondPro keeps per-pond rations locked');
  go('plans'); click('[data-tier=elite]'); go('tools'); check(`document.querySelector('main').textContent.includes('kg/day') && !document.querySelector('main').textContent.includes('Per-pond rations require PondElite')`, 'PondElite unlocks per-pond rations');
  go('settings'); check(`!!document.querySelector('#restoreFile') && !!document.querySelector('[data-action=export]')`, 'PondElite unlocks Backup Data controls');
  function upload(raw) { act(`{ const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(raw)}],'backup.json',{type:'application/json'}));const input=document.querySelector('#restoreFile');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true})); }`); }
  const beforeRestore=run(`localStorage.getItem('pondwise_v2')`);
  upload('{"ponds":[]}');
  check(`document.querySelector('#restorePreview').textContent.includes('rejected') && localStorage.getItem('pondwise_v2')===${JSON.stringify(beforeRestore)}`, 'invalid restore leaves live storage unchanged');
  act(`window.originalFileText=File.prototype.text;File.prototype.text=()=>Promise.reject(new Error('synthetic read failure'))`); upload('{}');
  check(`document.querySelector('#restorePreview').textContent.includes('Could not read')`, 'restore distinguishes file-read errors');
  act(`File.prototype.text=window.originalFileText`);
  const candidate=JSON.parse(beforeRestore), activeId=candidate.data.activePondId;
  candidate.data.ponds.find(p=>p.id===activeId).name='Very long pond name with operator notes '.repeat(3).slice(0,120);
  for(let i=0;i<25;i++) candidate.data.feedLogs.push({id:'history-'+i,pondId:activeId,date:'2025-01-01',kg:1,skipped:false,notes:'Searchable archive '+i,createdAt:null,updatedAt:null,deletedAt:null});
  candidate.plan='elite'; upload(JSON.stringify(candidate));
  check(`document.querySelector('#restorePreview').textContent.includes('Replacement preview') && localStorage.getItem('pondwise_v2')===${JSON.stringify(beforeRestore)}`, 'valid restore previews counts without committing');
  click('[data-action=restore]');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.length===28 && localStorage.getItem('pondwise_plan')==='elite' && localStorage.getItem('pondwise_v2_rollback')===${JSON.stringify(beforeRestore)}`, 'restore verifies replacement, preserves rollback, ignores imported tier');
  go('records'); check(`document.querySelector('.pagination').textContent.includes('Page 1 of 3')`, 'complete history is paginated');
  click('[data-action=page][data-step="1"]'); check(`document.querySelector('.pagination').textContent.includes('Page 2 of 3')`, 'older records are reachable');
  set('#history-search','Searchable archive 24'); click('[data-action=filter]');
  check(`document.querySelector('.pagination').textContent.includes('1 records') && document.querySelector('main').textContent.includes('Searchable archive 24')`, 'search reaches older history across pages');
  click('[data-action=filter-reset]'); go('tasks');
  click('[data-action=day]'); const selected=run(`document.querySelector('#entry-tasks [name=date]').value`); click('[data-action=month][data-step="1"]');
  check(`document.querySelector('#entry-tasks [name=date]').value===${JSON.stringify(selected)}`, 'calendar month changes preserve selected entry date');
  click('#entry-tasks [data-action=discard]'); go('settings');
  // Exercise actual migration UI using a synthetic full legacy graph.
  const old=JSON.parse(run(`localStorage.getItem('pondwise_v2')`)).data;
  for(const p of old.ponds){p.size=p.size===null?'':String(p.size);p.stock.count=p.stock.count===null?'':String(p.stock.count);p.stock.avgWeightG=p.stock.avgWeightG===null?'':String(p.stock.avgWeightG);}
  for(const col of ['expenses','sales'])for(const row of old[col])row.amount=(row.amountCentavos/100).toFixed(2);
  const legacyRaw=JSON.stringify(old);
  run(`localStorage.removeItem('pondwise_v2');localStorage.setItem('pondwise_v1',${JSON.stringify(legacyRaw)})`); command('reload');
  check(`document.querySelector('#workspaceBanner').textContent.includes('Legacy data found') && localStorage.getItem('pondwise_v2')===null`, 'legacy UI previews migration before writing');
  click('[data-action=migrate]');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.length===28 && localStorage.getItem('pondwise_v1')===${JSON.stringify(legacyRaw)}`, 'migration UI preserves original and all record counts');
  go('settings');
  const recoveryBackup=run(`localStorage.getItem('pondwise_v2')`);
  run(`localStorage.setItem('pondwise_v2','corrupt synthetic JSON')`); command('reload');
  check(`document.querySelector('#workspaceBanner').textContent.includes('Recovery required')`, 'corrupt startup shows recovery, never silent empty state');
  upload(recoveryBackup); click('[data-action=restore]');
  check(`localStorage.getItem('pondwise_v2_rollback')==='corrupt synthetic JSON' && JSON.parse(localStorage.getItem('pondwise_v2')).data.feedLogs.length===28`, 'recovery restore retains corrupt original and recovers valid graph');
  act(`window.pendingReads=[];File.prototype.text=function(){return new Promise(resolve=>window.pendingReads.push(resolve));}`);
  upload('first pending file'); upload('second pending file');
  const latestBackup=JSON.parse(recoveryBackup);latestBackup.data.ponds[0].notes='Latest selected backup';
  act(`window.pendingReads[1](${JSON.stringify(JSON.stringify(latestBackup))})`);
  act(`window.pendingReads[0](${JSON.stringify(recoveryBackup)})`);
  act(`File.prototype.text=window.originalFileText`);click('[data-action=restore]');
  check(`JSON.parse(localStorage.getItem('pondwise_v2')).data.ponds[0].notes==='Latest selected backup'`, 'older file-read response cannot replace newer restore selection');
  go('settings'); set('#question', 'latest water'); submit('#helper'); check(`document.querySelector('#helperAnswer').textContent.includes('Context: '+document.querySelector('#pondContext option:checked').textContent)`, 'Helper answers within the selected pond context');
  go('ponds'); act(`window.confirm=()=>true`); click('[data-action=clear-stock]'); check(`(()=>{const d=JSON.parse(localStorage.getItem('pondwise_v2')).data,p=d.ponds.find(x=>x.id===d.activePondId);return p.stock.common===''&&p.stock.count===null&&p.stock.avgWeightG===null})()`, 'fish stock can be explicitly removed without deleting the pond');
  // Viewport matrix checks every operational screen with saved data.
  const routes = ['overview','ponds','tasks','records','money','tools','settings','plans','more'];
  for (const width of [320,375,390,480,700,768,900,1024,1440]) {
    command('set','viewport',String(width),'900');
    for (const route of routes) {
      go(route);
      check(`(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return new Set(ids).size===ids.length})()`, `${route}: unique control IDs at ${width}px`);
      check(`document.documentElement.scrollWidth<=innerWidth`, `${route}: no horizontal overflow at ${width}px`);
      if (route === 'tasks') {
        check(`getComputedStyle(document.querySelector('.calendar')).display==='grid' && document.querySelectorAll('.weekday').length===7`, `visible month calendar at ${width}px`);
        check(`[...document.querySelectorAll('[data-action=day]')].every(e=>e.getBoundingClientRect().width>=43.9 && e.getBoundingClientRect().height>=44)`, `calendar touch targets at ${width}px`);
      }
    }
  }
  command('set','viewport','390','844'); go('overview'); command('screenshot','/tmp/pondwise-mobile.png');
  command('set','viewport','1440','900'); command('screenshot','/tmp/pondwise-desktop.png');
  for (const route of routes) { go(route); const audit=JSON.parse(command('a11y','--json')); assert.equal(audit.data.counts.violations,0,JSON.stringify(audit.data.violations)); console.log(`PASS accessibility audit: ${route}, zero axe violations`); }
  command('set','viewport','700','390');go('records');check(`document.documentElement.scrollWidth<=innerWidth`, 'landscape layout has no horizontal overflow');
  run(`document.documentElement.style.fontSize='200%'`);check(`document.documentElement.scrollWidth<=innerWidth`, '200% text enlargement has no horizontal overflow');run(`document.documentElement.style.fontSize=''`);
  check(`document.querySelectorAll('[aria-current=page]').length>=1`, 'navigation exposes current page');
  console.log('All browser workflow checks passed.');
} finally { command('close'); }
