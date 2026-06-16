import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scales, ChatDots, GameController, Shield,
  Skull, Warning, ArrowRight, Check,
} from "@phosphor-icons/react";

const SECTIONS = [
  {
    id: "general",
    icon: Scales,
    label: "Общие положения",
    num: "01",
    color: "#60a5fa",
    colorBg: "rgba(37,99,235,0.1)",
    colorBorder: "rgba(59,130,246,0.22)",
    desc: "Базовые правила существования на проекте",
    rules: [
      { text: "Администрация вправе изменять правила в любое время — следите за обновлениями.", severity: "info" },
      { text: "Незнание правил не освобождает от ответственности. Прочитайте их до начала игры.", severity: "warn" },
      { text: "Все пожертвования добровольны и не подлежат возврату — это поддержка проекта, а не покупка услуги.", severity: "info" },
      { text: "Аккаунт и всё игровое имущество являются собственностью проекта. Банеры и вайпы — в праве администрации.", severity: "warn" },
      { text: "Продажа игровых ценностей за реальные деньги запрещена. Мы не несём ответственности за внешние сделки.", severity: "danger" },
    ],
  },
  {
    id: "chat",
    icon: ChatDots,
    label: "Поведение и чат",
    num: "02",
    color: "#a78bfa",
    colorBg: "rgba(124,58,237,0.1)",
    colorBorder: "rgba(139,92,246,0.22)",
    desc: "Правила общения в чате и голосе",
    rules: [
      { text: "Мат, оскорбления и унижения игроков — запрещены. Общайтесь уважительно.", severity: "danger" },
      { text: "Реклама сторонних ресурсов без разрешения администрации запрещена.", severity: "danger" },
      { text: "Флуд, спам и капслок нарушают комфорт всех игроков — не используйте это.", severity: "warn" },
      { text: "Уважительное отношение к администрации и модерации обязательно.", severity: "warn" },
      { text: "Дискриминация по любому признаку: национальность, религия, пол — строго запрещена.", severity: "danger" },
    ],
  },
  {
    id: "gameplay",
    icon: GameController,
    label: "Игровой процесс",
    num: "03",
    color: "#34d399",
    colorBg: "rgba(52,211,153,0.08)",
    colorBorder: "rgba(52,211,153,0.18)",
    desc: "Правила честной игры на серверах",
    rules: [
      { text: "Читы, хаки и запрещённые моды — бан без предупреждения. Исключений нет.", severity: "danger" },
      { text: "Гриферство на защищённых территориях других игроков запрещено.", severity: "danger" },
      { text: "Использование багов и дюпов для получения преимущества запрещено. Найденный баг — репортите.", severity: "warn" },
      { text: "Буст аккаунтов и мультиаккаунтинг запрещены. Каждый игрок = один аккаунт.", severity: "danger" },
      { text: "Решение администрации в спорных ситуациях окончательное.", severity: "info" },
    ],
  },
  {
    id: "punishments",
    icon: Skull,
    label: "Наказания",
    num: "04",
    color: "#f87171",
    colorBg: "rgba(239,68,68,0.08)",
    colorBorder: "rgba(239,68,68,0.18)",
    desc: "Типы санкций и порядок их применения",
    rules: [
      { text: "Предупреждение — выдаётся за незначительные нарушения. Три предупреждения = мут на 24ч.", severity: "warn" },
      { text: "Мут — временный запрет чата. Длина зависит от нарушения: от 30 минут до 30 дней.", severity: "warn" },
      { text: "Кик — принудительное отключение от сервера без запрета повторного входа.", severity: "warn" },
      { text: "Временный бан — применяется за серьёзные нарушения. Срок от 1 дня до 6 месяцев.", severity: "danger" },
      { text: "Перманентный бан — применяется за использование читов, грубые нарушения или систематические правонарушения. Без права восстановления.", severity: "danger" },
    ],
  },
];

const SEVERITY = {
  info:   { color: "rgba(255,255,255,0.18)", dot: "rgba(255,255,255,0.3)" },
  warn:   { color: "#fbbf24",                dot: "#fbbf24"                },
  danger: { color: "#f87171",                dot: "#f87171"                },
};

export default function RulesPage() {
  const [active, setActive] = useState("general");
  const section = SECTIONS.find(s => s.id === active);

  return (
    <main className="relative z-10" style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          style={{
            position: "relative", borderRadius: 20, padding: "36px 40px", marginBottom: 32, overflow: "hidden",
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Blue glow behind icon */}
          <div style={{ position: "absolute", top: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(59,130,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Shield size={26} weight="fill" color="#60a5fa" />
            </div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Правила сервера</h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 5 }}>
                Играя на SBGames, вы принимаете все правила, изложенные в этом документе
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
            {[
              { label: "Разделов", value: "4" },
              { label: "Правил",   value: "20" },
              { label: "Версия",   value: "2.1" },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{value}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>{label}</span>
              </div>
            ))}
            <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)" }}>
              <Warning size={12} color="#fbbf24" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>Незнание правил не освобождает от ответственности</span>
            </div>
          </div>
        </motion.div>

        {/* ── Body grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 90 }}>
            {SECTIONS.map((s, idx) => {
              const on = active === s.id;
              return (
                <motion.button key={s.id} onClick={() => setActive(s.id)}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                    padding: "11px 14px", borderRadius: 13, display: "flex", alignItems: "center", gap: 10,
                    background: on ? s.colorBg : "transparent",
                    boxShadow: on ? `inset 0 0 0 1px ${s.colorBorder}` : "none",
                    transition: "all 0.14s",
                  }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? `${s.color}1a` : "rgba(255,255,255,0.05)" }}>
                    <s.icon size={14} weight={on ? "fill" : "regular"} color={on ? s.color : "rgba(255,255,255,0.4)"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? "#fff" : "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{s.num}</p>
                  </div>
                  {on && <ArrowRight size={12} color={s.color} style={{ flexShrink: 0 }} />}
                </motion.button>
              );
            })}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {section && (
              <motion.div key={active}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                {/* Section header */}
                <div style={{
                  borderRadius: 18, padding: "24px 28px", marginBottom: 16,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 15, background: section.colorBg, border: `1px solid ${section.colorBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <section.icon size={22} weight="fill" color={section.color} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: section.color }}>Раздел {section.num}</span>
                      </div>
                      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>{section.label}</h2>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{section.desc}</p>
                    </div>
                  </div>
                </div>

                {/* Rules */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.rules.map((rule, i) => {
                    const sv = SEVERITY[rule.severity] || SEVERITY.info;
                    return (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.04 }}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", borderRadius: 14,
                          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {/* Left: number */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, paddingTop: 1 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: section.color, letterSpacing: "0.05em", minWidth: 24, textAlign: "center" }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div style={{ width: 1, height: "100%", minHeight: 8, background: `linear-gradient(to bottom, ${sv.color}60, transparent)` }} />
                        </div>

                        {/* Rule text */}
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, flex: 1, paddingTop: 0 }}>
                          {rule.text}
                        </p>

                        {/* Severity dot */}
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: sv.dot, flexShrink: 0, marginTop: 6, boxShadow: rule.severity === "danger" ? `0 0 6px ${sv.dot}80` : "none" }} />
                      </motion.div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
                  {[
                    { severity: "info",   label: "Информация" },
                    { severity: "warn",   label: "Предупреждение" },
                    { severity: "danger", label: "Серьёзное нарушение" },
                  ].map(({ severity, label }) => {
                    const sv = SEVERITY[severity];
                    return (
                      <div key={severity} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: sv.dot, boxShadow: severity === "danger" ? `0 0 6px ${sv.dot}80` : "none" }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
