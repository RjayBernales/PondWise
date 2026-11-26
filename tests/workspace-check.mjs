import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createApp} from '../server.mjs';
import {pathToFileURL} from 'node:url';
if(!process.env.PONDWISE_CDP_MODULE)throw Error('Set PONDWISE_CDP_MODULE to the taste skill scripts/lib/cdp.mjs.');
const {Browser,sleep}=await import(pathToFileURL(process.env.PONDWISE_CDP_MODULE));
const app=createApp({apiKey:'test-only',fetchImpl:async(_,options)=>{const payload=JSON.parse(options.body);await new Promise(r=>setTimeout(r,100));return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Check appetite and your latest water readings. You asked: '+payload.input.at(-1).content}]}]});}});
await new Promise(r=>app.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+app.address().port;
const browser=await Browser.launch();const page=await browser.newPage({width:1440,height:1000,reducedMotion:true});
mkdirSync('/tmp/pondwise-workspace',{recursive:true});
const route=async r=>{await page.eval(r=>location.hash=r,r);await sleep(120);};
async function layout(label){const result=await page.eval(()=>({overflow:document.documentElement.scrollWidth>innerWidth,duplicate:(()=>{const a=[...document.querySelectorAll('[id]')].map(x=>x.id);return a.length!==new Set(a).size;})(),demo:/\bdemo\b|practice pond|sample data/i.test(document.querySelector('main').innerText)}));assert(!result.overflow,label+' overflow');assert(!result.duplicate,label+' IDs');assert(!result.demo,label+' demo text');}
try {
await page.goto(base+'/#signin');await sleep(100);
await page.eval(()=>{const f=document.querySelector('#account-login');f.elements.email.value='user@gmail.com';f.elements.password.value='user123';f.requestSubmit();});
for(let i=0;i<100;i++){if(await page.eval(()=>PondAccount.signedIn()))break;await sleep(100);}
await route('overview');
assert(await page.eval(()=>!!document.querySelector('.chat-shell')),'dashboard chat');
await page.eval(()=>{const f=document.querySelector('.chat-composer');f.elements.message.value='fsh nt eatng wat do??';f.requestSubmit();});await sleep(500);
assert((await page.eval(()=>document.querySelector('.chat-transcript').innerText)).includes('Check appetite'),'generative server response');
await route('helper');assert((await page.eval(()=>document.querySelector('.chat-transcript').innerText)).includes('fsh nt eatng'),'shared dashboard history');
const firstPond=await page.eval(()=>document.querySelector('#pondContext').value);
await route('plans');await page.eval(()=>document.querySelector('[data-action=plan][data-tier=elite]').click());
await route('ponds');await page.eval(()=>{const f=document.querySelector('#pond-create');f.elements.name.value='South pond';f.requestSubmit();});await sleep(150);
await route('helper');assert.equal(await page.eval(()=>document.querySelectorAll('.chat-message').length),0,'new pond has separate history');
await page.eval(id=>{const picker=document.querySelector('#pondContext');picker.value=id;picker.dispatchEvent(new Event('change',{bubbles:true}));},firstPond);await sleep(150);
assert((await page.eval(()=>document.querySelector('.chat-transcript').innerText)).includes('fsh nt eatng'),'switching back restores original pond history');
await page.eval(()=>{document.querySelector('[data-chat-new]').click();});assert.equal(await page.eval(()=>document.querySelectorAll('.chat-message').length),0,'new chat clears');
await page.eval(()=>{document.querySelector('.info-button').click();});assert.equal(await page.eval(()=>document.querySelectorAll(':popover-open').length),1,'click opens info');
await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await page.eval(()=>document.querySelectorAll(':popover-open').length),0,'Escape closes info');
for(const theme of ['light','dark']){await page.eval(t=>document.documentElement.dataset.theme=t,theme);for(const [w,h] of [[320,844],[390,844],[768,1024],[1024,768],[1440,1000],[844,390]]){await page.setViewport({width:w,height:h});for(const r of ['overview','helper','settings','ponds','tasks','records','tools','money','profile','plans','more']){await route(r);await layout(`${theme} ${r} ${w}`);if(r==='settings'){for(const tab of ['appearance','farm','account','data','help']){await page.eval(tab=>document.querySelector('[data-tab="'+tab+'"]').click(),tab);await layout(`${theme} settings ${tab} ${w}`);}}if([390,1440].includes(w)&&['overview','helper','settings'].includes(r))await page.screenshot({path:`/tmp/pondwise-workspace/${r}-${theme}-${w}.png`,fullPage:true});}console.log(`PASS ${theme} ${w}x${h}`);}}
assert.deepEqual(page.consoleErrors,[],'runtime errors');console.log('PASS generation, history, new chat, info panels, Settings and responsive routes.');
}finally{await browser.close();await new Promise(r=>app.close(r));}
