/* Browser-local onboarding. This is not server authentication or data encryption. */
(() => {
  'use strict';
  const KEY = 'pondwise_account', SESSION = 'pondwise_session', THEME = 'pondwise_theme', DEMO_KEY = 'pondwise_demo_account';
  const DEMO = {id:'pondwise-static-demo',name:'Pond Keeper',email:'user@gmail.com',photo:'',salt:[80,111,110,100,87,105,115,101,68,101,109,111,50,48,50,54],verifier:'adfaa0c0ccb224d83e0765c2f2b3292dcf34b4280739e6f507cfa78b619b1bed'};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let account = null, warning = '';
  try { account = JSON.parse(localStorage.getItem(KEY)); } catch (_) { warning = 'Your local profile could not be read. Pond records have been kept. Restore browser storage access before creating a profile.'; }
  try { if (sessionStorage.getItem(SESSION) === DEMO.id) account = {...DEMO,...JSON.parse(localStorage.getItem(DEMO_KEY) || '{}')}; } catch (_) { /* Sign-in remains available. */ }
  const isDemo = () => account?.id === DEMO.id;
  function signedIn() { try { return !!account && sessionStorage.getItem(SESSION) === account.id; } catch (_) { return false; } }
  function save(next) { localStorage.setItem(next.id === DEMO.id ? DEMO_KEY : KEY, JSON.stringify(next)); account = next; }
  function theme(value) { document.documentElement.dataset.theme = value === 'dark' ? 'dark' : 'light'; }
  try { theme(localStorage.getItem(THEME)); } catch (_) { theme('light'); }
  const input = (name, label, type = 'text', value = '', attrs = '') => `<div class="field"><label for="account-field-${name}">${label}</label><input id="account-field-${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`;
  const error = '<p class="account-error" role="alert" tabindex="-1" hidden></p>';
  const photo = () => account?.photo ? `<img class="avatar" src="${esc(account.photo)}" alt="Your profile photo" width="88" height="88">` : `<span class="avatar avatar-initials" aria-label="Profile initials">${esc((account?.name || 'Pond Keeper').split(/\s+/).slice(0,2).map(s => s[0]).join('').toUpperCase())}</span>`;
  function authView() {
    const login = location.hash === '#signin' || (!!account && location.hash !== '#signup');
    return `<div class="auth-layout"><div class="auth-story"><a class="brand" href="#signup"><img src="assets/logo.svg" alt="" width="48" height="48">PondWise</a><div><p class="eyebrow">YOUR DAILY POND NOTEBOOK</p><h2>A little care.<br>A healthier pond.</h2><p>Keep your fish, feeding and daily pond work together.</p><img class="auth-pond" src="assets/pond.svg" alt="Illustration of a pond" width="440" height="240"></div><small>One pond. One day at a time.</small></div><section class="auth-card"><p class="eyebrow">LET’S GET STARTED</p><h1>${login ? 'Welcome back' : 'Create your profile'}</h1><p>${login ? 'Sign in to your notebook on this browser.' : 'Set up your notebook before heading to the dashboard.'}</p><form id="account-${login ? 'login' : 'signup'}" data-account>${error}${login ? '' : input('name','Full name','text','','required maxlength="120" autocomplete="name"')}${input('email','Email address','email',login ? (account?.email || '') : '','required maxlength="254" autocomplete="email"')}${input('password','Password','password','','required minlength="'+(login ? '1' : '8')+'" maxlength="128" autocomplete="'+(login ? 'current-password' : 'new-password')+'"')}${login ? '' : input('confirm','Confirm password','password','','required minlength="8" maxlength="128" autocomplete="new-password"')}${login ? '' : '<label class="account-consent"><input name="consent" type="checkbox" required> <span>I have read the <a href="#terms">Terms & Conditions</a> and <a href="#privacy">Privacy Policy</a>.</span></label>'}<button class="primary" type="submit">${login ? 'Sign in' : 'Create profile & continue'}</button></form><p><a href="#${login ? 'signup' : 'signin'}">${login ? 'Create a local profile' : 'Already have a profile? Sign in'}</a></p><p class="demo-login-note"><a href="#signin">Quick access</a>: <strong>user@gmail.com</strong> · <strong>user123</strong><br></p><p class="local-note">Your notebook is saved in this browser. Use a unique password.</p>${warning ? `<p role="alert">${esc(warning)}</p>` : ''}</section></div>`;
  }
  function profileView(tier) {
    return `<div class="page-head"><p class="eyebrow">YOUR ACCOUNT</p><h1>Profile</h1><p>Your personal details and notebook preferences.</p></div><section class="panel profile-summary">${photo()}<div><h2>${esc(account.name)}</h2><p>${esc(account.email)}</p><span class="plan-badge">Account type: ${({start:'Free',pro:'Pro',elite:'Elite'})[tier]}</span></div><a class="button" href="#plans">View plans</a></section><section class="panel"><h2>Profile picture</h2><p>Add or change your profile photo. JPEG, PNG or WebP, up to 2 MiB.</p><label for="profile-photo">Choose a photo</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp"><button type="button" data-account-action="remove-photo">Remove photo</button></section><section class="panel"><h2>Edit profile</h2><form id="account-profile" data-account>${error}${input('name','Full name','text',account.name,'required maxlength="120" autocomplete="name"')}${input('email','Email address','email',account.email,'required maxlength="254" autocomplete="email" '+(isDemo() ? 'readonly' : ''))}<p class="muted">${isDemo() ? 'This account’s email is fixed. ' : ''}Email changes apply to this browser’s profile only.</p><button type="submit" class="primary">Save profile</button></form></section><section class="panel"><h2>Change password</h2>${isDemo() ? '<p>This account uses a shared password. Create your own profile to set a personal password.</p>' : `<form id="account-password" data-account>${error}${input('current','Current password','password','','required maxlength="128" autocomplete="current-password"')}${input('password','New password','password','','required minlength="8" maxlength="128" autocomplete="new-password"')}${input('confirm','Confirm new password','password','','required minlength="8" maxlength="128" autocomplete="new-password"')}<button class="primary" type="submit">Change password</button></form>`}</section>`;
  }
  const details = (title, text) => `<details class="panel setting-detail"><summary>${title}</summary>${text}</details>`;
  function settingsIntro() {
    return `<section class="panel"><div class="setting-row"><div><h2>Dark mode</h2></div><button type="button" role="switch" aria-checked="${document.documentElement.dataset.theme === 'dark'}" data-account-action="theme" aria-label="Dark mode">${document.documentElement.dataset.theme === 'dark' ? 'On' : 'Off'}</button></div></section>`;
  }
  function settingsFooter() {
    return `<section class="panel"><h2>PondWise Helper</h2><a class="button primary" href="#helper">Open conversation</a></section><section class="panel"><h2>Support</h2><button type="button" data-account-action="report">Download problem report</button>${PondUI.info('Problem report','Includes app version and browser details, without pond records or personal information. Share it with your app maintainer.')}</section><section class="panel"><h2>About PondWise</h2><span>Version 3.0</span><div class="actions"><a class="button" href="#terms">Terms & conditions</a><a class="button" href="#privacy">Privacy policy</a></div></section>`;
  }
  function legalText(kind) {
    return kind === 'terms' ? '<p>PondWise is a local pond notebook. Feed estimates and helper answers are informational and do not replace professional aquaculture advice. You are responsible for checking measurements and keeping backups.</p><p>Choosing Free, Pro or Elite does not collect a payment. Data may be lost if browser storage is cleared. This version provides no cloud sync or account recovery.</p>' : '<p>Your name, email, profile photo, password verifier, preferences and pond records are stored on this browser and origin. Passwords are salted and hashed locally; pond data and backups are not encrypted. No account information is sent to a server.</p><p>PondWise Helper sends your conversation and selected pond context to Meta Muse Spark 1.3 Contributor, which may use this content for model training. Profile credentials and financial records are excluded. Conversations are retained in this tab until you start a new chat or close the tab. The species lookup may contact an external species service with your search. Exported files are stored wherever you choose to save them. Clearing site data removes the local profile and notebook; back up your records first.</p>';
  }
  function legalView(kind) { return `<section class="panel legal-page"><h1>${kind === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h1>${legalText(kind)}<a class="button" href="#${signedIn() ? 'settings' : 'signup'}">Back</a></section>`; }
  async function hash(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:Uint8Array.from(salt), iterations:210000, hash:'SHA-256'}, key, 256);
    return Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2,'0')).join('');
  }
  function refresh(message) { window.dispatchEvent(new CustomEvent('pondwise-account', {detail:message})); }
  document.addEventListener('submit', async event => {
    const form = event.target; if (!form.matches('[data-account]')) return;
    event.preventDefault(); const submit = form.querySelector('[type=submit]'); submit.disabled = true;
    const v = Object.fromEntries(new FormData(form));
    try {
      if (!form.reportValidity()) return;
      if (v.name !== undefined && !v.name.trim()) throw Error('Enter your full name.');
      if (v.confirm !== undefined && v.confirm !== v.password) throw Error('Passwords do not match.');
      if (form.id === 'account-signup') {
        if (v.email.trim().toLowerCase() === DEMO.email) throw Error('This email is reserved for a shared account. Choose Sign in and use user123.');
        if (localStorage.getItem(KEY)) throw Error('A profile already exists in this browser. Reload to sign in.');
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
        const next = {id:crypto.randomUUID(), name:v.name.trim(), email:v.email.trim().toLowerCase(), salt, verifier:await hash(v.password,salt), photo:''};
        save(next); sessionStorage.setItem(SESSION,next.id); location.hash = 'overview'; refresh('Profile created. Welcome to PondWise.');
      } else if (form.id === 'account-login') {
        const candidate = v.email.trim().toLowerCase() === DEMO.email ? DEMO : JSON.parse(localStorage.getItem(KEY));
        if (!candidate || v.email.trim().toLowerCase() !== candidate.email || await hash(v.password,candidate.salt) !== candidate.verifier) throw Error('Email or password is incorrect.');
        account = candidate.id === DEMO.id ? {...DEMO,...JSON.parse(localStorage.getItem(DEMO_KEY) || '{}')} : candidate;
        sessionStorage.setItem(SESSION,account.id); location.hash = 'overview'; refresh('Welcome back.');
      } else {
        if (!signedIn()) throw Error('Sign in again before saving.');
        if (form.id === 'account-profile' && v.email.trim().toLowerCase() === DEMO.email && !isDemo()) throw Error('This email is reserved for a shared account.');
        if (form.id === 'account-profile') save({...account,name:v.name.trim(),email:isDemo() ? DEMO.email : v.email.trim().toLowerCase()});
        if (form.id === 'account-password') {
          if (isDemo()) throw Error('Shared account credentials are fixed. Create a local profile to use your own password.');
          if (await hash(v.current,account.salt) !== account.verifier) throw Error('Current password is incorrect.');
          const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
          save({...account,salt,verifier:await hash(v.password,salt)});
        }
        refresh(form.id === 'account-profile' ? 'Profile saved.' : 'Password changed.');
      }
    } catch (e) { const node = form.querySelector('.account-error'); node.hidden = false; node.textContent = e.message; node.focus(); }
    finally { submit.disabled = false; }
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-account-action]'); if (!target) return;
    try {
      const action = target.dataset.accountAction;
      if (action === 'theme') { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME,next); theme(next); target.setAttribute('aria-checked',String(next === 'dark')); target.textContent = next === 'dark' ? 'On' : 'Off'; }
      if (action === 'remove-photo') { save({...account,photo:''}); refresh('Profile photo removed.'); }
      if (action === 'logout') { sessionStorage.removeItem(SESSION); location.hash = 'signin'; refresh('Signed out. Saved records remain in this browser.'); }
      if (action === 'report') {
        const url = URL.createObjectURL(new Blob([JSON.stringify({app:'PondWise',version:'2.1.0',time:new Date().toISOString(),browser:navigator.userAgent},null,2)],{type:'application/json'}));
        const a = document.createElement('a'); a.href=url; a.download='pondwise-problem-report.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    } catch (e) { refresh('Not saved. '+e.message); }
  });
  document.addEventListener('change', async event => {
    if (event.target.id !== 'profile-photo') return;
    try {
      if (!signedIn()) throw Error('Sign in before changing your photo.');
      const file = event.target.files[0]; if (!file) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2*1024*1024) throw Error('Choose a JPEG, PNG or WebP image up to 2 MiB.');
      const bitmap = await createImageBitmap(file), canvas = document.createElement('canvas');
      canvas.width=canvas.height=256; const side=Math.min(bitmap.width,bitmap.height);
      canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256); bitmap.close();
      save({...account,photo:canvas.toDataURL('image/jpeg',0.85)}); refresh('Profile photo saved.');
    } catch (e) { refresh('Photo not saved. '+e.message); }
  });
  window.addEventListener('storage', event => { if (event.key === (isDemo() ? DEMO_KEY : KEY) || event.key === null) { try { account=JSON.parse(localStorage.getItem(KEY)); } catch (_) { account=null; } sessionStorage.removeItem(SESSION); refresh('Profile changed in another tab. Sign in again.'); } if (event.key === THEME) theme(event.newValue); });
  window.PondAccount = {signedIn,isDemo,authView,profileView,settingsIntro,settingsFooter,legalView};
})();
