/* Optional visual and interaction checks using the taste skill's headless CDP helper.
   Set PONDWISE_CDP_MODULE to that skill's scripts/lib/cdp.mjs and CHROME_PATH to Chromium. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
if (!process.env.PONDWISE_CDP_MODULE) throw Error('Set PONDWISE_CDP_MODULE to the taste skill scripts/lib/cdp.mjs.');
const {Browser,sleep} = await import(pathToFileURL(process.env.PONDWISE_CDP_MODULE));
let server;
let origin=process.env.PONDWISE_TEST_URL;
if (!origin) {
  const root=resolve(new URL('..',import.meta.url).pathname);
  server=createServer((req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));if(!file.startsWith(root+sep))throw Error('Invalid path');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));}catch(_){res.statusCode=404;res.end('Not found');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
}
const browser = await Browser.launch({extraArgs:['--disable-extensions','--renderer-process-limit=2']});
const page = await browser.newPage({width:1440,height:900,reducedMotion:true});
const out=process.env.PONDWISE_SHOTS || '/tmp/pondwise-refinements';mkdirSync(out,{recursive:true});
const route = async r => {await page.eval(r=>{location.hash=r;},r);await sleep(100);};
const shot = name => process.env.PONDWISE_CAPTURE === '0' ? Promise.resolve() : page.screenshot({path:`${out}/${name}.png`,format:'png',fullPage:true});
const checkLayout = async label => {
  const result=await page.eval(()=>({overflow:document.documentElement.scrollWidth>innerWidth,duplicates:(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length!==new Set(ids).size;})(),icons:[...document.querySelectorAll('svg.icon')].every(s=>s.getAttribute('aria-hidden')==='true' && !!s.querySelector('path,rect,circle,g'))}));
  assert.equal(result.overflow,false,`${label}: overflow`);assert.equal(result.duplicates,false,`${label}: duplicate IDs`);assert.equal(result.icons,true,`${label}: accessible real icons`);
};
try {
  await page.goto(origin);
  for(const width of [320,375,768,1440]) {await page.setViewport({width,height:900});await checkLayout('signup '+width);if([375,1440].includes(width))await shot('signup-'+width);}
  for(const authRoute of ['signin','signup','terms','privacy']) {for(const width of [375,1440]) {await page.setViewport({width,height:900});await route(authRoute);await checkLayout(authRoute+' '+width);await shot(authRoute+'-'+width);}}
  await route('signin');
  await page.eval(async()=>{const f=document.querySelector('#account-login');f.elements.email.value='user@gmail.com';f.elements.password.value='user123';f.requestSubmit();for(let i=0;i<100&&!PondAccount.signedIn();i++)await new Promise(r=>setTimeout(r,100));});
  await sleep(100);assert.equal(await page.eval(()=>PondAccount.signedIn()),true,'demo login');
  const data=await page.eval(()=>localStorage.getItem('pondwise_demo_v2'));
  assert.equal(await page.eval(()=>!!document.querySelector('.plan-offer')),true,'offer appears on dashboard');
  await shot('overview-offer-1440');
  await page.eval(()=>document.querySelector('[data-action=purchase]').click());
  assert.equal(await page.eval(()=>document.querySelector('#purchaseDialog').open),true,'purchase opens native dialog');
  assert.equal(await page.eval(()=>!!document.activeElement.closest('#purchaseDialog')),true,'dialog receives keyboard focus');
  assert.equal(await page.eval(()=>document.querySelector('#purchaseDescription').textContent.includes('No payment')),true,'checkout status is clear');
  await shot('purchase-1440');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await sleep(100);assert.equal(await page.eval(()=>document.querySelector('#purchaseDialog').open),false,'Escape closes purchase dialog');
  await page.setViewport({width:375,height:844});await shot('overview-offer-375');
  assert.equal(await page.eval(()=>{const offer=document.querySelector('.plan-offer'),a=offer.getBoundingClientRect();return a.width>0 && a.height>0 && getComputedStyle(offer).position==='relative';}),true,'plan offer stays in document flow');
  await page.eval(()=>document.querySelector('[data-action=offer-close]').click());
  await page.goto((origin)+'/#overview');
  assert.equal(await page.eval(()=>!!document.querySelector('.plan-offer')),false,'offer dismissal persists on reload');
  const routes=['overview','ponds','tasks','records','money','tools','profile','settings','helper','plans','more'];
  for(const theme of ['light','dark']) {
    await page.eval(theme=>document.documentElement.dataset.theme=theme,theme);
    for(const [width,height] of [[320,844],[375,844],[768,1024],[1440,900],[844,390]]) {
      await page.setViewport({width,height});
      for(const r of routes) {await route(r);await checkLayout(`${theme} ${r} ${width}`);if(theme==='light' && [375,1440].includes(width))await shot(`${r}-${theme}-${width}`);if(theme==='dark' && width===375 && ['overview','settings','plans','profile'].includes(r))await shot(`${r}-${theme}-${width}`);}
      console.log(`PASS all routes: ${theme} ${width}x${height}`);
    }
  }
  await route('plans');await page.eval(()=>document.querySelector('[data-action=purchase][data-tier=elite]').click());
  await page.eval(()=>document.querySelector('#purchaseDialog [data-action=plan]').click());
  assert.equal(await page.eval(()=>localStorage.getItem('pondwise_demo_plan')), 'elite','purchase details can start local preview');
  await route('overview');assert.equal(await page.eval(()=>!!document.querySelector('.plan-offer')),false,'Elite has no upgrade offer');
  assert.equal(await page.eval(()=>localStorage.getItem('pondwise_demo_v2')),data,'refinement interactions preserve pond records');
  assert.deepEqual(page.consoleErrors,[],'no runtime exceptions');
  console.log(`PASS offer, native dialog, dismissal, preview, navigation and data integrity. Screenshots: ${out}`);
} finally {await browser.close();if(server)await new Promise(r=>server.close(r));}
