import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2 } from "lucide-react";
import { API_URL, authedFetch } from "../lib/api.js";

export default function ProfileComments({ targetId, viewer, onOpenProfile }) {
  const [comments, setComments] = useState([]);
  const [text,     setText]     = useState("");
  const [loading,  setLoading]  = useState(true);
  const [posting,  setPosting]  = useState(false);
  const [error,    setError]    = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const isOwn = targetId === viewer?.id;
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/user/${encodeURIComponent(targetId)}/comments`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setComments(d.comments || []);
    } catch { setError("Не удалось загрузить комментарии"); }
    finally { setLoading(false); }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async () => {
    const t = text.trim();
    if (!t || posting || isOwn) return;
    setPosting(true); setError(null);
    try {
      const d = await authedFetch(`/api/user/${encodeURIComponent(targetId)}/comments`, {
        method: "POST", body: JSON.stringify({ text: t }),
      });
      setComments(prev => [d.comment, ...prev]);
      setText("");
      setCooldown(10);
    } catch (e) {
      const m = e.message || "";
      if (m.includes("429")) { setCooldown(10); setError("Подожди 10 секунд"); }
      else setError(m.replace(/^\d+:\s*/, ""));
    } finally { setPosting(false); }
  };

  const deleteComment = async (cid) => {
    try {
      await authedFetch(`/api/user/${encodeURIComponent(targetId)}/comments/${cid}`, { method: "DELETE" });
      setComments(prev => prev.filter(c => c.id !== cid));
    } catch {}
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
          style={{ color: "rgba(255,255,255,0.35)" }}>
          Комментарии · {comments.length}
        </p>
      </div>

      {!isOwn && viewer ? (
        <div className="rounded-2xl p-3 flex flex-col gap-2"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))}
            placeholder="Напиши комментарий…"
            rows={2}
            maxLength={200}
            className="w-full rounded-xl text-[12px] px-3 py-2 outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "#fff", caretColor: "#60a5fa" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{text.length}/200</span>
            <button onClick={submit}
              disabled={!text.trim() || posting || cooldown > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition-all"
              style={{ background: "rgba(37,99,235,0.6)" }}>
              <Send size={11} />
              {cooldown > 0 ? `${cooldown}с` : posting ? "…" : "Отправить"}
            </button>
          </div>
          {error && <p className="text-[10px]" style={{ color: "#fca5a5" }}>{error}</p>}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[11px] py-4 text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Комментариев пока нет</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {comments.map(c => {
            const canDelete = c.fromId === viewer?.id || isOwn;
            return (
              <div key={c.id} className="group rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => onOpenProfile?.(c.fromId)}
                    className="text-[11px] font-bold text-white/80 hover:text-white transition-colors">
                    @{c.fromUsername}
                  </button>
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.18)" }}>
                    {new Date(c.time).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex-1" />
                  {canDelete && (
                    <button onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                      style={{ color: "rgba(239,68,68,0.6)" }}
                      title="Удалить">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{c.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
