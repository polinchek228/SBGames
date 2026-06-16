const fs = require("fs");
const path = "/opt/sbgames-auth/server_index.js";
const lines = fs.readFileSync(path, "utf8").split("\n");

// Line 1938 (1-indexed) = index 1937 = Start comment
// Line 1939 = server.listen
const startIdx = 1937; // line 1938 = "// --- Start ---..." comment
const listenIdx = 1938; // line 1939 = server.listen(...)

// Verify
console.log("Line 1938:", JSON.stringify(lines[startIdx].substring(0, 50)));
console.log("Line 1939:", JSON.stringify(lines[listenIdx].substring(0, 50)));

const loadAllFn = [
  "",
  "async function loadAllStores() {",
  "  await Promise.all([",
  "    friendships.loadAll(),",
  "    friendRequests.loadAll(),",
  "    dms.loadAll(),",
  "    profileComments.loadAll(),",
  "    activityStore.loadAll(),",
  "    groups.loadAll(),",
  "    groupMessages.loadAll(),",
  "    groupInvites.loadAll(),",
  "  ]);",
  "  let maxId = 0;",
  "  for (const [id] of groups.entries()) { const n = parseInt(id); if (n > maxId) maxId = n; }",
  "  groupCounter = maxId;",
  '  console.log("[startup] all stores loaded from Redis");',
  "}",
  "",
].join("\n");

// Replace the listen line with async wrapper
const listenLine = lines[listenIdx];
const asyncStart = "(async () => {\n  await loadAllStores().catch(e => console.error(\"[startup] loadAllStores error:\", e));\n" + listenLine;

// Build: before start comment, loadAll fn, async wrapper start, rest from listen onwards, close IIFE
const before = lines.slice(0, startIdx); // everything before Start comment
const rest = lines.slice(listenIdx + 1); // everything after server.listen

const newFile = before.join("\n") + "\n" + loadAllFn + asyncStart + "\n" + rest.join("\n") + "\n})();";

fs.writeFileSync(path, newFile, "utf8");
console.log("[done] Written", newFile.split("\n").length, "lines");
