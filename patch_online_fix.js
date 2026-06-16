const fs = require("fs");
const path = "/opt/sbgames-auth/server_index.js";
let code = fs.readFileSync(path, "utf8");

// 1. Add online status to search results
const searchOld = `res.json({
    users: results.map(a => ({
      id:       a.id,
      username: a.username,
      telegram: a.telegram,
      role:     a.role || "user",
    }))
  });`;

const searchNew = `res.json({
    users: results.map(a => ({
      id:       a.id,
      username: a.username,
      telegram: a.telegram,
      role:     a.role || "user",
      online:   [...wsClients.values()].some(c => c.userId === a.id),
    }))
  });`;

if (code.includes(searchOld)) {
  code = code.replace(searchOld, searchNew);
  console.log("[1] Search endpoint now returns online status");
} else {
  console.error("[1] Could not find search endpoint");
}

// 2. Add periodic online broadcast every 15 seconds
const pingMarker = "const WS_PING_INTERVAL = 25_000; //";
if (code.includes(pingMarker) && !code.includes("setInterval(broadcastOnlineUsers")) {
  code = code.replace(pingMarker, pingMarker + "\nsetInterval(broadcastOnlineUsers, 15_000);");
  console.log("[2] Added periodic online broadcast every 15s");
} else {
  console.error("[2] Could not find ping interval or already patched");
}

fs.writeFileSync(path, code, "utf8");
console.log("[done] File written (" + code.length + " bytes)");
