import React, { useState, useEffect, useRef, useMemo } from "react";
import { API_URL, WS_URL, getToken } from "../lib/api.js";
import {
  PaperPlaneRight, Plus, Trash, UploadSimple, Check, X,
  Headset, UsersThree, Storefront, MagnifyingGlass, CaretDown,
  CurrencyDollar, ShieldCheck, Image as ImageIcon, Handshake,
  ChatsTeardrop, Sparkle, PencilSimple, ArrowClockwise,
} from "@phosphor-icons/react";

const card = { background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" };

const STATUSES = {
  open:        { label: "Открыт",    color: "#facc15" },
  in_progress: { label: "В работе",  color: "#60a5fa" },
  answered:    { label: "Ответили",  color: "#4ade80" },
  closed:      { label: "Закрыт",    color: "rgba(255,255,255,0.25)" },
};

const FORUM_CATEGORIES = [
  { value: "articles", label: "Статьи" },
  { value: "mods",     label: "Моды" },
  { value: "textures", label: "Текстуры" },
  { value: "maps",     label: "Карты" },
  { value: "skins",    label: "Скины" },
  { value: "shaders",  label: "Шейдеры" },
  { value: "modpacks", label: "Сборки" },
];

const NAV = [
  { key: "tickets",    label: "Тикеты",       icon: Headset },
  { key: "users",      label: "Пользователи", icon: UsersThree },
  { key: "shop",       label: "Магазин",      icon: Storefront },
  { key: "forum",      label: "Форум",        icon: ChatsTeardrop },
  { key: "affiliate",  label: "Партнёрка",    icon: Handshake },
];

const ModalCtx = React.createContext(null);
const useModal = () => React.useContext(ModalCtx);

export default function AdminPage({ user }) {
  const [section, setSection] = useState("shop");
  const [modal, setModal] = useState(null);
  const [counts, setCounts] = useState({ tickets: null, users: null, shop: null, forum: null });
  const api = useAdminFetch();

  // Загружаем счётчики для сайдбара (один раз при монтировании).
  useEffect(() => {
    Promise.all([
      api.get("/admin/tickets").catch(() => ({})),
      api.get("/admin/users").catch(() => ({})),
      api.get("/admin/shop/items").catch(() => ({})),
      fetch(`${API_URL}/forum/articles`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([t, u, s, f]) => {
      setCounts({
        tickets: (t.tickets || []).length,
        users: (u.users || []).length,
        shop: (s.items || []).length,
        forum: (f || []).length,
      });
    });
  }, []);

  return (
    <ModalCtx.Provider value={{ open: (m) => setModal(m), close: () => setModal(null) }}>
      <main style={{ background: "#000", minHeight: "100vh", color: "#fff", display: "flex" }}>
        <aside style={{
          width: 230, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 12px", position: "sticky", top: 0, height: "100vh",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "0 12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>SB Games</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>Панель админа</div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {NAV.map(({ key, label, icon: Icon }) => {
              const active = section === key;
              const count = counts[key];
              return (
                <button key={key} onClick={() => setSection(key)} style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "11px 14px",
                  borderRadius: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  background: active ? "rgba(59,130,246,0.14)" : "transparent",
                  border: active ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                  color: active ? "#93c5fd" : "rgba(255,255,255,0.55)",
                  fontSize: 13, fontWeight: active ? 700 : 500, transition: "all 0.15s",
                }}>
                  <Icon size={17} weight={active ? "fill" : "regular"} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {count != null && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                      background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
                      color: active ? "#bfdbfe" : "rgba(255,255,255,0.4)",
                      minWidth: 20, textAlign: "center",
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div style={{ marginTop: "auto", padding: "14px 12px 0", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "rgba(59,130,246,0.14)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#93c5fd",
            }}>{(user?.username || "А")[0]?.toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.username || "Админ"}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>ID {user?.id}</div>
            </div>
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0, padding: "28px 32px 64px", overflowX: "hidden" }}>
          {section === "tickets"   && <TicketsSection user={user} />}
          {section === "users"     && <UsersSection user={user} />}
          {section === "shop"      && <ShopSection />}
          {section === "forum"     && <ForumAdminSection />}
          {section === "affiliate" && <AffiliateAdminSection />}
        </div>

        {modal && (
          <div onClick={() => setModal(null)} style={{
            position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "100%", maxWidth: modal.width || 460, maxHeight: "85vh", overflowY: "auto",
              background: "#141418", borderRadius: 20,
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
            }}>
              {modal.title && (
                <div style={{ padding: "22px 24px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{modal.title}</div>
                  <button onClick={() => setModal(null)} aria-label="Закрыть" style={{
                    background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.4)",
                    cursor: "pointer", padding: 6, borderRadius: 8, display: "flex",
                  }}><X size={16} /></button>
                </div>
              )}
              <div style={{ padding: modal.title ? "0 24px 24px" : "24px" }}>{modal.body}</div>
            </div>
          </div>
        )}
      </main>
    </ModalCtx.Provider>
  );
}

function useAdminFetch() {
  const token = getToken();
  return useMemo(() => ({
    get:  (path) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    post: (path, body) => fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).then(r => r.json()),
    put:  (path, body) => fetch(`${API_URL}${path}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).then(r => r.json()),
    del:  (path) => fetch(`${API_URL}${path}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    upload: (path, formData) => fetch(`${API_URL}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }).then(r => r.json()),
  }), [token]);
}

function TicketsSection({ user }) {
  const api = useAdminFetch();
  const [tickets, setTickets] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    let retries = 0;
    const MAX_RETRIES = 5;
    let timeoutId;
    let closed = false;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { retries = 0; ws.send(JSON.stringify({ type: "auth", userId: user.id, username: user.username, token: getToken() })); };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "new_ticket") setTickets(p => [msg.ticket, ...p.filter(t => t.id !== msg.ticket.id)]);
          if (msg.type === "ticket_update") setTickets(p => p.map(t => t.id === msg.ticket.id ? { ...t, ...msg.ticket } : t));
          if (msg.type === "ticket_messages") setMessages(msg.messages || []);
          if (msg.type === "message" && active?.id === msg.ticketId) setMessages(p => p.find(m => m.id === msg.message.id) ? p : [...p, msg.message]);
        } catch {}
      };
      ws.onclose = () => {
        if (!closed && retries < MAX_RETRIES) {
          retries++;
          timeoutId = setTimeout(connect, 3000);
        }
      };
    }

    connect();
    return () => { closed = true; clearTimeout(timeoutId); wsRef.current?.close(); };
  }, [user?.id]);

  useEffect(() => { api.get("/admin/tickets").then(d => setTickets(d.tickets || [])).catch(() => {}); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const openTicket = (t) => { setActive(t); setMessages([]); wsRef.current?.send(JSON.stringify({ type: "read_ticket", ticketId: t.id })); };
  const sendMsg = () => {
    const text = input.trim(); if (!text || !active) return;
    setMessages(p => [...p, { id: Date.now().toString(), from: user.id, username: user.username, role: "admin", text, time: Date.now() }]);
    wsRef.current?.send(JSON.stringify({ type: "message", ticketId: active.id, text }));
    setInput("");
  };
  const changeStatus = async (status) => {
    if (!active) return;
    await api.post(`/admin/ticket/${active.id}/status`, { status });
    setActive(t => t ? { ...t, status } : t);
    setTickets(p => p.map(t => t.id === active.id ? { ...t, status } : t));
  };
  const isClosed = active?.status === "closed";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 700 }}>Тикеты ({tickets.length})</div>
        <div style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
          {tickets.map(t => (
            <button key={t.id} onClick={() => openTicket(t)} style={{
              width: "100%", padding: "12px 16px", textAlign: "left", cursor: "pointer", background: "transparent",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              borderLeft: active?.id === t.id ? "3px solid #3b82f6" : "3px solid transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUSES[t.status]?.color || "#666", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{t.username}</span>
                {t.unread > 0 && <span style={{ fontSize: 9, background: "#ef4444", color: "#fff", borderRadius: 8, padding: "1px 5px", fontWeight: 700 }}>{t.unread}</span>}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.preview || t.category}</div>
            </button>
          ))}
          {tickets.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Нет тикетов</div>}
        </div>
      </div>

      {active ? (
        <div style={{ ...card, display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{active.username} · {active.category}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>#{active.id}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(STATUSES).map(([k, s]) => (
                <button key={k} onClick={() => changeStatus(k)} disabled={isClosed && k !== "closed"} style={{
                  fontSize: 11, padding: "5px 10px", borderRadius: 7, cursor: "pointer",
                  background: active.status === k ? `${s.color}25` : "rgba(255,255,255,0.04)",
                  border: active.status === k ? `1px solid ${s.color}55` : "1px solid rgba(255,255,255,0.06)",
                  color: active.status === k ? s.color : "rgba(255,255,255,0.4)", opacity: isClosed && k !== "closed" ? 0.4 : 1,
                }}>{s.label}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.role === "admin" ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                <div style={{
                  padding: "9px 13px", borderRadius: 12,
                  background: m.role === "admin" ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                  border: m.role === "admin" ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  fontSize: 13, lineHeight: 1.45,
                }}>{m.text}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 3, textAlign: m.role === "admin" ? "right" : "left", display: "flex", gap: 6, justifyContent: m.role === "admin" ? "flex-end" : "flex-start" }}>
                  <span>{m.username}</span>
                  {m.time && <span style={{ color: "rgba(255,255,255,0.2)" }}>· {new Date(m.time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {isClosed ? (
            <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Тикет закрыт — переписка недоступна
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); sendMsg(); }} style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ответ..." style={{
                flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none",
              }} />
              <button type="submit" disabled={!input.trim()} style={{ width: 42, borderRadius: 10, background: input.trim() ? "#3b82f6" : "rgba(59,130,246,0.3)", border: "none", cursor: input.trim() ? "pointer" : "not-allowed", opacity: input.trim() ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PaperPlaneRight size={15} color="#fff" />
              </button>
            </form>
          )}
        </div>
      ) : (
        <div style={{ ...card, padding: "60px 24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Выберите тикет слева</div>
      )}
    </div>
  );
}

function UsersSection({ user }) {
  const api = useAdminFetch();
  const modal = useModal();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/admin/users").then(d => { setUsers(d.users || []); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.username || "").toLowerCase().includes(q) || (u.telegram || "").toLowerCase().includes(q) || String(u.id).includes(q);
  });

  const openDetail = (u) => {
    const refresh = (updated) => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x));
    modal.open({ title: u.username || "Игрок", width: 460, body: <UserDetail user={u} selfId={user?.id} api={api} onUpdate={refresh} /> });
  };

  return (
    <div>
      <SectionHeader title="Пользователи" sub={`${users.length} аккаунтов`} />
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <MagnifyingGlass size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по нику, Telegram или ID..."
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 14px 9px 34px", color: "#fff", fontSize: 13, outline: "none" }}
            />
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>{filtered.length} из {users.length}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Игрок", "Баланс", "Роль", "Регистрация"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} onClick={() => openDetail(u)} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: u.role === "admin" ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: u.role === "admin" ? "#93c5fd" : "rgba(255,255,255,0.5)",
                      }}>{(u.username || "?")[0]?.toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username || "—"}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{u.telegram ? `@${u.telegram}` : "без Telegram"}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontWeight: 700 }}>{(u.balance ?? 0).toLocaleString("ru-RU")}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>SBT</span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 7,
                      background: u.role === "admin" ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)",
                      border: u.role === "admin" ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      color: u.role === "admin" ? "#93c5fd" : "rgba(255,255,255,0.4)" }}>{u.role === "admin" ? "админ" : "игрок"}</span>
                  </td>
                  <td style={{ padding: "10px 16px", color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{search ? "Ничего не найдено" : "Нет пользователей"}</div>}
        </div>
      </div>
    </div>
  );
}

function UserDetail({ user: u, selfId, api, onUpdate }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const grant = async (delta) => {
    const val = delta !== undefined ? delta : parseInt(amount, 10);
    if (isNaN(val) || val === 0) return;
    setBusy(true);
    const r = await api.post("/admin/grant-sbt", { userId: u.id, amount: val });
    if (r.ok !== false) { onUpdate({ balance: r.balance }); setAmount(""); }
    setBusy(false);
  };
  const setRole = async (role) => {
    setBusy(true);
    await api.post("/admin/set-role", { userId: u.id, role });
    onUpdate({ role });
    setBusy(false);
  };

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "rgba(255,255,255,0.25)", marginBottom: 10,
  };

  const sectionWrap = {
    background: "rgba(255,255,255,0.02)", borderRadius: 14, padding: "16px 18px", marginBottom: 10,
  };

  const inputClean = {
    flex: 1, background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 10,
    padding: "11px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit",
  };

  const btnSolid = {
    padding: "0 18px", borderRadius: 10, fontWeight: 700, fontSize: 12, fontFamily: "inherit",
    border: "none", color: "#fff", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
  };

  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: "rgba(59,130,246,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800, color: "#93c5fd",
        }}>
          {(u.username || "?")[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{u.username || "Игрок"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            {u.telegram ? `@${u.telegram}` : "без Telegram"} · ID {u.id}
          </div>
        </div>
      </div>

      <div style={sectionWrap}>
        <div style={sectionLabel}>Баланс</div>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 14, lineHeight: 1 }}>
          {(u.balance ?? 0).toLocaleString("ru-RU")}
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginLeft: 5 }}>SBT</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {quickAmounts.map(a => (
            <button key={a} onClick={() => grant(a)} disabled={busy} style={{
              padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: "rgba(34,197,94,0.08)", border: "none", color: "#86efac",
            }}>+{a.toLocaleString("ru-RU")}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Своя сумма" disabled={busy}
            onKeyDown={e => { if (e.key === "Enter") grant(); }}
            style={inputClean}
          />
          <button onClick={() => grant()} disabled={busy || !amount} style={{
            ...btnSolid,
            padding: "0 20px",
            background: busy || !amount ? "rgba(59,130,246,0.25)" : "#3b82f6",
            opacity: busy || !amount ? 0.5 : 1, cursor: busy || !amount ? "not-allowed" : "pointer",
          }}>
            <CurrencyDollar size={14} weight="bold" /> Выдать
          </button>
        </div>
      </div>

      {u.id !== selfId && (
        <div style={sectionWrap}>
          <div style={sectionLabel}>Роль</div>
          {u.role === "admin" ? (
            <button onClick={() => setRole("user")} disabled={busy} style={{
              width: "100%", padding: "11px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", border: "none",
              background: "rgba(239,68,68,0.08)", color: "#fca5a5",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><ShieldCheck size={14} /> Снять права админа</button>
          ) : (
            <button onClick={() => setRole("admin")} disabled={busy} style={{
              width: "100%", padding: "11px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", border: "none",
              background: "rgba(59,130,246,0.1)", color: "#93c5fd",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><ShieldCheck size={14} /> Сделать админом</button>
          )}
        </div>
      )}
      {u.id === selfId && (
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "6px 0" }}>
          Это вы — роль изменить нельзя
        </div>
      )}

      <div style={sectionWrap}>
        <div style={sectionLabel}>Партнёрка</div>
        <UserCommissionEditor api={api} tgId={u.id} />
      </div>
    </div>
  );
}

function ShopSection() {
  const api = useAdminFetch();
  const modal = useModal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("__all__");
  const [sort, setSort] = useState("new");
  const [selected, setSelected] = useState(new Set());

  const load = () => { setLoading(true); api.get("/admin/shop/items").then(d => { setItems(d.items || []); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => ["__all__", ...Array.from(new Set(items.map(i => i.category)))], [items]);

  const filtered = useMemo(() => {
    let r = items;
    if (catFilter !== "__all__") r = r.filter(i => i.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(i => (i.name || "").toLowerCase().includes(q) || (i.subcategory || "").toLowerCase().includes(q));
    }
    const sorted = [...r];
    if (sort === "priceAsc") sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort === "priceDesc") sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sort === "name") sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return sorted;
  }, [items, catFilter, search, sort]);

  const toggleSel = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map(i => i.id)));
  const clearSel = () => setSelected(new Set());

  const bulk = async (action) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action === "delete" && !confirm(`Удалить ${ids.length} товаров безвозвратно?`)) return;
    await Promise.all(ids.map(id => {
      if (action === "delete") return api.del(`/admin/shop/items/${id}`);
      if (action === "show") return api.put(`/admin/shop/items/${id}`, { active: true });
      if (action === "hide") return api.put(`/admin/shop/items/${id}`, { active: false });
      return null;
    }));
    clearSel();
    load();
  };

  const openEditor = (item) => {
    modal.open({
      title: item?.__new ? "Новый товар" : "Редактирование", width: 600,
      body: <ItemEditor item={item || { __new: true, name: "", category: "Предметы", subcategory: "", price: 0, preview: "#3b82f6", description: "", active: true }} api={api} onSaved={() => { load(); modal.close(); }} onCancel={modal.close} />,
    });
  };

  return (
    <div>
      <SectionHeader title="Магазин" sub={`${items.length} товаров`} action={
        <button onClick={() => openEditor(null)} style={btnPrimary}><Plus size={15} weight="bold" /> Добавить товар</button>
      } />

      <div style={{ ...card, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <MagnifyingGlass size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию..."
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "9px 14px 9px 34px", color: "#fff", fontSize: 13, outline: "none" }}
          />
        </div>
        <SelectBox value={catFilter} onChange={setCatFilter} options={[{ v: "__all__", l: "Все категории" }, ...categories.filter(c => c !== "__all__").map(c => ({ v: c, l: c }))]} />
        <SelectBox value={sort} onChange={setSort} options={[
          { v: "new", l: "Сначала новые" }, { v: "priceAsc", l: "Цена ↑" }, { v: "priceDesc", l: "Цена ↓" }, { v: "name", l: "По названию" },
        ]} />
      </div>

      {selected.size > 0 && (
        <div style={{ ...card, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Выбрано: {selected.size}</span>
          <button onClick={() => bulk("show")} style={btnGhost}>Показать</button>
          <button onClick={() => bulk("hide")} style={btnGhost}>Скрыть</button>
          <button onClick={() => bulk("delete")} style={{ ...btnGhost, color: "#fca5a5", borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)" }}>Удалить</button>
          <button onClick={clearSel} style={{ ...btnGhost, marginLeft: "auto" }}>Снять выделение</button>
        </div>
      )}

      {loading ? (
        <div style={{ ...card, padding: 60, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, padding: 60, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
          {items.length === 0 ? "Нет товаров. Нажмите «Добавить товар»." : "Ничего не найдено по фильтру."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={selectAll} style={{ ...btnGhost, alignSelf: "flex-start", fontSize: 11 }}>Выбрать все ({filtered.length})</button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            {filtered.map(item => (
              <div key={item.id} onClick={() => openEditor(item)} style={{
                ...card, padding: 12, cursor: "pointer", position: "relative",
                opacity: item.active === false ? 0.5 : 1,
                borderLeft: selected.has(item.id) ? "3px solid #3b82f6" : "3px solid transparent",
                transition: "transform 0.12s, borderColor 0.12s",
              }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div onClick={e => { e.stopPropagation(); toggleSel(item.id); }} style={{
                  position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 6, zIndex: 2,
                  background: selected.has(item.id) ? "#3b82f6" : "rgba(0,0,0,0.5)",
                  border: selected.has(item.id) ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}>
                  {selected.has(item.id) && <Check size={13} weight="bold" color="#fff" />}
                </div>
                <div style={{
                  width: "100%", aspectRatio: "1", borderRadius: 11, marginBottom: 10,
                  background: item.image ? `url(${item.image}) center/cover` : item.preview,
                  display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 6,
                }}>
                  {!item.image && <ImageIcon size={14} style={{ color: "rgba(255,255,255,0.3)" }} />}
                  {item.active === false && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(0,0,0,0.7)", color: "#fca5a5", padding: "2px 6px", borderRadius: 5 }}>СКРЫТ</span>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subcategory || item.category}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#93c5fd" }}>{(item.price || 0).toLocaleString("ru-RU")} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>SBT</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectBox({ value, onChange, options }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label="Выбор категории" style={{
        appearance: "none", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
        padding: "9px 32px 9px 13px", color: "#fff", fontSize: 13, outline: "none", cursor: "pointer", fontFamily: "inherit",
      }}>
        {options.map(o => <option key={o.v} value={o.v} style={{ background: "#111" }}>{o.l}</option>)}
      </select>
      <CaretDown size={12} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }} />
    </div>
  );
}

function ForumAdminSection() {
  const api = useAdminFetch();
  const modal = useModal();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/forum/articles`)
      .then(r => r.ok ? r.json() : [])
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const catLabel = (c) => (FORUM_CATEGORIES.find(x => x.value === c) || {}).label || c;

  const generate = () => {
    const ref = { topic: "", category: "articles", angle: "", version: "1.20.1" };
    modal.open({
      title: "Сгенерировать статью через ИИ",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ForumField label="Тема / запрос">
            <input onChange={e => ref.topic = e.target.value} placeholder="например: как установить forge на 1.20.1" style={forumInput} />
          </ForumField>
          <ForumField label="Категория">
            <select onChange={e => ref.category = e.target.value} style={forumInput}>
              {FORUM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </ForumField>
          <ForumField label="Версия Minecraft">
            <input onChange={e => ref.version = e.target.value} defaultValue={ref.version} style={forumInput} />
          </ForumField>
          <ForumField label="Фокус/угол (необязательно)">
            <input onChange={e => ref.angle = e.target.value} placeholder="например: пошаговый гайд для новичков" style={forumInput} />
          </ForumField>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.5, margin: "4px 0 0" }}>
            ИИ напишет статью через FreeQwenApi. Может занять 1-3 минуты. Не закрывайте окно.
          </p>
          <button onClick={async () => {
            if (!ref.topic.trim()) return;
            setBusy(true);
            try {
              const a = await api.post("/admin/forum/generate", { topic: ref.topic.trim(), category: ref.category, angle: ref.angle.trim() || undefined, version: ref.version });
              if (a && a.slug) { modal.close(); load(); }
              else alert("Не удалось сгенерировать: " + (a?.message || a?.detail || "неизвестная ошибка"));
            } catch (e) { alert("Ошибка: " + e.message); }
            finally { setBusy(false); }
          }} disabled={busy} style={forumBtn(busy)}>
            {busy ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><ArrowClockwise size={15} className="animate-spin" /> Генерация…</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Sparkle size={15} weight="fill" /> Сгенерировать</span>}
          </button>
        </div>
      ),
    });
  };

  const edit = (article) => {
    const ref = { ...article };
    const update = (patch) => Object.assign(ref, patch);
    modal.open({
      title: article?.slug ? "Редактировать статью" : "Новая статья",
      width: 620,
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ForumField label="Заголовок"><input defaultValue={ref.title} onChange={e => update({ title: e.target.value })} style={forumInput} /></ForumField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <ForumField label="Категория">
              <select defaultValue={ref.category} onChange={e => update({ category: e.target.value })} style={forumInput}>
                {FORUM_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </ForumField>
            <ForumField label="Версия MC"><input defaultValue={ref.version || ""} onChange={e => update({ version: e.target.value })} style={forumInput} /></ForumField>
          </div>
          <ForumField label="Теги (через запятую)"><input defaultValue={(ref.tags || []).join(", ")} onChange={e => update({ tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} style={forumInput} /></ForumField>
          <ForumField label="Краткое описание (excerpt)"><input defaultValue={ref.excerpt || ""} onChange={e => update({ excerpt: e.target.value })} style={forumInput} /></ForumField>
          <ForumField label="Тело статьи (Markdown)">
            <textarea defaultValue={ref.body || ""} onChange={e => update({ body: e.target.value })} style={{...forumInput, minHeight: 260, fontFamily: "monospace", resize: "vertical" }} />
          </ForumField>
          <button onClick={async () => {
            setBusy(true);
            try {
              const saved = await api.put(`/admin/forum/articles/${article.slug || "new"}`, ref);
              if (saved && saved.slug) { modal.close(); load(); }
              else alert("Ошибка: " + (saved?.message || "неизвестно"));
            } catch (e) { alert("Ошибка: " + e.message); }
            finally { setBusy(false); }
          }} disabled={busy} style={forumBtn(busy)}>{busy ? "Сохранение…" : "Сохранить"}</button>
        </div>
      ),
    });
  };

  const remove = (article) => {
    if (!confirm(`Удалить «${article.title}»?`)) return;
    api.del(`/admin/forum/articles/${article.slug}`).then(() => load());
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Форум</h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
            Живые статьи (Redis). Генерируются ИИ или пишутся вручную.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={generate} style={{ ...forumBtn(false), background: "#3b82f6", color: "#fff" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Sparkle size={15} weight="fill" /> ИИ-генерация</span>
          </button>
          <button onClick={() => edit({ category: "articles", tags: [], version: "1.20.1" })} style={forumBtn(false)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Plus size={15} weight="bold" /> Новая</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 40 }}>Загрузка…</div>
      ) : articles.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
          Пока нет статей. Сгенерируйте через ИИ или создайте вручную.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {articles.map(a => (
            <div key={a.slug} style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(59,130,246,0.18)", color: "#93c5fd" }}>{catLabel(a.category)}</span>
                  {a.ai && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(168,85,247,0.18)", color: "#c4b5fd" }}>ИИ</span>}
                  {a.version && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>MC {a.version}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{a.publishedAt} · /{a.slug}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a href={`/forum/read/${a.slug}`} target="_blank" rel="noreferrer" title="Открыть" style={{...forumIconBtn, textDecoration: "none" }}><MagnifyingGlass size={15} /></a>
                <button onClick={() => edit(a)} title="Редактировать" style={forumIconBtn}><PencilSimple size={15} /></button>
                <button onClick={() => remove(a)} title="Удалить" style={{...forumIconBtn, color: "#f87171" }}><Trash size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const forumInput = {
  width: "100%", padding: "11px 13px", borderRadius: 10, fontFamily: "inherit", fontSize: 13,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none",
};
const forumBtn = (busy) => ({
  padding: "11px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer",
  background: "#fff", color: "#000", border: "none", fontFamily: "inherit", opacity: busy ? 0.6 : 1,
});
const forumIconBtn = {
  width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", cursor: "pointer",
};
function ForumField({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.02em" }}>{label}</div>
      {children}
    </label>
  );
}

function AffiliateAdminSection() {
  const api = useAdminFetch();
  const [levels, setLevels] = useState([]);
  const [subPercent, setSubPercent] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/admin/affiliate/levels").then(d => {
      const lvls = (d.levels || []).map(l => ({
        ...l,
        minReferrals: l.minReferrals ?? 0,
        players: l.players || String(l.minReferrals ?? 0),
      }));
      setLevels(lvls);
      setSubPercent(String(d.subAffiliatePercent ?? 10));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updLevel = (i, field, val) => {
    setLevels(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  const save = async () => {
    setSaving(true); setSaved(false);
    await api.post("/admin/affiliate/levels", {
      levels: levels.map(l => ({
        level: l.level,
        percent: parseInt(l.percent, 10) || 0,
        minReferrals: parseInt(l.minReferrals, 10) || 0,
      })),
      subAffiliatePercent: parseInt(subPercent, 10) || 0,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ ...card, padding: 60, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Загрузка...</div>;

  const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#ef4444", "#f59e0b"];

  return (
    <div>
      <SectionHeader title="Партнёрка" sub="Проценты комиссий по уровням" />

      <div style={{ ...card, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
          Уровни партнёров
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {levels.map((l, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${colors[i % colors.length]}20`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 900, color: colors[i % colors.length],
              }}>
                {l.level}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Уровень {l.level}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>от</span>
                  <input
                    type="number" min="0"
                    value={l.minReferrals ?? 0}
                    onChange={e => updLevel(i, "minReferrals", e.target.value)}
                    style={{
                      width: 52, textAlign: "center", padding: "4px 2px", borderRadius: 6,
                      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, outline: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>рефералов</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min="0" max="100"
                  value={l.percent}
                  onChange={e => updLevel(i, "percent", e.target.value)}
                  style={{
                    width: 64, textAlign: "center", padding: "8px 4px", borderRadius: 8,
                    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                    color: colors[i % colors.length], fontSize: 16, fontWeight: 800, outline: "none",
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>
          Суб-рефералы
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Процент суб-реферала</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Партнёр получает этот % от комиссии своего реферала-партнёра</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number" min="0" max="100"
              value={subPercent}
              onChange={e => setSubPercent(e.target.value)}
              style={{
                width: 64, textAlign: "center", padding: "8px 4px", borderRadius: 8,
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#22c55e", fontSize: 16, fontWeight: 800, outline: "none",
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>%</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{
          padding: "12px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
          background: saving ? "rgba(37,99,235,0.3)" : "#3b82f6", border: "none", color: "#fff",
          cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
        }}>
          {saving ? "Сохранение..." : saved ? "Сохранено ✓" : "Сохранить"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Готово</span>}
      </div>

    </div>
  );
}

function UserCommissionEditor({ api, tgId, onSaved }) {
  const [customPct, setCustomPct] = useState("");
  const [affiliateInfo, setAffiliateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (!tgId) return;
    setLoading(true);
    api.get(`/admin/affiliate/user?search=${encodeURIComponent(tgId)}`).then(d => {
      const u = (d.users || []).find(x => x.tgId === String(tgId));
      if (u) {
        setAffiliateInfo(u);
        setCustomPct(u.customPercent !== null && u.customPercent !== undefined ? String(u.customPercent) : "");
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tgId]);

  const saveCustom = async () => {
    if (!affiliateInfo) return;
    setSaving(true); setSavedMsg("");
    try {
      const pct = customPct === "" ? null : parseInt(customPct, 10);
      const d = await api.post("/admin/affiliate/user", { tgId: String(tgId), customPercent: pct });
      setAffiliateInfo({ ...affiliateInfo, customPercent: d.customPercent, effectivePercent: d.effectivePercent });
      setSavedMsg("Сохранено");
      onSaved?.();
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) { setSavedMsg("Ошибка"); }
    setSaving(false);
  };

  if (loading) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "4px 0" }}>Загрузка...</div>;
  if (!affiliateInfo) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "4px 0" }}>Нет партнёрских данных</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          {affiliateInfo.referralCount} рефералов
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.15)" }}>·</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          Ур. {affiliateInfo.level?.level} — {affiliateInfo.level?.percent}%
        </span>
        {affiliateInfo.customPercent !== null && affiliateInfo.customPercent !== undefined && (
          <>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.15)" }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>
              Кастом: {affiliateInfo.customPercent}%
            </span>
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="number" min="0" max="100"
          value={customPct}
          onChange={e => setCustomPct(e.target.value)}
          placeholder="% по умолчанию"
          style={{
            width: 100, textAlign: "center", padding: "10px 6px", borderRadius: 10,
            background: "rgba(255,255,255,0.05)", border: "none",
            color: customPct ? "#f59e0b" : "rgba(255,255,255,0.3)", fontSize: 15, fontWeight: 800, outline: "none",
          }}
        />
        <button onClick={saveCustom} disabled={saving} style={{
          padding: "10px 18px", borderRadius: 10, border: "none",
          background: saving ? "rgba(245,158,11,0.25)" : "#f59e0b",
          color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>
          {saving ? "..." : "Применить"}
        </button>
        {customPct && (
          <button onClick={() => setCustomPct("")} style={{
            padding: "10px 14px", borderRadius: 10, border: "none",
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)",
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>
            Сбросить
          </button>
        )}
        {savedMsg && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{savedMsg}</span>}
      </div>
    </div>
  );
}

function ItemEditor({ item, api, onSaved, onCancel }) {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isNew = !!item.__new;
  const fileRef = useRef(null);
  const upd = (patch) => setForm(f => ({ ...f, ...patch }));

  const handleUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f || isNew) return;
    const fd = new FormData(); fd.append("image", f);
    const d = await api.upload(`/admin/shop/items/${form.id}/image`, fd);
    if (d.image) upd({ image: d.image });
  };

  const submit = async () => {
    if (!form.name) { setErr("Введите название"); return; }
    setSaving(true); setErr("");
    try {
      const body = { ...form, price: parseInt(form.price, 10) || 0 };
      if (isNew) {
        delete body.__new;
        const d = await api.post("/admin/shop/items", body);
        if (d.ok === false) throw new Error(d.message);
      } else {
        const d = await api.put(`/admin/shop/items/${form.id}`, body);
        if (d.ok === false) throw new Error(d.message);
      }
      onSaved();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const del = async () => {
    if (!confirm("Удалить товар безвозвратно?")) return;
    await api.del(`/admin/shop/items/${form.id}`);
    onSaved();
  };

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none" };
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 5, display: "block" };

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 12, flexShrink: 0,
          background: form.image ? `url(${form.image}) center/cover` : form.preview,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{!form.image && <ImageIcon size={22} style={{ color: "rgba(255,255,255,0.2)" }} />}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()} disabled={isNew} style={{
            padding: "10px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: isNew ? "not-allowed" : "pointer", fontFamily: "inherit",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
            opacity: isNew ? 0.4 : 1, display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center",
          }}>
            <UploadSimple size={15} /> {isNew ? "Сначала сохраните" : "Загрузить фото"}
          </button>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>JPEG/PNG/WebP, до 5MB. Квадратное изображение смотрится лучше.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Название *</label>
          <input value={form.name || ""} onChange={e => upd({ name: e.target.value })} style={inputStyle} placeholder="Красный Кайбер-Кристалл" />
        </div>
        <div>
          <label style={labelStyle}>Категория</label>
          <input value={form.category || ""} onChange={e => upd({ category: e.target.value })} style={inputStyle} placeholder="Предметы" />
        </div>
        <div>
          <label style={labelStyle}>Подкатегория</label>
          <input value={form.subcategory || ""} onChange={e => upd({ subcategory: e.target.value })} style={inputStyle} placeholder="Кайбер-Кристалл" />
        </div>
        <div>
          <label style={labelStyle}>Цена (SBT)</label>
          <input type="number" value={form.price ?? 0} onChange={e => upd({ price: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Цвет (если нет фото)</label>
          <input value={form.preview || ""} onChange={e => upd({ preview: e.target.value })} style={inputStyle} placeholder="#ef4444" />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Описание</label>
        <textarea value={form.description || ""} onChange={e => upd({ description: e.target.value })} style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} placeholder="Необязательно" />
      </div>

      <div style={{ marginBottom: 18 }}>
        <button onClick={() => upd({ active: !form.active })} style={{
          width: "100%", padding: "10px 13px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          background: form.active !== false ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
          border: form.active !== false ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
          color: form.active !== false ? "#86efac" : "rgba(255,255,255,0.4)",
        }}>{form.active !== false ? "✓ Виден в магазине" : "Скрыт из магазина"}</button>
      </div>

      {err && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={saving || !form.name} style={{
          flex: 1, padding: "12px", borderRadius: 9, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", cursor: saving || !form.name ? "not-allowed" : "pointer", fontFamily: "inherit",
          background: saving || !form.name ? "rgba(37,99,235,0.3)" : "#3b82f6", border: "none", color: "#fff",
        }}>{saving ? "Сохранение..." : "Сохранить"}</button>
        {!isNew && <button onClick={del} style={{ padding: "12px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", display: "inline-flex", alignItems: "center", gap: 5 }}><Trash size={14} /> Удалить</button>}
        <button onClick={onCancel} style={{ padding: "12px 18px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>Отмена</button>
      </div>
    </div>
  );
}

const btnPrimary = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10,
  background: "#3b82f6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
  letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "inherit",
};
const btnGhost = {
  padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)",
};

function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
