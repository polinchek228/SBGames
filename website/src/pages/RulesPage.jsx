import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ChatDots, GameController } from "@phosphor-icons/react";

const card = { background: "#0d0d0d", borderRadius: 16 };
const innerCard = { background: "#111", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" };

const SECTIONS = [
  {
    id: "general", icon: Shield, label: "Общие положения", tag: "Раздел 1",
    title: "Общие положения", sub: "Фундаментальные основы нашего проекта",
    rules: [
      "Администрация имеет право изменять правила в любое время без предварительного уведомления.",
      "Незнание правил не освобождает от ответственности.",
      "Все пожертвования являются добровольными и не подлежат возврату.",
      "Аккаунт и все игровое имущество являются собственностью проекта.",
      "Запрещена продажа игровых ценностей за реальные деньги.",
    ],
  },
  {
    id: "chat", icon: ChatDots, label: "Поведение и чат", tag: "Раздел 2",
    title: "Поведение и чат", sub: "Правила общения на серверах",
    rules: [
      "Запрещён мат, оскорбления и унижения других игроков.",
      "Запрещена реклама сторонних ресурсов без разрешения администрации.",
      "Флуд, спам и капслок в чате запрещены.",
      "Уважительное отношение к администрации и модерации обязательно.",
      "Дискриминация по любому признаку строго запрещена.",
    ],
  },
  {
    id: "gameplay", icon: GameController, label: "Игровой процесс", tag: "Раздел 3",
    title: "Игровой процесс", sub: "Правила игры на серверах",
    rules: [
      "Использование читов, хаков и запрещённых модов запрещено.",
      "Гриферство на защищённых территориях запрещено.",
      "Нельзя использовать баги и дюпы для получения преимущества.",
      "Буст аккаунтов и фарм с нескольких аккаунтов запрещён.",
      "Решение администрации является окончательным.",
    ],
  },
];

export default function RulesPage() {
  const [active, setActive] = useState("general");
  const section = SECTIONS.find(s => s.id === active);

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Header block */}
            <div style={{ ...card, padding: "16px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>◯</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Правила</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                ДОКУМЕНТАЦИЯ ПРОЕКТА
              </div>
            </div>

            {/* Section buttons */}
            <div style={{ ...card, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setActive(s.id)}
                  style={{
                    background: active === s.id ? "#1a1a1a" : "transparent",
                    border: active === s.id ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
                    color: active === s.id ? "#fff" : "rgba(255,255,255,0.48)",
                    borderRadius: 9, padding: "11px 12px", textAlign: "left", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontWeight: active === s.id ? 700 : 500, fontSize: 12, transition: "all 0.12s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <s.icon size={13} />
                    <span>{s.label}</span>
                  </div>
                  {active === s.id && (
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                  )}
                </button>
              ))}
            </div>

            {/* Warning */}
            <div style={{
              background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 12, padding: "12px 13px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 5 }}>⚠ Внимание</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.55 }}>
                Незнание правил не освобождает от ответственности. Играйте честно.
              </div>
            </div>
          </div>

          {/* CONTENT */}
          {section && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              style={{ ...card, padding: "32px 30px" }}
            >
              <div style={{
                display: "inline-block", background: "rgba(59,130,246,0.14)", color: "#3b82f6",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: 20, padding: "4px 13px", marginBottom: 18, width: "fit-content",
              }}>
                {section.tag}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{section.title}</h1>
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                {section.sub}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {section.rules.map((rule, i) => (
                  <div key={i} style={{ ...innerCard, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ color: "#3b82f6", fontSize: 8, marginTop: 5, flexShrink: 0 }}>●</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}
