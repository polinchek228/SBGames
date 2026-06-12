import React, { useState, useEffect, useRef } from "react";
import { API_URL, WS_URL, getToken } from "../lib/api.js";
import { Send } from "lucide-react";

const card = { background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" };

const STATUSES = {
  open:        { label: "Открыт",    color: "#facc15" },
  in_progress: { label: "В работе",  color: "#60a5fa" },
  answered:    { label: "Ответили",  color: "#4ade80" },
  closed:      { label: "Закрыт",    color: "rgba(255,255,255,0.25)" },
};

export default function AdminPage({ user }) {
  const [tab,      setTab]      = useState("Тикеты");
  const [tickets,  setTickets]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [search,   setSearch]   = useState("");
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [editBal,  setEditBal]  = useState({});
  const wsRef    = useRef(null);
  const bottomRef = useRef(null);

  const token   = getToken();
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  useEffect(() => {
    if (!user?.id) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", userId: user.id, username: user.username, token }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "new_ticket")
          setTickets(prev => [msg.ticket, ...prev.filter(t => t.id !== msg.ticket.id)]);
        if (msg.type === "ticket_update")
          setTickets(prev => prev.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
        if (msg.type === "ticket_messages") setMessages(msg.messages || []);
        if (msg.type === "message" && active?.id === msg.ticketId)
          setMessages(prev => prev.find(m => m.id === msg.message.id) ? prev : [...prev, msg.message]);
      } catch {}
    };
    return () => ws.close();
  }, [user?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetch(`${API_URL}/admin/tickets`, { headers })
      .then(r => r.json()).then(d => setTickets(d.tickets || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "Пользователи") return;
    fetch(`${API_URL}/admin/users`, { headers })
      .then(r => r.json()).then(d => setUsers(d.users || [])).catch(() => {});
  }, [tab]);

  const openTicket = (t) => {
    setActive(t);
    setMessages([]);
    wsRef.current?.send(JSON.stringify({ type: "read_ticket", ticketId: t.id }));
    setActive(t);
  };

  const sendMsg = () => {
    const text = input.trim();
    if (!text || !active) return;
    const msg = { id: Date.now().toString(), from: user.id, username: user.username, role: "admin", text, time: Date.now() };
    setMessages(prev => [...prev, msg]);
    wsRef.current?.send(JSON.stringify({ type: "message", ticketId: active.id, text }));
    setInput("");
  };

  const changeStatus = async (status) => {
    if (!active) return;
    await fetch(`${API_URL}/admin/ticket/${active.id}/status`, { method: "POST", headers, body: JSON.stringify({ status }) });
    setActive(t => t ? { ...t, status } : t);
    setTickets(prev => prev.map(t => t.id === active.id ? { ...t, status } : t));
  };

  const setRole = async (userId, role) => {
    await fetch(`${API_URL}/admin/set-role`, { method: "POST", headers, body: JSON.stringify({ userId, role }) });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const setBalance = async (userId) => {
    const val = parseInt(editBal[userId], 10);
    if (isNaN(val)) return;
    await fetch(`${API_URL}/admin/set-balance`, { method: "POST", headers, body: JSON.stringify({ userId, balance: val }) });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: val } : u));
    setEditBal(prev => ({ ...prev, [userId]: "" }));
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.username || "").toLowerCase().includes(q)
        || (u.telegram || "").toLowerCase().includes(q)
        || String(u.id).includes(q);
  });

  const isClosed = active?.status === "closed";

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>

        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>Панель администратора</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Тикеты и пользователи</p>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {["Тикеты", "Пользователи"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: tab === t ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)",
              border: tab === t ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.06)",
              color: tab === t ? "#93c5fd" : "rgba(255,255,255,0.5)",
            }}>{t}</button>
          ))}
        </div>

        {/* ── ТИКЕТЫ ── */}
        {tab === "Тикеты" && (
          <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 14 }}>

            {/* Список */}
            <div style={{ ...card, padding: 10, maxHeight: 640, overflowY: "auto" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8, padding: "0 4px" }}>
                Тикеты ({tickets.length})
              </div>
              {tickets.length === 0 && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "20px 0" }}>Нет тикетов</div>
              )}
              {tickets.map(t => {
                const st = STATUSES[t.status] || STATUSES.open;
                return (
                  <button key={t.id} onClick={() => openTicket(t)} style={{
                    width: "100%", textAlign: "left", cursor: "pointer", borderRadius: 9,
                    padding: "9px 11px", marginBottom: 3,
                    background: active?.id === t.id ? "rgba(255,255,255,0.07)" : "transparent",
                    border: active?.id === t.id ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                    color: "#fff", opacity: t.status === "closed" ? 0.5 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>#{t.id} · {t.username}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {t.unread > 0 && <span style={{ background: "#2563eb", borderRadius: 8, fontSize: 9, fontWeight: 700, padding: "1px 5px", color: "#fff" }}>{t.unread}</span>}
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 1 }}>{t.category}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>{t.preview?.slice(0, 48)}</div>
                  </button>
                );
              })}
            </div>

            {/* Чат */}
            <div style={{ ...card, display: "flex", flexDirection: "column", height: 640, overflow: "hidden" }}>
              {!active ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Выбери тикет</span>
                </div>
              ) : (
                <>
                  {/* Шапка с кнопками статусов */}
                  <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>#{active.id} — {active.username}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginLeft: 10 }}>{active.category}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        color: STATUSES[active.status]?.color || "#fff" }}>
                        {STATUSES[active.status]?.label || active.status}
                      </span>
                    </div>
                    {/* Кнопки статусов */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.entries(STATUSES).map(([key, val]) => (
                        <button key={key} onClick={() => changeStatus(key)}
                          disabled={active.status === key}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 7, cursor: "pointer",
                            background: active.status === key ? "rgba(255,255,255,0.08)" : "transparent",
                            border: `1px solid ${active.status === key ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)"}`,
                            color: active.status === key ? val.color : "rgba(255,255,255,0.35)",
                            opacity: active.status === key ? 1 : 0.7,
                          }}>
                          {val.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Сообщения */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
                    {messages.map(msg => {
                      const isAdm = msg.role === "admin";
                      if (msg.from === "system") return (
                        <p key={msg.id} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>{msg.text}</p>
                      );
                      return (
                        <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: "72%", alignSelf: isAdm ? "flex-end" : "flex-start", alignItems: isAdm ? "flex-end" : "flex-start" }}>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{msg.username}</span>
                          <div style={{
                            padding: "9px 13px", fontSize: 13, lineHeight: 1.5,
                            ...(isAdm
                              ? { background: "#1d4ed8", color: "#fff", borderRadius: "13px 13px 4px 13px" }
                              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", borderRadius: "13px 13px 13px 4px", border: "1px solid rgba(255,255,255,0.07)" }),
                          }}>{msg.text}</div>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                            {new Date(msg.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>

                  {/* Ввод — заблокирован если closed */}
                  {isClosed ? (
                    <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                      Тикет закрыт — переписка недоступна
                    </div>
                  ) : (
                    <form onSubmit={e => { e.preventDefault(); sendMsg(); }}
                      style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                      <input value={input} onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())}
                        placeholder="Ответ пользователю..."
                        style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 13px", color: "#fff", fontSize: 13, outline: "none" }}
                      />
                      <button type="submit" disabled={!input.trim()} style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: "#2563eb", border: "none", cursor: input.trim() ? "pointer" : "not-allowed",
                        opacity: input.trim() ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Send size={14} color="#fff" />
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ПОЛЬЗОВАТЕЛИ ── */}
        {tab === "Пользователи" && (
          <div style={{ ...card, overflow: "hidden" }}>
            {/* Поиск */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по нику, Telegram или ID..."
                style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "8px 13px", color: "#fff", fontSize: 13, outline: "none" }}
              />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>{filteredUsers.length} из {users.length}</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["ID", "Ник", "Telegram", "Баланс", "Роль", "Действия"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "9px 14px", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{u.id}</td>
                      <td style={{ padding: "9px 14px", fontWeight: 600 }}>{u.username}</td>
                      <td style={{ padding: "9px 14px", color: "rgba(255,255,255,0.4)" }}>{u.telegram ? `@${u.telegram}` : "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700 }}>{(u.balance ?? 0).toLocaleString("ru-RU")}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>SBT</span>
                          <input type="number" placeholder="новый" value={editBal[u.id] || ""}
                            onChange={e => setEditBal(p => ({ ...p, [u.id]: e.target.value }))}
                            style={{ width: 60, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 7px", color: "#fff", fontSize: 11, outline: "none" }}
                          />
                          {editBal[u.id] && (
                            <button onClick={() => setBalance(u.id)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "rgba(37,99,235,0.3)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd", cursor: "pointer" }}>
                              Задать
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 7,
                          background: u.role === "admin" ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)",
                          border: u.role === "admin" ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                          color: u.role === "admin" ? "#93c5fd" : "rgba(255,255,255,0.4)" }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        {u.role !== "admin" ? (
                          <button onClick={() => setRole(u.id, "admin")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd", cursor: "pointer" }}>
                            Сделать админом
                          </button>
                        ) : u.id !== user?.id ? (
                          <button onClick={() => setRole(u.id, "user")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
                            Снять права
                          </button>
                        ) : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                  {search ? "Ничего не найдено" : "Нет пользователей"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
