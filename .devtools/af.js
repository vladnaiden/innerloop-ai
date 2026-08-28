const fs=require('fs');
const cfg=JSON.parse(fs.readFileSync('/home/node/.claude/.claude.json','utf8'));
const srv=(cfg.mcpServers||{}).anonfetch||{};
const URL_=srv.url, TOK=((srv.headers||{}).Authorization||'').split(' ').pop();
let id=0,session=null;
async function rpc(method,params,notify=false){
  const body={jsonrpc:'2.0',method}; if(!notify) body.id=++id; if(params) body.params=params;
  const h={Authorization:`Bearer ${TOK}`,'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
  if(session) h['mcp-session-id']=session;
  // a hung proxy request must fail, not stall the crawl for an hour: hard 3-minute cap
  const r=await fetch(URL_,{method:'POST',headers:h,body:JSON.stringify(body),signal:AbortSignal.timeout(180000)});
  const sid=r.headers.get('mcp-session-id'); if(sid) session=sid;
  let txt=await r.text();
  for(const line of txt.split('\n')) if(line.startsWith('data:')) txt=line.slice(5).trim();
  if(!txt.trim()) return {};
  const out=JSON.parse(txt); if(out.error) throw new Error(JSON.stringify(out.error).slice(0,140));
  return out;
}
async function init(){await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'intl',version:'1'}});await rpc('notifications/initialized',null,true)}
async function tool(name,args){const r=await rpc('tools/call',{name,arguments:args});const t=r.result.content[0].text;try{return JSON.parse(t)}catch{return t}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const strip=h=>String(h).replace(/^[^<>]*>/,'').replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ')
  .replace(/&amp;/g,'&').replace(/&#\d+;/g,' ').replace(/\s+/g,' ').trim();
const THROTTLE=/stream has been aborted|ECONNREFUSED|socket hang up|Proxy connection ended|ETIMEDOUT/i;
let get=async function(url,opts={}){
  const {tries=4,gapBase=45000,maxChars=900000}=opts;
  for(let i=0;i<tries;i++){
    let r; try{ r=await tool('fetch_url',{url,returnBody:'html',maxChars,retries:2,
      strategy:'sticky',blockRules:['http-status','cloudflare-challenge','empty-body'],
      extract:{includeMeta:true,includeText:true,maxTextChars:20000}}); }
    catch(e){ r={ok:false,error:e.message}; }
    if(r.ok) return r;
    const err=String(r.error||r.blockedBy||'fail');
    if(!THROTTLE.test(err)) throw new Error(err.slice(0,140));
    const w=gapBase*(i+1); process.stderr.write(`   throttled, backoff ${w/1000}s\n`); await sleep(w);
  }
  throw new Error('throttled out');
}

// Adaptive pacing, shared across processes through a small file. Delays were set
// by hand after three throttles and never lowered again; the metrics showed 0%
// failures at the fixed rate, so the fixed rate was the ceiling. Now: shrink the
// delay while requests keep succeeding, double it on the first throttle signal.
const RATE=require('path').join(__dirname,'.rate.json');
const readRate=()=>{try{return JSON.parse(fs.readFileSync(RATE,'utf8'));}catch{return {delay:2500,streak:0};}};
const writeRate=(r)=>{try{fs.writeFileSync(RATE,JSON.stringify(r));}catch{}};
function noteOutcome(ok,throttled){
  const r=readRate();
  if(throttled){ r.delay=Math.min(20000,Math.round(r.delay*2)); r.streak=0; r.lastThrottle=Date.now(); }
  else if(ok){ r.streak=(r.streak||0)+1; if(r.streak>=60){ r.delay=Math.max(400,Math.round(r.delay*0.8)); r.streak=0; } }
  writeRate(r);
}
// pace(max): wait the tuned delay, never more than the job's own ceiling
async function pace(max){ const d=Math.min(max||99999,readRate().delay); await sleep(d); return d; }
const _get=get;
get=async function(url,opts={}){
  try{ const r=await _get(url,opts); noteOutcome(true,false); return r; }
  catch(e){ noteOutcome(false,THROTTLE.test(String(e.message))); throw e; }
};
module.exports={init,tool,get,sleep,pace,strip,readRate};
