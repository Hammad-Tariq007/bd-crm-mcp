/**
 * Self-contained HTML for the /mcp web surface. No secrets are ever embedded — the page
 * only talks to same-origin endpoints (/mcp/login, /mcp/chat, /mcp/logout). The session is
 * an httpOnly cookie the browser JS cannot read. Chat transcripts (not secrets) are kept in
 * localStorage so conversations persist across reloads, like Claude / ChatGPT.
 */

const STYLE = `
:root{
  --bg:oklch(0.9848 0.0003 230.66);
  --surface:oklch(1 0 0);
  --surface-2:oklch(0.9696 0.0007 230.67);
  --sidebar:oklch(0.9543 0.001 230.67);
  --hover:color-mix(in oklch, oklch(0.2378 0.0029 230.83) 6%, transparent);
  --txt:oklch(0.2378 0.0029 230.83);
  --txt-2:oklch(0.4377 0.0066 230.87);
  --txt-3:oklch(0.5288 0.0083 230.88);
  --txt-ph:oklch(0.6161 0.009153 230.867);
  --border:oklch(0.9389 0.0014 230.68);
  --border-2:oklch(0.8925 0.0024 230.7);
  --brand:oklch(0.4799 0.1158 242.91);
  --brand-hover:oklch(0.4347 0.104093 242.4823);
  --brand-subtle:oklch(0.9847 0.0083 236.56);
  --on-brand:#fff;
  --err:oklch(0.577 0.18 27);
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:oklch(0.1689 0.0021 230.81);
    --surface:oklch(0.1932 0.002 230.81);
    --surface-2:oklch(0.2158 0.0025 230.82);
    --sidebar:oklch(0.1932 0.002 230.81);
    --hover:color-mix(in oklch, oklch(0.9235 0.001733 230.6853) 8%, transparent);
    --txt:oklch(0.9235 0.001733 230.6853);
    --txt-2:oklch(0.8455 0.0035 230.72);
    --txt-3:oklch(0.7655 0.0054 230.76);
    --txt-ph:oklch(0.6835 0.0074 230.81);
    --border:oklch(0.2593 0.0033 230.84);
    --border-2:oklch(0.3415 0.0049 230.86);
    --brand:oklch(0.6311 0.126281 238.01);
    --brand-hover:oklch(0.7408 0.100309 233.89);
    --brand-subtle:oklch(0.2513 0.0418 234.6);
    --err:oklch(0.704 0.17 25);
  }
}
*{box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{margin:0;font:14px/1.6 "Inter","Inter Variable",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--txt);background:var(--bg);-webkit-font-smoothing:antialiased;}
button{font:inherit}

/* ---------- login ---------- */
.login-wrap{max-width:440px;margin:0 auto;padding:12vh 20px 0;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:30px;box-shadow:0 1px 3px rgba(16,24,40,.06);}
.card .brand{display:flex;align-items:center;gap:9px;font-weight:600;font-size:15px;margin-bottom:20px;}
.card .dot{width:9px;height:9px;border-radius:50%;background:var(--brand);}
.card h2{margin:0 0 6px;font-size:19px;font-weight:600;}
.card p.sub{margin:0 0 20px;color:var(--txt-3);font-size:13px;}
label{display:block;font-size:13px;font-weight:500;margin:0 0 6px;color:var(--txt-2);}
input[type=password],input[type=text]{width:100%;font:inherit;padding:11px 12px;border:1px solid var(--border-2);border-radius:9px;background:var(--surface);color:var(--txt);}
input::placeholder{color:var(--txt-ph);}
input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in oklch,var(--brand) 22%,transparent);}
.hint{font-size:12px;color:var(--txt-3);margin:8px 0 0;line-height:1.5;}
.btn{margin-top:18px;width:100%;font-weight:600;background:var(--brand);color:var(--on-brand);border:0;border-radius:9px;padding:11px;cursor:pointer;}
.btn:hover{background:var(--brand-hover);}
.btn:disabled{opacity:.6;cursor:default;}
.msg-err{color:var(--err);font-size:13px;margin-top:12px;min-height:18px;}

/* ---------- app shell ---------- */
.app{display:grid;grid-template-columns:var(--sw,264px) 1fr;height:100dvh;overflow:hidden;transition:grid-template-columns .18s ease;}
.app.collapsed{--sw:0px;}
.sidebar{background:var(--sidebar);border-right:1px solid var(--border);display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.app.collapsed .sidebar{border-right:0;}
.side-head{padding:14px 14px 10px;}
.head-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px 12px;}
.brand{display:flex;align-items:center;gap:9px;font-weight:600;font-size:14.5px;white-space:nowrap;}
.icon-btn{border:0;background:none;color:var(--txt-3);cursor:pointer;font-size:15px;line-height:1;padding:6px 8px;border-radius:8px;display:grid;place-items:center;}
.icon-btn:hover{background:var(--hover);color:var(--txt);}
.expand-btn{position:absolute;top:12px;left:12px;z-index:6;display:none;width:34px;height:34px;background:var(--surface);border:1px solid var(--border);}
.app.collapsed .expand-btn{display:grid;}
.brand .dot{width:9px;height:9px;border-radius:50%;background:var(--brand);}
.new-chat{display:flex;align-items:center;gap:9px;width:100%;border:1px solid var(--border-2);background:var(--surface);color:var(--txt);border-radius:10px;padding:10px 12px;cursor:pointer;font-weight:500;}
.new-chat:hover{background:var(--hover);}
.new-chat .plus{font-size:16px;line-height:1;color:var(--txt-2);}
.list-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--txt-3);padding:10px 12px 6px;}
.chat-list{flex:1;overflow-y:auto;padding:0 8px 8px;}
.chat-item{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;cursor:pointer;color:var(--txt-2);font-size:13.5px;position:relative;}
.chat-item:hover{background:var(--hover);}
.chat-item.active{background:var(--hover);color:var(--txt);}
.chat-item .title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.chat-item .del{border:0;background:none;color:var(--txt-3);cursor:pointer;opacity:0;padding:2px 4px;border-radius:5px;font-size:13px;}
.chat-item:hover .del{opacity:.75;}
.chat-item .del:hover{background:var(--surface-2);color:var(--err);}
.empty-list{color:var(--txt-3);font-size:12.5px;padding:8px 12px;}
.side-foot{border-top:1px solid var(--border);padding:12px 14px;display:flex;align-items:center;gap:10px;}
.avatar{width:28px;height:28px;border-radius:50%;background:var(--brand);color:var(--on-brand);display:grid;place-items:center;font-size:12px;font-weight:600;flex-shrink:0;}
.side-foot .uname{flex:1;font-size:13px;color:var(--txt-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.side-foot .out{border:1px solid var(--border-2);background:var(--surface);color:var(--txt-2);border-radius:7px;padding:5px 9px;font-size:12.5px;cursor:pointer;}
.side-foot .out:hover{background:var(--hover);}

/* ---------- main / thread ---------- */
.main{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;height:100dvh;overflow:hidden;}
.mobile-bar{display:none;flex-shrink:0;}
.scroll{flex:1 1 auto;min-height:0;overflow-y:auto;}
.thread{max-width:768px;margin:0 auto;width:100%;padding:26px 22px 132px;}
.welcome{padding:12vh 4px 4px;}
.welcome h1{font-size:26px;font-weight:600;margin:0 0 8px;letter-spacing:-.01em;}
.welcome p{color:var(--txt-3);margin:0 0 22px;font-size:14.5px;}
.chips{display:flex;flex-wrap:wrap;gap:10px;}
.chip{border:1px solid var(--border);background:var(--surface);border-radius:10px;padding:11px 14px;cursor:pointer;color:var(--txt-2);font-size:13px;text-align:left;line-height:1.35;}
.chip:hover{background:var(--hover);border-color:var(--border-2);color:var(--txt);}

.msg{display:flex;padding:10px 0;}
.msg.user{justify-content:flex-end;}
.msg.user .bubble{background:var(--brand-subtle);color:var(--txt);padding:11px 15px;border-radius:16px 16px 4px 16px;max-width:82%;white-space:pre-wrap;word-wrap:break-word;}
.msg.assistant{gap:13px;}
.msg.assistant .ava{width:26px;height:26px;border-radius:6px;background:var(--brand);color:var(--on-brand);display:grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px;}
.msg.assistant .bubble{min-width:0;flex:1;}
.msg.assistant.err .bubble{color:var(--err);}
/* markdown */
.bubble>*:first-child{margin-top:0}.bubble>*:last-child{margin-bottom:0}
.bubble p{margin:.55em 0}
.bubble h1,.bubble h2,.bubble h3{margin:.8em 0 .4em;line-height:1.3;font-weight:600;}
.bubble h1{font-size:1.3em}.bubble h2{font-size:1.18em}.bubble h3{font-size:1.05em}
.bubble ul,.bubble ol{margin:.5em 0;padding-left:1.4em}
.bubble li{margin:.2em 0}
.bubble a{color:var(--brand);text-decoration:none}.bubble a:hover{text-decoration:underline}
.bubble strong{font-weight:650}
.bubble code{background:var(--surface-2);padding:1px 5px;border-radius:5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em}
.bubble pre{background:var(--surface-2);padding:12px 14px;border-radius:10px;overflow-x:auto;margin:.6em 0}
.bubble pre code{background:none;padding:0;font-size:.86em}
.bubble table{border-collapse:collapse;margin:.7em 0;font-size:13px;display:block;overflow-x:auto;max-width:100%}
.bubble th,.bubble td{border:1px solid var(--border);padding:7px 11px;text-align:left;white-space:nowrap}
.bubble th{background:var(--surface-2);font-weight:600}
.tools{font-size:11px;color:var(--txt-3);margin-top:9px;padding-top:7px;border-top:1px solid var(--border);}
.dots span{display:inline-block;width:6px;height:6px;margin-right:4px;border-radius:50%;background:var(--txt-3);animation:blink 1.4s infinite both;}
.dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}

/* ---------- composer ---------- */
.composer-wrap{position:absolute;left:0;right:0;bottom:0;padding:14px 22px 16px;max-width:768px;margin:0 auto;width:100%;background:linear-gradient(to top,var(--bg) 62%,transparent);}
.composer{display:flex;align-items:flex-end;gap:8px;border:1px solid var(--border-2);border-radius:18px;padding:8px 8px 8px 16px;background:var(--surface);box-shadow:0 1px 2px rgba(16,24,40,.04);}
.composer:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in oklch,var(--brand) 20%,transparent);}
.composer textarea{flex:1;border:0;background:none;resize:none;color:var(--txt);font:inherit;line-height:1.5;max-height:200px;padding:7px 0;outline:none;}
.composer textarea::placeholder{color:var(--txt-ph);}
.send-btn{width:34px;height:34px;border-radius:11px;background:var(--brand);color:var(--on-brand);border:0;display:grid;place-items:center;cursor:pointer;flex-shrink:0;font-size:16px;}
.send-btn:hover{background:var(--brand-hover);}
.send-btn:disabled{opacity:.35;cursor:default;}
.composer-hint{text-align:center;color:var(--txt-3);font-size:11px;margin-top:8px;}

@media (max-width:760px){
  .app{grid-template-columns:1fr!important;}
  .app.collapsed .expand-btn,.expand-btn{display:none!important;}
  .sidebar{position:fixed;z-index:30;top:0;left:0;bottom:0;width:264px;transform:translateX(-100%);transition:transform .2s ease;box-shadow:0 0 40px rgba(0,0,0,.3);}
  .sidebar.open{transform:none;}
  .scrim{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:25;}
  .scrim.show{display:block;}
  .mobile-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface);}
  .mobile-bar button{border:0;background:none;color:var(--txt-2);font-size:20px;cursor:pointer;padding:2px 6px;}
  .mobile-bar .mtitle{font-weight:600;font-size:14px;}
}
`;

function shell(title: string, body: string, script: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650&display=swap" rel="stylesheet">
<style>${STYLE}</style></head>
<body>${body}<script>${script}</script></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function loginPage(): string {
  const body = `<div class="login-wrap"><div class="card">
  <div class="brand"><span class="dot"></span> BD CRM Analytics</div>
  <h2>Sign in</h2>
  <p class="sub">Paste your <strong>own</strong> CRM personal access token. We use it once to confirm you're an
  analytics-authorized workspace admin, then discard it — it is never stored.</p>
  <form id="f" autocomplete="off">
    <label for="tok">CRM personal token</label>
    <input id="tok" type="password" placeholder="plane_api_…" autocomplete="off" spellcheck="false">
    <p class="hint">Profile → Settings → Personal access tokens in the CRM. Read-only; it only proves your admin access here.</p>
    <button class="btn" type="submit">Verify &amp; continue</button>
    <div class="msg-err" id="err"></div>
  </form>
  </div></div>`;
  const script = `
  var f=document.getElementById('f'),tok=document.getElementById('tok'),err=document.getElementById('err'),btn=f.querySelector('button');
  f.addEventListener('submit',async function(e){e.preventDefault();err.textContent='';btn.disabled=true;btn.textContent='Verifying…';
    try{
      var r=await fetch('/mcp/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tok.value})});
      var d=await r.json().catch(function(){return {};});
      if(r.ok){location.href='/mcp';return;}
      err.textContent=d.error||('Sign-in failed ('+r.status+').');
    }catch(e){err.textContent='Could not reach the server.';}
    btn.disabled=false;btn.textContent='Verify & continue';tok.value='';
  });`;
  return shell("Sign in · BD CRM Analytics", body, script);
}

export function chatPage(who: string): string {
  const initial = (who.trim()[0] || "U").toUpperCase();
  const body = `
  <div class="scrim" id="scrim"></div>
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="side-head">
        <div class="head-row">
          <div class="brand"><span class="dot"></span> BD CRM Analytics</div>
          <button class="icon-btn" id="collapseBtn" title="Hide sidebar" aria-label="Hide sidebar">&#10094;</button>
        </div>
        <button class="new-chat" id="newChat"><span class="plus">+</span> New chat</button>
      </div>
      <div class="list-label">Chats</div>
      <div class="chat-list" id="chatList"></div>
      <div class="side-foot">
        <span class="avatar">${escapeHtml(initial)}</span>
        <span class="uname">${escapeHtml(who)}</span>
        <button class="out" id="logout">Sign out</button>
      </div>
    </aside>
    <main class="main">
      <button class="icon-btn expand-btn" id="expandBtn" title="Show sidebar" aria-label="Show sidebar">&#9776;</button>
      <div class="mobile-bar">
        <button id="menuBtn">&#9776;</button>
        <span class="mtitle">BD CRM Analytics</span>
      </div>
      <div class="scroll" id="scroll"><div class="thread" id="thread"></div></div>
      <div class="composer-wrap">
        <div class="composer">
          <textarea id="in" placeholder="Ask about win rate, funnel, connects, velocity, forecast, or leads…" rows="1"></textarea>
          <button class="send-btn" id="send" title="Send" aria-label="Send">&#8593;</button>
        </div>
        <div class="composer-hint">Enter to send · Shift+Enter for a new line</div>
      </div>
    </main>
  </div>`;

  // Client script — plain concatenation only (no template literals) so it embeds safely.
  const script = `
  var WHO=${JSON.stringify(who)};
  var BT=String.fromCharCode(96), FENCE=BT+BT+BT;
  var thread=document.getElementById('thread'),scroll=document.getElementById('scroll');
  var input=document.getElementById('in'),send=document.getElementById('send');
  var chatListEl=document.getElementById('chatList');
  var busy=false, activeId=null;

  /* ---- persistence ---- */
  var KEY='bdmcp_chats_v1';
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||[];}catch(e){return [];}}
  function save(){localStorage.setItem(KEY,JSON.stringify(chats));}
  var chats=load();
  function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
  function findChat(id){for(var i=0;i<chats.length;i++){if(chats[i].id===id)return chats[i];}return null;}

  /* ---- escaping + markdown ---- */
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function inline(s){
    s=s.replace(new RegExp(BT+'([^'+BT+']+)'+BT,'g'),'<code>$1</code>');
    s=s.replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*])\\*([^*\\n]+)\\*/g,'$1<em>$2</em>');
    s=s.replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function md(src){
    var lines=String(src).replace(/\\r/g,'').split('\\n'),out='',i=0;
    function row(r){return r.replace(/^\\s*\\|/,'').replace(/\\|\\s*$/,'').split('|').map(function(c){return c.trim();});}
    while(i<lines.length){
      var line=lines[i];
      if(line.trimStart().slice(0,3)===FENCE){var code='';i++;while(i<lines.length&&lines[i].trimStart().slice(0,3)!==FENCE){code+=lines[i]+'\\n';i++;}i++;out+='<pre><code>'+esc(code)+'</code></pre>';continue;}
      if(line.indexOf('|')>-1&&i+1<lines.length&&/^\\s*\\|?\\s*:?-{2,}/.test(lines[i+1])&&lines[i+1].indexOf('|')>-1){
        var head=row(line);i+=2;var rows=[];
        while(i<lines.length&&lines[i].indexOf('|')>-1&&lines[i].trim()!==''){rows.push(row(lines[i]));i++;}
        out+='<table><thead><tr>';for(var h=0;h<head.length;h++)out+='<th>'+inline(esc(head[h]))+'</th>';out+='</tr></thead><tbody>';
        for(var r2=0;r2<rows.length;r2++){out+='<tr>';for(var c=0;c<rows[r2].length;c++)out+='<td>'+inline(esc(rows[r2][c]))+'</td>';out+='</tr>';}
        out+='</tbody></table>';continue;
      }
      var hm=/^(#{1,6})\\s+(.*)$/.exec(line);
      if(hm){var lv=Math.min(hm[1].length,3);out+='<h'+lv+'>'+inline(esc(hm[2]))+'</h'+lv+'>';i++;continue;}
      if(/^\\s*[-*]\\s+/.test(line)){var it=[];while(i<lines.length&&/^\\s*[-*]\\s+/.test(lines[i])){it.push(lines[i].replace(/^\\s*[-*]\\s+/,''));i++;}out+='<ul>';for(var u=0;u<it.length;u++)out+='<li>'+inline(esc(it[u]))+'</li>';out+='</ul>';continue;}
      if(/^\\s*\\d+\\.\\s+/.test(line)){var io=[];while(i<lines.length&&/^\\s*\\d+\\.\\s+/.test(lines[i])){io.push(lines[i].replace(/^\\s*\\d+\\.\\s+/,''));i++;}out+='<ol>';for(var o=0;o<io.length;o++)out+='<li>'+inline(esc(io[o]))+'</li>';out+='</ol>';continue;}
      if(/^\\s*$/.test(line)){i++;continue;}
      var para=[];
      while(i<lines.length&&!/^\\s*$/.test(lines[i])&&lines[i].trimStart().slice(0,3)!==FENCE&&!/^#{1,6}\\s/.test(lines[i])&&!/^\\s*[-*]\\s+/.test(lines[i])&&!/^\\s*\\d+\\.\\s+/.test(lines[i])&&!(lines[i].indexOf('|')>-1&&i+1<lines.length&&/^\\s*\\|?\\s*:?-{2,}/.test(lines[i+1]))){para.push(lines[i]);i++;}
      out+='<p>';for(var p=0;p<para.length;p++){out+=(p?'<br>':'')+inline(esc(para[p]));}out+='</p>';
    }
    return out;
  }

  /* ---- rendering ---- */
  function greeting(){var h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening';}
  var SUGGESTIONS=["What's our overall win rate?","Win rate by profile","Show the conversion funnel and biggest leak","How many leads are open right now?"];
  function renderThread(){
    var chat=activeId?findChat(activeId):null;
    if(!chat||!chat.messages.length){
      var chips='';for(var s=0;s<SUGGESTIONS.length;s++)chips+='<button class="chip" data-q="'+esc(SUGGESTIONS[s])+'">'+esc(SUGGESTIONS[s])+'</button>';
      thread.innerHTML='<div class="welcome"><h1>'+greeting()+', '+esc(WHO)+'</h1><p>Ask anything about the BD Leads pipeline — win rate, the conversion funnel, connects economics, sales velocity, forecast, or individual leads.</p><div class="chips">'+chips+'</div></div>';
      var cs=thread.querySelectorAll('.chip');for(var k=0;k<cs.length;k++)cs[k].addEventListener('click',function(){submit(this.getAttribute('data-q'));});
      return;
    }
    var html='';
    for(var m=0;m<chat.messages.length;m++){
      var msg=chat.messages[m];
      if(msg.role==='user'){html+='<div class="msg user"><div class="bubble">'+esc(msg.content)+'</div></div>';}
      else{
        var tools=msg.tools&&msg.tools.length?'<div class="tools">Used: '+esc(msg.tools.join(', '))+'</div>':'';
        html+='<div class="msg assistant'+(msg.error?' err':'')+'"><div class="ava">✳</div><div class="bubble">'+md(msg.content)+tools+'</div></div>';
      }
    }
    thread.innerHTML=html;
    scroll.scrollTop=scroll.scrollHeight;
  }
  function renderSidebar(){
    var arr=chats.slice().sort(function(a,b){return (b.updated||0)-(a.updated||0);});
    if(!arr.length){chatListEl.innerHTML='<div class="empty-list">No conversations yet.</div>';return;}
    var html='';
    for(var i=0;i<arr.length;i++){
      html+='<div class="chat-item'+(arr[i].id===activeId?' active':'')+'" data-id="'+arr[i].id+'"><span class="title">'+esc(arr[i].title||'New chat')+'</span><button class="del" data-del="'+arr[i].id+'" title="Delete">✕</button></div>';
    }
    chatListEl.innerHTML=html;
    var items=chatListEl.querySelectorAll('.chat-item');
    for(var j=0;j<items.length;j++)items[j].addEventListener('click',function(e){if(e.target.getAttribute('data-del'))return;openChat(this.getAttribute('data-id'));});
    var dels=chatListEl.querySelectorAll('.del');
    for(var d=0;d<dels.length;d++)dels[d].addEventListener('click',function(e){e.stopPropagation();delChat(this.getAttribute('data-del'));});
  }

  /* ---- actions ---- */
  function openChat(id){activeId=id;renderSidebar();renderThread();closeSidebar();input.focus();}
  function newChat(){activeId=null;renderSidebar();renderThread();closeSidebar();input.focus();}
  function delChat(id){chats=chats.filter(function(c){return c.id!==id;});if(activeId===id)activeId=null;save();renderSidebar();renderThread();}

  function submit(text){
    text=(text||'').trim();if(!text||busy)return;
    var chat=activeId?findChat(activeId):null;
    if(!chat){chat={id:uid(),title:text.slice(0,60),messages:[],updated:Date.now()};chats.push(chat);activeId=chat.id;}
    if(!chat.messages.length)chat.title=text.slice(0,60);
    chat.messages.push({role:'user',content:text});chat.updated=Date.now();save();renderSidebar();
    renderThread();
    // pending bubble
    var pend=document.createElement('div');pend.className='msg assistant';pend.innerHTML='<div class="ava">✳</div><div class="bubble"><span class="dots"><span></span><span></span><span></span></span></div>';
    thread.appendChild(pend);scroll.scrollTop=scroll.scrollHeight;
    busy=true;setSend();
    var hist=chat.messages.slice(0,-1).map(function(m){return {role:m.role,content:m.content};});
    fetch('/mcp/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:hist})})
      .then(function(r){if(r.status===401){location.href='/mcp';throw new Error('unauth');}return r.json().then(function(d){return {ok:r.ok,status:r.status,d:d};});})
      .then(function(res){
        if(res.ok){chat.messages.push({role:'assistant',content:res.d.reply||'(no answer)',tools:res.d.toolsUsed||[]});}
        else{chat.messages.push({role:'assistant',content:'⚠ '+(res.d.error||('Request failed ('+res.status+')')),error:true});}
        chat.updated=Date.now();save();busy=false;setSend();renderThread();
      })
      .catch(function(e){if(e.message==='unauth')return;chat.messages.push({role:'assistant',content:'⚠ Could not reach the server.',error:true});save();busy=false;setSend();renderThread();});
  }
  function setSend(){send.disabled=busy||!input.value.trim();}

  /* ---- wiring ---- */
  input.addEventListener('input',function(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,200)+'px';setSend();});
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();var v=input.value;input.value='';input.style.height='auto';submit(v);}});
  send.addEventListener('click',function(){var v=input.value;input.value='';input.style.height='auto';setSend();submit(v);});
  document.getElementById('newChat').addEventListener('click',newChat);
  document.getElementById('logout').addEventListener('click',async function(){await fetch('/mcp/logout',{method:'POST'});localStorage.removeItem(KEY);location.href='/mcp';});

  /* mobile drawer + desktop collapse */
  var appEl=document.querySelector('.app');
  var sidebar=document.getElementById('sidebar'),scrim=document.getElementById('scrim'),menuBtn=document.getElementById('menuBtn');
  var collapseBtn=document.getElementById('collapseBtn'),expandBtn=document.getElementById('expandBtn');
  function closeSidebar(){sidebar.classList.remove('open');scrim.classList.remove('show');}
  menuBtn&&menuBtn.addEventListener('click',function(){sidebar.classList.add('open');scrim.classList.add('show');});
  scrim.addEventListener('click',closeSidebar);
  function setCollapsed(v){appEl.classList.toggle('collapsed',v);try{localStorage.setItem('bdmcp_sidebar',v?'collapsed':'open');}catch(e){}}
  collapseBtn&&collapseBtn.addEventListener('click',function(){if(window.innerWidth<=760){closeSidebar();return;}setCollapsed(!appEl.classList.contains('collapsed'));});
  expandBtn&&expandBtn.addEventListener('click',function(){setCollapsed(false);});
  try{if(localStorage.getItem('bdmcp_sidebar')==='collapsed'&&window.innerWidth>760)appEl.classList.add('collapsed');}catch(e){}

  renderSidebar();renderThread();setSend();input.focus();
  `;
  return shell("BD CRM Analytics", body, script);
}
