/* Isolated browser-local account regression. Run the static server on port 8765. */
'use strict';
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const env = {...process.env,AGENT_BROWSER_SESSION:'pondwise-account-regression-'+process.pid,AGENT_BROWSER_EXECUTABLE_PATH:process.env.AGENT_BROWSER_EXECUTABLE_PATH || '/opt/brave-bin/brave'};
const command = (...args) => execFileSync(process.env.AGENT_BROWSER_BIN || 'agent-browser',args,{env,encoding:'utf8',maxBuffer:4*1024*1024});
const run = code => {const out=JSON.parse(command('eval',code,'--json')); if(!out.success) throw Error(JSON.stringify(out)); return out.data.result;};
const act = code => run(`(async()=>{${code};await new Promise(r=>setTimeout(r,350));return true})()`);
const check = (code,label) => {assert.equal(run(code),true,label); console.log('PASS '+label);};
const go = route => act(`location.hash=${JSON.stringify(route)}`);
const submit = (id,values) => { act(`{const f=document.getElementById(${JSON.stringify(id)});for(const [k,v] of Object.entries(${JSON.stringify(values)})){const e=f.elements.namedItem(k);if(e.type==='checkbox')e.checked=v;else e.value=v;}f.requestSubmit();}`); command('wait','--fn',"!document.querySelector('[data-account] button[type=submit]:disabled')"); };
try {
  command('open',process.env.PONDWISE_TEST_URL || 'http://127.0.0.1:8765');
  run('localStorage.clear();sessionStorage.clear()'); command('reload');
  go('overview'); check(`!!document.querySelector('#account-signup') && getComputedStyle(document.querySelector('.sidebar')).display==='none'`,'dashboard requires onboarding');
  for (const width of [320,390,768,1024,1440]) {
    command('set','viewport',String(width),'900');
    check(`document.documentElement.scrollWidth<=innerWidth`,'signup fits '+width);
  }
  command('screenshot','/tmp/pondwise-signup-desktop.png');
  submit('account-signup',{name:'Test Keeper',email:'keeper@example.test',password:'unique-test-password',confirm:'wrong-pass',consent:true});
  check(`document.querySelector('.account-error').textContent.includes('match') && !localStorage.getItem('pondwise_account')`,'mismatched password rejected');
  submit('account-signup',{confirm:'unique-test-password'}); command('wait','#desktopNav a');
  check(`PondAccount.signedIn() && !localStorage.getItem('pondwise_account').includes('unique-test-password')`,'signup hashes password and opens dashboard');
  go('ponds'); submit('pond-create',{name:'Preserved pond'});
  const notebook=run(`localStorage.getItem('pondwise_v2')`);
  go('profile');
  submit('account-profile',{name:'Updated Keeper',email:'updated@example.test'});
  check(`JSON.parse(localStorage.getItem('pondwise_account')).name==='Updated Keeper' && document.querySelector('.profile-summary').textContent.includes('updated@example.test')`,'profile changes persist');
  act(`window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='pondwise_account')throw Error('Quota exceeded');return originalSet.call(this,k,v)}`);
  submit('account-profile',{name:'Must not save'});
  check(`document.querySelector('.account-error').textContent.includes('Quota') && JSON.parse(localStorage.getItem('pondwise_account')).name==='Updated Keeper'`,'failed profile save retains persisted values');
  act(`Storage.prototype.setItem=window.originalSet`);
  submit('account-password',{current:'wrong-password',password:'replacement-password',confirm:'replacement-password'});
  check(`document.querySelector('#account-password .account-error').textContent.includes('incorrect')`,'password change verifies old password');
  submit('account-password',{current:'unique-test-password'});
  check(`document.querySelector('#notice').textContent.includes('Password changed')`,'password change succeeds');
  go('settings'); act(`document.querySelector('[data-tab=data]').click()`);
  check(`document.querySelector('main').textContent.includes('Backup download and restore are unavailable')`,'Free tier backup stays gated');
  act(`document.querySelector('[data-tab=appearance]').click();document.querySelector('[data-account-action=theme]').click()`); command('reload');
  check(`document.documentElement.dataset.theme==='dark' && document.querySelector('[role=switch]').getAttribute('aria-checked')==='true'`,'dark theme persists after reload');
  go('plans'); act(`document.querySelector('[data-tier=elite]').click()`); go('settings'); act(`document.querySelector('[data-tab=data]').click()`);
  check(`!!document.querySelector('[data-action=export]') && !!document.querySelector('#restoreFile')`,'Elite enables backup and restore');
  for(const width of [320,390,768,1024,1440]) {
    command('set','viewport',String(width),'900');
    for(const route of ['profile','settings','more']) {go(route);check(`document.documentElement.scrollWidth<=innerWidth`,route+' fits '+width);}
  }
  go('profile'); command('screenshot','/tmp/pondwise-profile-desktop.png');
  command('set','viewport','390','844'); command('screenshot','/tmp/pondwise-profile-mobile.png');
  go('settings'); act(`document.querySelector('[data-tab=data]').click()`); command('screenshot','/tmp/pondwise-settings-dark-mobile.png');
  act(`document.querySelector('[data-tab=account]').click();document.querySelector('[data-account-action=logout]').click()`);
  check(`!PondAccount.signedIn() && !!document.querySelector('#account-login')`,'logout closes session');
  assert.equal(run(`localStorage.getItem('pondwise_v2')`),notebook,'account changes keep pond data');
  go('ponds'); check(`!!document.querySelector('#account-login')`,'signed-out deep link stays gated');
  submit('account-login',{email:'updated@example.test',password:'unique-test-password'});
  check(`document.querySelector('.account-error').textContent.includes('incorrect')`,'old password no longer signs in');
  submit('account-login',{password:'replacement-password'}); command('wait','#desktopNav a');
  check(`PondAccount.signedIn()`,'new password signs in');
  go('privacy'); check(`document.querySelector('h1').textContent==='Privacy Policy'`,'privacy policy opens');
  go('settings'); act(`document.querySelector('[data-tab=data]').click()`); act(`document.querySelector('[data-tab=account]').click();document.querySelector('[data-account-action=logout]').click()`);
  submit('account-login',{email:'user@gmail.com',password:'wrong-password'});
  check(`!PondAccount.signedIn()`,'demo rejects incorrect password');
  submit('account-login',{password:'user123'}); command('wait','#desktopNav a');
  check(`PondAccount.signedIn() && PondAccount.isDemo()`,'static demo credentials sign in');
  check(`JSON.parse(localStorage.getItem('pondwise_demo_v2')).data.ponds[0].name==='Tilapia pond' && JSON.parse(localStorage.getItem('pondwise_demo_v2')).data.feedLogs.length===1`,'demo login assigns seeded pond data');
  assert.equal(run(`localStorage.getItem('pondwise_v2')`),notebook,'demo login preserves personal notebook');
  const demoNotebook=run(`localStorage.getItem('pondwise_demo_v2')`);
  command('reload');
  check(`PondAccount.isDemo() && document.querySelector('#workspaceBanner').textContent.includes('Demo workspace')`,'reload opens demo workspace');
  assert.equal(run(`localStorage.getItem('pondwise_demo_v2')`),demoNotebook,'demo reload does not reseed');
  go('settings'); act(`document.querySelector('[data-tab=data]').click()`);act(`document.querySelector('[data-tab=account]').click();document.querySelector('[data-account-action=logout]').click()`);
  submit('account-login',{email:'updated@example.test',password:'replacement-password'});command('wait','#desktopNav a');go('ponds');
  check(`!PondAccount.isDemo() && document.querySelector('main').textContent.includes('Preserved pond')`,'personal sign-in returns to personal notebook');
  console.log('PASS all account checks');
} finally {try {command('close');}catch(_){}}
