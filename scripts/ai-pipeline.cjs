/* ai-pipeline.cjs — автопилот: генерация -> сборка форума -> деплой -> пинг IndexNow.
 * Запуск по расписанию (Task Scheduler) каждые 20 минут. Лок защищает от накладок. */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const https = require("https");
const ROOT = path.resolve(__dirname, "..");

// .env loader
(function(){ try { const p = path.join(ROOT, ".env"); if(!fs.existsSync(p)) return;
  for (const ln of fs.readFileSync(p,"utf8").split(/\r?\n/)){ const m = ln.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(!m) continue;
    let v = m[2].trim().replace(/^["\x27]|["\x27]$/g,""); if(process.env[m[1]]===undefined) process.env[m[1]]=v; } } catch(e){} })();

const LOCK = path.join(__dirname, ".pipeline.lock");
const LOG = path.join(ROOT, "pipeline.log");
function log(s){ const line = "[" + new Date().toISOString() + "] " + s; console.log(line); try{ fs.appendFileSync(LOG, line + "\n"); }catch(e){} }

// lock: если свежий (< 25 мин) — выходим
try { if (fs.existsSync(LOCK)) { const age = Date.now() - fs.statSync(LOCK).mtimeMs; if (age < 25*60*1000) { log("LOCK активен (" + Math.round(age/1000) + "s), выходим"); process.exit(0); } } } catch(e){}
fs.writeFileSync(LOCK, String(process.pid));

function sh(cmd, args, opts){ const r = cp.spawnSync(cmd, args, Object.assign({ cwd: ROOT, encoding: "utf8", env: process.env }, opts||{})); return r; }

function indexNow(urls){ return new Promise(function(resolve){
  const key = process.env.INDEXNOW_KEY; const site = process.env.SITE_URL;
  if(!key || !site || !urls.length){ resolve("indexnow: skip"); return; }
  const host = site.replace(/^https?:\/\//,"").replace(/\/$/,"");
  const body = JSON.stringify({ host: host, key: key, keyLocation: site + "/" + key + ".txt", urlList: urls });
  const req = https.request({ hostname:"api.indexnow.org", path:"/indexnow", method:"POST", headers:{ "Content-Type":"application/json", "Content-Length": Buffer.byteLength(body) } }, function(res){ let d=""; res.on("data",c=>d+=c); res.on("end",()=>resolve("indexnow HTTP " + res.statusCode)); });
  req.on("error", e=>resolve("indexnow err " + e.message)); req.write(body); req.end();
}); }

(async function(){
  try {
    log("=== старт прогона ===");
    // 1) генерация
    const g = sh("node", ["scripts/ai-generate.cjs"], { timeout: 18*60*1000 });
    log("генерация exit=" + g.status); if(g.stdout) log(g.stdout.trim().split(/\n/).slice(-6).join(" | "));
    if(g.stderr && g.stderr.trim()) log("gen stderr: " + g.stderr.trim().split(/\n/).slice(-3).join(" | "));
    // 2) сборка форума
    const b = sh("node", ["scripts/build-forum.cjs"], { timeout: 3*60*1000 });
    log("build-forum exit=" + b.status);
    // ключ IndexNow в dist
    const dist = path.join(ROOT, "website", "dist");
    if (process.env.INDEXNOW_KEY) { try { fs.writeFileSync(path.join(dist, process.env.INDEXNOW_KEY + ".txt"), process.env.INDEXNOW_KEY); } catch(e){} }
    // 3) деплой форума + sitemap + ключ через ssh2
    const tar = path.join(ROOT, "website", "_forum-deploy.tar.gz");
    sh("tar", ["-czf", tar, "-C", dist, "forum", "sitemap.xml"].concat(process.env.INDEXNOW_KEY ? [process.env.INDEXNOW_KEY + ".txt"] : []));
    await deploy(tar);
    // 4) IndexNow по свежим URL из sitemap
    let urls = [];
    try { const sm = fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8"); urls = (sm.match(/<loc>([^<]+)<\/loc>/g)||[]).map(s=>s.replace(/<\/?loc>/g,"")).filter(u=>u.includes("/forum/")).slice(-14); } catch(e){}
    const pres = await indexNow(urls); log(pres + " (" + urls.length + " url)");
    log("=== прогон завершён ===");
  } catch(e){ log("ОШИБКА: " + (e && e.message)); }
  finally { try{ fs.unlinkSync(LOCK); }catch(e){} }
})();

function deploy(tarPath){ return new Promise(function(resolve){
  let Client; try { Client = require(path.join(ROOT, "node_modules", "ssh2")).Client; } catch(e){ try { Client = require("ssh2").Client; } catch(e2){ log("ssh2 не найден"); resolve(); return; } }
  const conn = new Client();
  const P = process.env.SSH_PASS, DP = process.env.DEPLOY_PATH || "/var/www/sbgames";
  const cmd = "echo \"" + P + "\" | sudo -S -p \"\" tar -xzf /tmp/_forum-deploy.tar.gz -C " + DP + " && echo \"" + P + "\" | sudo -S -p \"\" chown -R " + process.env.SSH_USER + ":" + process.env.SSH_USER + " " + DP + "/forum && echo DEPLOY_OK";
  conn.on("ready", function(){ conn.sftp(function(err, sftp){ if(err){ log("sftp err"); conn.end(); resolve(); return; }
    sftp.fastPut(tarPath, "/tmp/_forum-deploy.tar.gz", function(e){ if(e){ log("upload err " + e.message); conn.end(); resolve(); return; }
      conn.exec(cmd, function(e2, stream){ if(e2){ log("exec err"); conn.end(); resolve(); return; } let o=""; stream.on("close", function(){ log("deploy: " + o.trim().split(/\n/).pop()); conn.end(); resolve(); }); stream.stdout.on("data",d=>o+=d); stream.stderr.on("data",d=>o+=d); }); }); }); });
  conn.on("error", function(e){ log("ssh err " + e.message); resolve(); });
  conn.connect({ host: process.env.SSH_HOST, username: process.env.SSH_USER, password: process.env.SSH_PASS, readyTimeout: 20000 });
}); }
