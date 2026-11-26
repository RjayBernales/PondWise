/* Generative chat. Session-only histories are isolated by workspace and pond. */
(() => {
  const chats = new Map();
  let current = null;
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function thread(key) {
    if (!chats.has(key)) {
      let messages = [];
      try { const saved = JSON.parse(sessionStorage.getItem('pondwise_chat:'+key) || '[]'); if (Array.isArray(saved)) messages = saved.filter(m=>['user','assistant'].includes(m.role) && typeof m.content === 'string').slice(-40); } catch (_) {}
      chats.set(key,{messages,pending:false,error:'',draft:'',controller:null});
    }
    return chats.get(key);
  }
  function persist(key,t) { try { sessionStorage.setItem('pondwise_chat:'+key,JSON.stringify(t.messages.slice(-40))); } catch (_) {} }
  function paint() {
    if (!current || !current.root.isConnected) return;
    const {root,options} = current, t = thread(options.key), focus = root.contains(document.activeElement), position = root.querySelector('textarea')?.selectionStart;
    const visible = options.compact ? t.messages.slice(-4) : t.messages;
    root.innerHTML = `<div class="chat-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">${visible.length ? visible.map(m=>`<article class="chat-message message-${m.role}"><span class="message-author">${m.role === 'user' ? 'You' : 'Helper'}</span><div class="message-text">${esc(m.content)}</div></article>`).join('') : `<div class="chat-welcome"><span class="welcome-waves">${PondIcons('waves')}</span><h3>What’s happening<br>at your pond?</h3><p>Ask it your way. We’ll work it out together.</p></div>`}${t.pending ? '<div class="chat-thinking" role="status"><span></span><span></span><span></span><b>Thinking…</b></div>' : ''}</div>
    ${t.messages.length ? '' : `<div class="chat-suggestions">${['How is my pond doing?','Help me plan feeding','Fish acting unusual?'].map(q=>`<button type="button" data-chat-prompt="${q}">${q}${PondIcons('arrow-up-right')}</button>`).join('')}</div>`}
    ${t.error ? `<div class="chat-error" role="alert">${esc(t.error)} <button type="button" data-chat-retry>Retry</button></div>` : ''}
    <form class="chat-composer"><label for="chatMessage">Message Helper</label><div class="composer-field"><textarea id="chatMessage" name="message" rows="2" maxlength="6000" placeholder="Ask anything about your pond…" required>${esc(t.draft)}</textarea>${t.pending ? '<button type="button" data-chat-stop aria-label="Stop response">Stop</button>' : `<button class="primary chat-send" type="submit" aria-label="Send message">${PondIcons('arrow-up-right')}</button>`}</div><span class="composer-hint">${options.compact ? '<a href="#helper">Open full conversation</a>' : 'Enter to send · Shift + Enter for a new line'}</span></form>`;
    const log = root.querySelector('.chat-transcript'); log.scrollTop = log.scrollHeight;
    if (focus) { const field=root.querySelector('textarea'); field.focus({preventScroll:true}); if(position !== undefined)field.setSelectionRange(position,position); }
  }
  async function send(text, retry = false) {
    if (!current) return;
    const {options} = current, key = options.key, t = thread(key);
    if (t.pending || !text?.trim()) return;
    if (!retry) t.messages.push({role:'user',content:text.trim().slice(0,6000)});
    t.draft=''; t.error=''; t.pending=true; t.controller=new AbortController(); persist(key,t); paint();
    try {
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:t.messages.slice(-24),context:options.context}),signal:AbortSignal.any([t.controller.signal,AbortSignal.timeout(65000)])});
      const result=await response.json().catch(()=>({error:'Helper is unavailable. Please contact your app maintainer.'}));
      if(!response.ok || !result.answer) throw Error(result.error || 'Helper could not answer. Try again.');
      t.messages.push({role:'assistant',content:result.answer}); persist(key,t);
    } catch(error) { t.error=error.name === 'AbortError' ? 'Response stopped. You can retry your message.' : error.name === 'TimeoutError' ? 'The response took too long. Try again.' : error.message === 'Failed to fetch' ? 'Cannot reach Helper. Check your connection and try again.' : error.message; }
    finally { t.pending=false; t.controller=null; if(current?.options.key === key)paint(); }
  }
  document.addEventListener('submit',event=>{if(!event.target.matches('.chat-composer'))return; event.preventDefault();send(new FormData(event.target).get('message'));});
  document.addEventListener('input',event=>{if(event.target.id === 'chatMessage' && current) thread(current.options.key).draft=event.target.value;});
  document.addEventListener('keydown',event=>{if(event.target.id === 'chatMessage' && event.key === 'Enter' && !event.shiftKey && !event.isComposing){event.preventDefault();event.target.form.requestSubmit();}});
  document.addEventListener('click',event=>{
    if(!current)return; const t=thread(current.options.key);
    const prompt=event.target.closest('[data-chat-prompt]'); if(prompt)send(prompt.dataset.chatPrompt);
    if(event.target.closest('[data-chat-retry]')) {const last=t.messages.at(-1);if(last?.role==='user')send(last.content,true);}
    if(event.target.closest('[data-chat-stop]'))t.controller?.abort();
    if(event.target.closest('[data-chat-new]')){t.controller?.abort();chats.set(current.options.key,{messages:[],pending:false,error:'',draft:'',controller:null});persist(current.options.key,thread(current.options.key));paint();}
  });
  window.addEventListener('pondwise-account',()=>{if(!PondAccount.signedIn()){for(const t of chats.values())t.controller?.abort();chats.clear();current=null;for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k.startsWith('pondwise_chat:'))sessionStorage.removeItem(k);}}});
  window.PondChat={mount(root,options){current={root,options};thread(options.key);paint();}};
})();
