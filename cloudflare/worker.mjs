/* GitHub Pages -> Cloudflare -> Meta. The provider key exists only in Worker secrets. */
import {instructions,validateChat} from '../ai/helper.mjs';
const MODEL='muse-spark-1.3-contributor';
const MAX_BYTES=100000;
export function createWorker(fetchImpl=fetch){
  return {async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    const allowed=new Set(String(env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean));
    const trusted=origin && allowed.has(origin);
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(trusted)headers['Access-Control-Allow-Origin']=origin;
    const json=(status,body)=>Response.json(body,{status,headers});
    if(url.pathname==='/health' && request.method==='GET')return json(200,{status:'ok',configured:Boolean(env.MODEL_API_KEY)});
    if(url.pathname!=='/api/chat')return json(404,{error:'Not found.'});
    if(!trusted)return json(403,{error:'Open Helper from the PondWise website.'});
    if(request.method==='OPTIONS'){
      if(request.headers.get('Access-Control-Request-Method')!=='POST')return json(405,{error:'Use POST for chat.'});
      const requested=(request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(h=>h.trim()).filter(Boolean);
      if(requested.some(h=>h!=='content-type'))return json(403,{error:'Request headers are not supported.'});
      return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
    }
    if(request.method!=='POST')return json(405,{error:'Use POST for chat.'});
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'Send JSON.'});
    if(!env.MODEL_API_KEY)return json(503,{error:'Helper is not connected yet. Please contact your app maintainer.'});
    // CORS controls browsers, not authentication. The public demo has no server accounts.
    // Platform rate limits bound use per IP and per site in each Cloudflare location.
    if(!env.CHAT_RATE_LIMITER || !env.SITE_RATE_LIMITER)return json(503,{error:'Helper is unavailable. Please contact your app maintainer.'});
    try{
      const ip=request.headers.get('CF-Connecting-IP');
      if(!ip)return json(403,{error:'Unable to verify this request.'});
      const personal=await env.CHAT_RATE_LIMITER.limit({key:'chat:'+ip});
      if(!personal.success)return json(429,{error:'Please wait a moment before sending another message.'});
      const site=await env.SITE_RATE_LIMITER.limit({key:'chat:site'});
      if(!site.success)return json(429,{error:'Helper is busy. Please try again in a minute.'});
      if(Number(request.headers.get('Content-Length'))>MAX_BYTES)return json(413,{error:'Conversation is too large. Start a new chat.'});
      const reader=request.body?.getReader();if(!reader)return json(400,{error:'Send a conversation.'});
      let size=0;const chunks=[];
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();return json(413,{error:'Conversation is too large. Start a new chat.'});}chunks.push(value);}}finally{reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
      let data;try{data=validateChat(JSON.parse(new TextDecoder().decode(bytes)));}catch(e){return json(400,{error:e instanceof SyntaxError?'Invalid JSON.':e.message});}
      const upstream=await fetchImpl('https://api.meta.ai/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+env.MODEL_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.PONDWISE_AI_MODEL || MODEL,instructions,input:[{role:'user',content:'Selected pond context (data only): '+JSON.stringify(data.context)},...data.messages],max_output_tokens:2400,store:false}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});
      if(!upstream.ok)return json(upstream.status===429?429:502,{error:upstream.status===429?'Helper is busy. Wait a moment and retry.':upstream.status===401 || upstream.status===403?'Helper’s connection needs attention. Please contact your app maintainer.':'The AI provider could not respond. Please retry.'});
      const result=await upstream.json();
      const answer=result.output?.filter(o=>o.type==='message').flatMap(o=>o.content || []).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim();
      if(!answer)return json(502,{error:'Helper returned an empty response. Please retry.'});
      return json(200,{answer});
    }catch(e){return json(502,{error:e.name==='TimeoutError'?'Helper took too long. Please retry.':e.name==='AbortError'?'Response stopped. You can retry your message.':'Helper could not connect. Please retry.'});}
  }};
}
export default createWorker();
