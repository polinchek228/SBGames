import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  TrendUp, UsersThree, CurrencyDollar, Handshake, CalendarBlank,
  ChartBarHorizontal, Headset, ArrowRight, Copy, Check,
  UserPlus, CreditCard, WarningCircle,
} from "@phosphor-icons/react";
import { api } from "../lib/api.js";

const TABS = [
  { key: "home",          label: "Главная",        icon: ChartBarHorizontal },
  { key: "referrals",     label: "Рефералы",       icon: UsersThree },
  { key: "sub",           label: "Суб-рефералы",    icon: Handshake },
  { key: "commissions",   label: "Комиссии",        icon: CurrencyDollar },
  { key: "payouts",       label: "Заявки на вывод", icon: CreditCard },
  { key: "reports",       label: "Статистика",      icon: TrendUp },
  { key: "manager",       label: "Менеджер",         icon: Headset },
];

const card = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 20,
};

const LEVELS = [
  { level: 1, percent: 30, players: "0–14",   color: "#3b82f6" },
  { level: 2, percent: 35, players: "15–49",  color: "#6366f1" },
  { level: 3, percent: 40, players: "50–99",  color: "#8b5cf6" },
  { level: 4, percent: 45, players: "100–199", color: "#a855f7" },
  { level: 5, percent: 50, players: "200–399", color: "#ec4899" },
  { level: 6, percent: 55, players: "400–699", color: "#ef4444" },
  { level: 7, percent: 60, players: "700+",    color: "#f59e0b" },
];

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ ...card, padding: "22px 20px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 46, height: 46, borderRadius: 14,
        background: `${color || "#3b82f6"}18`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} color={color || "#3b82f6"} weight="duotone" />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{label}</div>
      </div>
      {sub !== undefined && (
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#22c55e", fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button onClick={handleCopy} style={{
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center",
      color: copied ? "#22c55e" : "rgba(255,255,255,0.5)",
    }}>
      {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
    </button>
  );
}

function HomeTab({ user, stats }) {
  const referralLink = stats?.referralCode
    ? `https://games.sb-capital.group/invite/${stats.referralCode}`
    : "Загрузка...";
  const currentLevel = LEVELS.find(l => l.percent === stats.levelPercent) || LEVELS[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Welcome */}
      <div style={{ ...card, padding: "28px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top left, rgba(59,130,246,0.08), transparent 60%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>С возвращением, {user?.nick || user?.telegramNick || "Партнёр"}!</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            Вот как идёт ваше партнёрство — продолжайте привлекать игроков!
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard icon={TrendUp} label="Общий заработок" value={`$${(stats.totalEarned || 0).toFixed(2)}`} color="#3b82f6" />
        <StatCard icon={UsersThree} label="Всего рефералов" value={stats.totalReferrals || 0} color="#22c55e" />
        <StatCard icon={CurrencyDollar} label="К выплате" value={`$${(stats.pendingPayout || 0).toFixed(2)}`} color="#f59e0b" />
      </div>

      {/* Referral link */}
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ваша партнёрская ссылка</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {referralLink}
          </div>
          <CopyButton text={referralLink} />
        </div>
      </div>

      {/* Current level */}
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Текущий уровень</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: `${currentLevel.color}20`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 900, color: currentLevel.color,
          }}>
            {currentLevel.level}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Уровень {currentLevel.level} — {currentLevel.percent}%</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Нужно {currentLevel.players} активных рефералов
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${LEVELS.length}, 1fr)`, gap: 6 }}>
          {LEVELS.map(l => (
            <div key={l.level} style={{
              padding: "8px 0", borderRadius: 10, textAlign: "center", fontSize: 11, fontWeight: 700,
              background: l.level <= currentLevel.level ? `${l.color}25` : "rgba(255,255,255,0.03)",
              color: l.level <= currentLevel.level ? l.color : "rgba(255,255,255,0.25)",
              border: l.level === currentLevel.level ? `1px solid ${l.color}40` : "1px solid transparent",
            }}>
              {l.percent}%
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Последние начисления</div>
        {(stats.recentCommissions || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "20px 0" }}>
            Пока нет начислений. Начните привлекать игроков!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.recentCommissions.map((c, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.nick || "Игрок"}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {new Date(c.date || c.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#22c55e" }}>
                  +${(c.amount || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralsTab({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Ваши рефералы</div>
        {(stats.referrals || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0" }}>
            Вы пока никого не пригласили. Поделитесь ссылкой!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.referrals.map((r, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#3b82f6",
                  }}>
                    {(r.nick || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{r.nick || r.username}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      Привлечён {new Date(r.joinedAt || r.createdAt).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                    ${(r.totalEarned || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    ${(r.totalDonated || 0).toFixed(2)} донат
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubAffiliatesTab({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Суб-рефералы</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
          Партнёры, зарегистрировавшиеся по вашей ссылке — вы получаете % от их рефералов
        </div>
        {(stats.subAffiliates || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0" }}>
            Пока нет суб-рефералов
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.subAffiliates.map((s, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#8b5cf6",
                  }}>
                    {(s.nick || "?")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.nick || s.username}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      {s.referralCount || 0} рефералов
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                  +${(s.yourCommission || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommissionsTab({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>История комиссий</div>
        {(stats.allCommissions || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0" }}>
            Начислений пока нет
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.allCommissions.map((c, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    Донат от {c.playerNick || "игрока"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {new Date(c.date || c.createdAt).toLocaleDateString("ru-RU")} • {c.level || 1} ур.
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#22c55e" }}>
                  +${(c.amount || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PayoutsTab({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Заявки на вывод</div>
        {(stats.payouts || []).length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0" }}>
            Вы пока не создавали заявок на вывод
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.payouts.map((p, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                    ${(p.amount || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    {p.method || "Карта"} • {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <div style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: p.status === "completed" ? "rgba(34,197,94,0.15)" :
                              p.status === "pending" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                  color: p.status === "completed" ? "#22c55e" :
                         p.status === "pending" ? "#f59e0b" : "#ef4444",
                }}>
                  {p.status === "completed" ? "Выполнено" : p.status === "pending" ? "Ожидает" : "Отклонено"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsTab({ stats }) {
  const months = stats.monthlyStats || [];
  const maxVal = Math.max(...months.map(m => m.earned || 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "24px 28px" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Статистика по месяцам</div>
        {months.length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "32px 0" }}>
            Нет данных за прошлые месяцы
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {months.map((m, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "10px 0",
              }}>
                <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                  {m.month}
                </div>
                <div style={{ flex: 1, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.04)", position: "relative" }}>
                  <div style={{
                    height: "100%", borderRadius: 8,
                    background: "linear-gradient(90deg, #3b82f6, #6366f1)",
                    width: `${((m.earned || 0) / maxVal * 100).toFixed(1)}%`,
                    minWidth: m.earned > 0 ? 2 : 0,
                    display: "flex", alignItems: "center", paddingLeft: 8,
                  }}>
                    {(m.earned || 0) > maxVal * 0.15 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                        ${(m.earned || 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: 60, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  ${(m.earned || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, padding: "28px 28px", textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
          background: "rgba(59,130,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Headset size={28} color="#3b82f6" weight="duotone" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Ваш персональный менеджер</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 20, lineHeight: 1.6 }}>
          Если у вас есть вопросы по партнёрской программе,<br />
          свяжитесь с нами любым удобным способом:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <a href="https://t.me/sb7games" target="_blank" rel="noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
            color: "#3b82f6", textDecoration: "none",
          }}>
            Telegram: @sb7games
          </a>
          <a href="mailto:support@sb-capital.group" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.6)", textDecoration: "none",
          }}>
            support@sb-capital.group
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AffiliatePage({ user }) {
  const [tab, setTab] = useState("home");
  const [stats, setStats] = useState({
    totalEarned: 0, pendingPayout: 0, totalReferrals: 0,
    levelPercent: 30, referrals: [], subAffiliates: [],
    recentCommissions: [], allCommissions: [], payouts: [],
    monthlyStats: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api("/affiliate/stats");
      if (res) setStats(s => ({ ...s, ...res }));
    } catch (e) {
      console.warn("affiliate stats load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const renderTab = () => {
    if (loading) {
      return (
        <div style={{ ...card, padding: "40px 0", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
          Загрузка...
        </div>
      );
    }
    switch (tab) {
      case "home":        return <HomeTab user={user} stats={stats} />;
      case "referrals":   return <ReferralsTab stats={stats} />;
      case "sub":         return <SubAffiliatesTab stats={stats} />;
      case "commissions": return <CommissionsTab stats={stats} />;
      case "payouts":     return <PayoutsTab stats={stats} />;
      case "reports":     return <ReportsTab stats={stats} />;
      case "manager":     return <ManagerTab />;
      default:            return null;
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingTop: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Партнёрский кабинет</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          Управляйте своими рефералами и отслеживайте заработок
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, padding: "4px", borderRadius: 16,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRadius: 12,
            fontSize: 12, fontWeight: tab === key ? 700 : 500, whiteSpace: "nowrap",
            background: tab === key ? "rgba(255,255,255,0.08)" : "transparent",
            border: tab === key ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
            color: tab === key ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer",
            transition: "all 0.15s",
          }}>
            <Icon size={14} weight={tab === key ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {renderTab()}
    </div>
  );
}
