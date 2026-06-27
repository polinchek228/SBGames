/* web-search.cjs — бесплатный веб-поиск без API-ключей (DuckDuckGo + Wikipedia).
 * Экспортирует async search(query, max) -> [{title, snippet, url}] и contextFor(query) -> string. */
const https = require("https");

function get(url, opts){ return new Promise(function(resolve, reject){
  const u = new URL(url);
  const req = https.request({ hostname:u.hostname, path:u.pathname+u.search, method:(opts&&opts.method)||"GET",
    headers: Object.assign({ "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept":"text/html,application/json" }, (opts&&opts.headers)||{}) },
    function(res){ if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){ resolve(get(res.headers.location.startsWith("http")?res.headers.location:("https://"+u.hostname+res.headers.location), opts)); return; } let d=""; res.on("data",c=>d+=c); res.on("end",()=>resolve({status:res.statusCode, body:d})); });
  req.on("error", reject); req.setTimeout(15000, ()=>{ req.destroy(); reject(new Error("timeout")); });
  if(opts&&opts.body) req.write(opts.body); req.end(); }); }

function strip(h){ return h.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,String.fromCharCode(34)).replace(/&#x27;/g,"\x27").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim(); }

async function ddg(query, max){
  const out=[];
  try {
    const r = await get("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query)+"&kl=ru-ru");
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
    let m; while((m=re.exec(r.body))&&out.length<max){ const title=strip(m[2]||""); const snip=strip(m[3]||""); if(title) out.push({ title:title, snippet:snip, url:strip(m[1]||"") }); }
  } catch(e){}
  return out;
}

async function ddgLite(query, max){
  const out=[];
  try {
    const r = await get("https://lite.duckduckgo.com/lite/?q="+encodeURIComponent(query));
    const re = /<a[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
    let m; while((m=re.exec(r.body))&&out.length<max){ const t=strip(m[1]); const s=strip(m[2]); if(t) out.push({title:t,snippet:s,url:""}); }
  } catch(e){}
  return out;
}

async function wiki(query){
  try {
    const r = await get("https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch="+encodeURIComponent(query)+"&format=json&srlimit=2");
    const j = JSON.parse(r.body); return (j.query&&j.query.search||[]).map(x=>({ title:x.title, snippet:strip(x.snippet||""), url:"https://ru.wikipedia.org/wiki/"+encodeURIComponent(x.title) }));
  } catch(e){ return []; }
}

async function search(query, max){ max=max||5;
  let r = await ddg(query, max);
  if(r.length<2){ const l = await ddgLite(query, max); r = r.concat(l); }
  const w = await wiki(query); r = r.concat(w);
  // дедуп по заголовку
  const seen=new Set(); return r.filter(x=>{ const k=x.title.toLowerCase().slice(0,40); if(seen.has(k))return false; seen.add(k); return true; }).slice(0, max);
}

async function contextFor(query){
  const res = await search(query, 6);
  if(!res.length) return "";
  const lines = res.map((x,i)=>(i+1)+". "+x.title+(x.snippet?(" — "+x.snippet.slice(0,260)):"")).join("\n");
  return "АКТУАЛЬНЫЕ ДАННЫЕ ИЗ ИНТЕРНЕТА (используй их для фактов, версий, дат):\n"+lines+"\n";
}

module.exports = { search, contextFor };

if (require.main === module) {
  (async()=>{ const q = process.argv.slice(2).join(" ") || "последняя версия Minecraft 2026"; const c = await contextFor(q); console.log(c || "(ничего не нашлось)"); })();
}
