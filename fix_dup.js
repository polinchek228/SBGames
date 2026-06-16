const fs = require("fs");
const file = "/opt/sbgames-auth/server_index.js";
let code = fs.readFileSync(file, "utf8");

// Remove duplicate "case message" line
const dup = '        case "message": {        case "message": {';
const fix = '        case "message": {';
if (code.includes(dup)) {
  code = code.replace(dup, fix);
  fs.writeFileSync(file, code);
  console.log("Fixed duplicate case message");
} else {
  console.log("No duplicate found, checking...");
  // Check if there's another pattern
  const lines = code.split("\n");
  let count = 0;
  lines.forEach((l, i) => { if (l.includes('case "message":')) { count++; console.log(`  Line ${i+1}: ${l.trim()}`); } });
  console.log(`Found ${count} occurrences`);
}
