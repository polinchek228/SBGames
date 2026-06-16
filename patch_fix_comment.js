const fs = require("fs");
const path = "/opt/sbgames-auth/server_index.js";
let code = fs.readFileSync(path, "utf8");

const broken = 'const WS_PING_INTERVAL = 25_000; //\nsetInterval(broadcastOnlineUsers, 15_000); 25s (nginx default timeout is 60s)';
const fixed = 'const WS_PING_INTERVAL = 25_000; // 25s (nginx default timeout is 60s)\nsetInterval(broadcastOnlineUsers, 15_000);';

if (code.includes(broken)) {
  code = code.replace(broken, fixed);
  console.log("[fixed] comment syntax restored");
} else {
  console.error("[skip] pattern not found");
}

fs.writeFileSync(path, code, "utf8");
console.log("[done]");
