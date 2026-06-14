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

export default function RecentActivityCard() {
  const [data, setData] = useState({ totalSec: 0, byServer: {}, lastSessionAt: null, recent: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => { load(); }, [load]);

  const serverEntries = Object.entries(data.byServer).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
          style={{ color: "rgba(255,255,255,0.18)" }}>Недавняя активность</p>
        {data.lastSessionAt && (
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
            Последний заход: {new Date(data.lastSessionAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {serverEntries.length === 0 ? (
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          {loading ? "Загружаем…" : "Запусти игру — здесь появится статистика."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Clock size={12} weight="fill" style={{ color: "#818cf8" }} />
            <span className="text-[14px] font-black text-white tabular-nums">{formatHours(data.totalSec)}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>всего</span>
          </div>
          {serverEntries.map(([srv, sec]) => {
            const pct = data.totalSec ? Math.round((sec / data.totalSec) * 100) : 0;
            return (
              <div key={srv} className="flex items-center gap-2.5">
                <span className="text-[11px] font-medium text-white w-24 truncate">
                  {SERVER_LABEL[srv] || srv}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #6366f1, #818cf8)" }}
                  />
                </div>
                <span className="text-[10px] tabular-nums w-16 text-right"
                  style={{ color: "rgba(255,255,255,0.45)" }}>
                  {formatHours(sec)} · {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
