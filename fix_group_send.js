// fix_group_send.js — replace broken group_send block with correct one
const fs = require("fs");
const file = "/opt/sbgames-auth/server_index.js";
let code = fs.readFileSync(file, "utf8");

// Find and remove the broken block
const brokenStart = '        case group_send: {';
const brokenEnd = '        case "message": {';
const i1 = code.indexOf(brokenStart);
const i2 = code.indexOf(brokenEnd, i1);
if (i1 === -1 || i2 === -1) { console.error("Could not find broken block"); process.exit(1); }

const fixedBlock = `        case "group_send": {
          const gid = sanitize(msg.groupId || "", 32);
          const g = groups.get(gid);
          if (!g || !g.members.has(client.userId)) break;
          const text = sanitize(msg.text || "", 2000);
          if (!text) break;
          const gm = { id: uuidv4(), from: client.userId, fromUsername: client.username, text: text.trim(), time: Date.now() };
          const msgs = groupMessages.get(gid) || [];
          msgs.push(gm);
          groupMessages.set(gid, msgs.slice(-500));
          for (const m of g.members) sendToUser(m, { type: "group_message", groupId: gid, message: gm });
          break;
        }
        case "message": {`;

code = code.slice(0, i1) + fixedBlock + code.slice(i2);
fs.writeFileSync(file, code);
console.log("Fixed group_send handler");
