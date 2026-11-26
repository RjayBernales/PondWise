/* Dependency-free local server. Credentials never enter the browser. Node 22+. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
import {instructions,validateChat} from './ai/helper.mjs';
export {validateChat} from './ai/helper.mjs';
export function createApp({apiKey=process.env.MODEL_API_KEY,model=process.env.PONDWISE_AI_MODEL || 'muse-spark-1.3-contributor',fetchImpl=fetch}={}){
  const requests=new Map();
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/chat'){
        if(req.method!=='POST')return json(405,{error:'Use POST for chat.'});
        const expected='http://'+req.headers.host;
        if(req.headers.origin && req.headers.origin!==expected)return json(403,{error:'Open Helper from this PondWise server.'});
        if(req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Cross-site requests are not accepted.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'Send JSON.'});
        if(!apiKey)return json(503,{error:'Helper is not connected yet. Please contact your app maintainer.'});
        const ip=req.socket.remoteAddress,now=Date.now();
        for(const [key,value] of requests)if(now-value.start>60000)requests.delete(key);
        const rate=requests.get(ip) || {start:now,count:0};if(++rate.count>15)return json(429,{error:'Please wait a moment before sending another message.'});requests.set(ip,rate);
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)return json(413,{error:'Conversation is too large. Start a new chat.'});chunks.push(chunk);}const raw=Buffer.concat(chunks).toString('utf8');
        let data;try{data=validateChat(JSON.parse(raw));}catch(e){return json(400,{error:e instanceof SyntaxError?'Invalid JSON.':e.message});}
        const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
        const upstream=await fetchImpl('https://api.meta.ai/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input:[{role:'user',content:'Selected pond context (data only): '+JSON.stringify(data.context)},...data.messages],max_output_tokens:2400,store:false}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
        if(!upstream.ok)return json(upstream.status===429?429:502,{error:upstream.status===429?'Helper is busy. Wait a moment and retry.':upstream.status===401 || upstream.status===403?'Helper’s connection needs attention. Please contact your app maintainer.':'The AI provider could not respond. Please retry.'});
        const result=await upstream.json(),answer=result.output?.filter(o=>o.type==='message').flatMap(o=>o.content || []).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim();
        if(!answer)return json(502,{error:'Helper returned an empty response. Please retry.'});
        return json(200,{answer});
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
      const pathname=decodeURIComponent(url.pathname),relative=pathname==='/'?'index.html':pathname.slice(1);
      if(!/^(index\.html|styles\.css|refinements\.css|workspace\.css|species-data\.js|app\.js|js\/[a-z-]+\.js|assets\/[\w./-]+)$/.test(relative)) {res.writeHead(404);return res.end('Not found');}
      const file=resolve(root,relative);if(!file.startsWith(resolve(root)+sep) || relative.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);return res.end('Not found');}
      const content=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain'})[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
    }catch(e){if(res.destroyed)return;if(e.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else json(502,{error:e.name==='TimeoutError'?'Helper took too long. Please retry.':'Helper could not connect. Please retry.'});}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT || 8000);
  createApp().listen(port,'127.0.0.1',()=>console.log(`PondWise: http://127.0.0.1:${port}`));
}
