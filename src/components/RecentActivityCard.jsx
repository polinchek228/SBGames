import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock } from "@phosphor-icons/react";
import { authedFetch } from "../lib/api.js";

export const ACTIVITY_KEY = "sbgames_activity_local";

export function readLocalActivity() {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); }
  catch { return []; }
}

export function pushLocalActivity(serverId, durationSec) {
  if (!serverId || !durationSec) return;
  const list = readLocalActivity();
  const now = Date.now();
  list.push({ serverId, startedAt: now - durationSec * 1000, endedAt: now, durationSec });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(-200)));
}

function formatHours(sec) {
  if (!sec) return "0ч";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h && m) return `${h}ч ${m}м`;
  if (h) return `${h}ч`;
  return `${m}м`;
}

const SERVER_LABEL = { starwars: "STARWARS" };

export default function RecentActivityCard({ userId }) {
  const [data, setData] = useState({ totalSec: 0, byServer: {}, lastSessionAt: null, recent: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (userId) {
      // Fetch public profile activity
      try {
        const remote = await authedFetch(`/api/user/${userId}/activity`);
        setData({
          totalSec: remote.totalSec || 0,
          byServer: remote.byServer || {},
          lastSessionAt: remote.lastSessionAt || null,
          recent: remote.recent || []
        });
      } catch {}
      finally { setLoading(false); }
    } else {
      // Local profile activity
      const local = readLocalActivity();
      const localAgg = { totalSec: 0, byServer: {}, recent: [...local].reverse().slice(0, 10) };
      for (const s of local) {
        localAgg.totalSec += s.durationSec || 0;
        localAgg.byServer[s.serverId] = (localAgg.byServer[s.serverId] || 0) + (s.durationSec || 0);
        if (!localAgg.lastSessionAt || s.endedAt > localAgg.lastSessionAt) localAgg.lastSessionAt = s.endedAt;
      }
      setData(localAgg);
      try {
        const remote = await authedFetch("/api/activity");
        const merged = { ...localAgg };
        if (remote.totalSec > merged.totalSec) merged.totalSec = remote.totalSec;
        for (const k of Object.keys(remote.byServer || {})) {
          merged.byServer[k] = Math.max(merged.byServer[k] || 0, remote.byServer[k] || 0);
        }
        if ((remote.recent?.length || 0) > 0) {
          const seen = new Set(merged.recent.map(s => `${s.startedAt}_${s.serverId}`));
          for (const s of remote.recent) {
            const k = `${s.startedAt}_${s.serverId}`;
            if (!seen.has(k)) { merged.recent.push(s); seen.add(k); }
          }
          merged.recent.sort((a, b) => b.endedAt - a.endedAt);
          merged.recent = merged.recent.slice(0, 10);
        }
        if (remote.lastSessionAt && remote.lastSessionAt > (merged.lastSessionAt || 0)) {
          merged.lastSessionAt = remote.lastSessionAt;
        }
        setData(merged);
      } catch {} finally { setLoading(false); }
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const serverEntries = Object.entries(data.byServer).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:scale-[1.005]"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)"
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] font-black"
          style={{ color: "rgba(255,255,255,0.35)" }}>Активность в игре</p>
        {data.lastSessionAt && (
          <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
            Последняя игра: {new Date(data.lastSessionAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {serverEntries.length === 0 ? (
        <p className="text-[12px] font-medium py-2" style={{ color: "rgba(255,255,255,0.25)" }}>
          {loading ? "Загружаем…" : "Этот игрок ещё не играл в игры."}
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20">
              <Clock size={14} weight="bold" style={{ color: "#818cf8" }} />
            </div>
            <span className="text-[16px] font-black text-white tabular-nums">{formatHours(data.totalSec)}</span>
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>суммарное время</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {serverEntries.map(([srv, sec]) => {
              const pct = data.totalSec ? Math.round((sec / data.totalSec) * 100) : 0;
              return (
                <div key={srv} className="flex items-center gap-3 group">
                  <span className="text-[12px] font-bold text-white/95 w-24 truncate group-hover:text-white transition-colors">
                    {SERVER_LABEL[srv] || srv.toUpperCase()}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.02)" }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg, #6366f1, #a855f7)",
                        boxShadow: "0 0 8px rgba(99, 102, 241, 0.4)"
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold tabular-nums w-20 text-right"
                    style={{ color: "rgba(255,255,255,0.5)" }}>
                    {formatHours(sec)} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
