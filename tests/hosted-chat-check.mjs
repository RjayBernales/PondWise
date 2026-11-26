/* Browser integration: Pages-style frontend -> cross-origin Worker -> simulated Meta. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createApp} from '../server.mjs';
import {createWorker} from '../cloudflare/worker.mjs';
if(!process.env.PONDWISE_CDP_MODULE)throw Error('Set PONDWISE_CDP_MODULE to the taste skill scripts/lib/cdp.mjs.');
const {Browser,sleep}=await import(pathToFileURL(process.env.PONDWISE_CDP_MODULE));
const frontend=createApp({apiKey:''});await new Promise(r=>frontend.listen(0,'127.0.0.1',r));
const frontOrigin='http://127.0.0.1:'+frontend.address().port;
let preflight=0,posts=0,providerInput;
const worker=createWorker(async(_,options)=>{providerInput=JSON.parse(options.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Check today’s appetite and water readings before changing feed.'}]}]});});
const env={MODEL_API_KEY:'test-not-a-real-key',ALLOWED_ORIGINS:frontOrigin,CHAT_RATE_LIMITER:{limit:async()=>({success:true})},SITE_RATE_LIMITER:{limit:async()=>({success:true})}};
const backend=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);if(req.method==='OPTIONS')preflight++;if(req.method==='POST')posts++;const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:{...req.headers,'CF-Connecting-IP':'192.0.2.1'},...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));});
await new Promise(r=>backend.listen(0,'127.0.0.1',r));const endpoint='http://127.0.0.1:'+backend.address().port+'/api/chat';
const browser=await Browser.launch();const page=await browser.newPage({width:390,height:844});
try{
 await page.goto(frontOrigin+'/#signin');
 await page.eval(()=>{const f=document.querySelector('#account-login');f.elements.email.value='user@gmail.com';f.elements.password.value='user123';f.requestSubmit();});
 for(let i=0;i<100;i++){if(await page.eval(()=>PondAccount.signedIn()))break;await sleep(100);}
 await page.eval(url=>{window.PONDWISE_CONFIG=Object.freeze({chatEndpoint:url});location.hash='helper';},endpoint);await sleep(150);
 const before=await page.eval(()=>localStorage.getItem('pondwise_demo_v2'));
 await page.eval(()=>{const f=document.querySelector('.chat-composer');f.elements.message.value='fsh nt eatng wat do';f.requestSubmit();});
 for(let i=0;i<60;i++){if(await page.eval(()=>!!document.querySelector('.message-assistant')))break;await sleep(100);}
 assert((await page.eval(()=>document.querySelector('.chat-transcript').innerText)).includes('Check today’s appetite'),'cross-origin generated response');
 assert(preflight>=1,'browser performed CORS preflight');assert.equal(posts,1);assert.equal(providerInput.input.at(-1).content,'fsh nt eatng wat do');assert(!JSON.stringify(providerInput).includes('user@gmail.com'),'no account information sent to provider');
 assert.equal(await page.eval(()=>localStorage.getItem('pondwise_demo_v2')),before,'chat leaves notebook intact');
 assert.deepEqual(page.consoleErrors,[],'no runtime errors');console.log('PASS cross-origin browser preflight, Worker generation, selected-pond context, privacy and unchanged records.');
}finally{await browser.close();await new Promise(r=>backend.close(r));await new Promise(r=>frontend.close(r));}
