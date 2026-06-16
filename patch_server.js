const fs = require("fs");
const path = "/opt/sbgames-auth/server_index.js";
let code = fs.readFileSync(path, "utf8");

// 1. Add DELETE comment endpoint after POST comment endpoint
const commentPostEnd = 'res.json({ ok: true, comment: c });\n});';
const deleteComment = `res.json({ ok: true, comment: c });
});

app.delete("/api/user/:id/comments/:cid", requireAuth, (req, res) => {
  const id = sanitize(req.params.id, 64);
  const cid = sanitize(req.params.cid, 64);
  const list = profileComments.get(id) || [];
  const idx = list.findIndex(c => c.id === cid);
  if (idx === -1) return res.status(404).json({ message: "Комментарий не найден" });
  const c = list[idx];
  if (c.fromId !== req.userId && id !== req.userId) return res.status(403).json({ message: "Нет доступа" });
  list.splice(idx, 1);
  profileComments.set(id, list);
  res.json({ ok: true });
});`;

if (code.includes(commentPostEnd)) {
  code = code.replace(commentPostEnd, deleteComment);
  console.log("[1] DELETE comment endpoint added");
} else {
  console.error("[1] Could not find comment POST end");
}

// 2. Add kick member endpoint after leave endpoint
const leaveEnd = '  res.json({ ok: true });\n});\n\napp.get("/api/groups/:id/messages"';
const kickEndpoint = `  res.json({ ok: true });
});

app.post("/api/groups/:id/kick", requireAuth, (req, res) => {
  const gid = sanitize(req.params.id, 32);
  const g = groups.get(gid);
  if (!g) return res.status(404).json({ message: "Группа не найдена" });
  if (g.ownerId !== req.userId) return res.status(403).json({ message: "Только владелец может исключать" });
  const targetId = sanitize(req.body.userId || "", 32);
  if (targetId === req.userId) return res.status(400).json({ message: "Нельзя исключить себя" });
  if (!g.members.has(targetId)) return res.status(400).json({ message: "Игрок не в группе" });
  g.members.delete(targetId);
  for (const m of g.members) sendToUser(m, { type: "group_update", group: publicGroup(g) });
  sendToUser(targetId, { type: "group_kicked", groupId: gid, groupName: g.name });
  res.json({ ok: true });
});

app.get("/api/groups/:id/messages"`;

if (code.includes(leaveEnd)) {
  code = code.replace(leaveEnd, kickEndpoint);
  console.log("[2] Kick member endpoint added");
} else {
  console.error("[2] Could not find leave endpoint end");
}

fs.writeFileSync(path, code, "utf8");
console.log("[done] File written (" + code.length + " bytes)");
