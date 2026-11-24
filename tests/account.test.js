'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/account.js'),'utf8');
function fixture(local = new Map(), session = new Map()) {
  const listeners = {}, notices = [];
  const storage = map => ({getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)});
  const context = {crypto:webcrypto,TextEncoder,Uint8Array,structuredClone,localStorage:storage(local),sessionStorage:storage(session),location:{hash:''},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},FormData:class{constructor(form){return Object.entries(form.values)[Symbol.iterator]();}},document:{documentElement:{dataset:{}},addEventListener:(name,fn)=>listeners[name]=fn},window:{addEventListener(){},dispatchEvent:event=>notices.push(event.detail)}};
  vm.createContext(context); vm.runInContext(source,context);
  const submit = async (id,values) => {
    const error = {hidden:true,textContent:'',focus(){}}, button={disabled:false};
    const form={id,values,matches:()=>true,reportValidity:()=>true,querySelector:q=>q==='[type=submit]'?button:error};
    await listeners.submit({target:form,preventDefault(){}}); return error.textContent;
  };
  const click = action => listeners.click({target:{closest:()=>({dataset:{accountAction:action},setAttribute(){}})}});
  return {context,api:context.window.PondAccount,submit,click,local,session,notices};
}
test('fixed demo credentials sign in, survive reload and stay separate from personal profile',async()=>{
  const f=fixture();
  assert.match(await f.submit('account-login',{email:'user@gmail.com',password:'wrong'}),/incorrect/);
  assert.equal(f.api.signedIn(),false);
  assert.equal(await f.submit('account-login',{email:'user@gmail.com',password:'user123'}),'');
  assert.equal(f.api.signedIn(),true); assert.equal(f.api.isDemo(),true);
  assert.equal(f.local.has('pondwise_account'),false);
  const reload=fixture(f.local,f.session); assert.equal(reload.api.signedIn(),true);assert.equal(reload.api.isDemo(),true);
  assert.match(await reload.submit('account-password',{current:'user123',password:'changed-password',confirm:'changed-password'}),/fixed/);
  reload.click('logout');assert.equal(reload.api.signedIn(),false);
});
test('personal signup hashes passwords, validates changes and preserves notebook',async()=>{
  const f=fixture();f.local.set('pondwise_v2','existing notebook');
  assert.match(await f.submit('account-signup',{name:'Keeper',email:'user@gmail.com',password:'anything',confirm:'anything'}),/reserved/);
  assert.match(await f.submit('account-signup',{name:'Keeper',email:'keeper@example.test',password:'unique-password',confirm:'different'}),/match/);
  assert.equal(await f.submit('account-signup',{name:'Keeper',email:'keeper@example.test',password:'unique-password',confirm:'unique-password'}),'');
  assert.equal(f.api.signedIn(),true);assert.equal(f.api.isDemo(),false);
  const saved=JSON.parse(f.local.get('pondwise_account'));assert.equal(saved.name,'Keeper');assert.equal(saved.verifier.length,64);assert.equal(f.local.get('pondwise_account').includes('unique-password'),false);
  assert.equal(await f.submit('account-profile',{name:'New Name',email:'new@example.test'}),'');
  assert.match(await f.submit('account-password',{current:'wrong',password:'new-password',confirm:'new-password'}),/incorrect/);
  assert.equal(await f.submit('account-password',{current:'unique-password',password:'new-password',confirm:'new-password'}),'');
  f.click('logout');assert.equal(f.api.signedIn(),false);
  assert.match(await f.submit('account-login',{email:'new@example.test',password:'unique-password'}),/incorrect/);
  assert.equal(await f.submit('account-login',{email:'new@example.test',password:'new-password'}),'');
  assert.equal(f.local.get('pondwise_v2'),'existing notebook');
  f.click('theme');assert.equal(f.context.document.documentElement.dataset.theme,'dark');
  assert.equal(fixture(f.local,f.session).context.document.documentElement.dataset.theme,'dark');
});
