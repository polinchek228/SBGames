const fs = require('fs');
const file = '/opt/sbgames-auth/server_index.js';
let code = fs.readFileSync(file, 'utf8');

if (code.includes('redisAccounts.loadAll')) {
  console.log('Already patched, skipping');
  process.exit(0);
}

// 1. Add loadAll() to redisAccounts - insert after search method
const searchEnd = code.indexOf('return results.slice(0, limit);');
const closeBrace = code.indexOf('},', searchEnd) + 2;

const loadAll = `
  async loadAll() {
    try {
      const stream = redis.scanStream({ match: "acc:*", count: 200 });
      for await (const keys of stream) {
        for (const k of keys) {
          const id = k.slice(4);
          const v = await redis.get(k);
          if (v) this._map.set(id, JSON.parse(v));
        }
      }
      console.log("[redis-accounts] loaded " + this._map.size + " accounts from Redis");
    } catch (e) { console.error("[redis-accounts] loadAll error:", e.message); }
  },`;

code = code.slice(0, closeBrace) + loadAll + code.slice(closeBrace);
console.log('Added loadAll method to redisAccounts');

// 2. Add call to loadAllStores before Promise.all
const loadAllFn = code.indexOf('async function loadAllStores()');
const promiseAll = code.indexOf('await Promise.all([', loadAllFn);
code = code.slice(0, promiseAll) + '  await redisAccounts.loadAll();\n  ' + code.slice(promiseAll);
console.log('Added loadAll call to loadAllStores');

fs.writeFileSync(file, code, 'utf8');
console.log('Done!');
