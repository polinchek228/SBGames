import React, { useState } from "react";
import { motion } from "framer-motion";
import { Scales, ChatDots, GameController, Hexagon, Warning } from "@phosphor-icons/react";

const card = { background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" };

const SECTIONS = [
  {
    id: "general", icon: Scales, label: "Общие положения", tag: "Раздел 1",
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
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 40, alignItems: "start" }}>

          {/* SIDEBAR — на чёрном, без карточек */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Header */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Hexagon size={18} weight="bold" style={{ color: "rgba(255,255,255,0.65)" }} />
                <span style={{ fontSize: 19, fontWeight: 800 }}>Правила</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                Документация проекта
              </div>
            </div>

            {/* Section buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SECTIONS.map(s => {
                const on = active === s.id;
                return (
                  <button key={s.id} onClick={() => setActive(s.id)}
                    style={{
                      background: on ? "rgba(255,255,255,0.06)" : "transparent",
                      border: "none", borderRadius: 10, padding: "12px 14px",
                      textAlign: "left", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      color: on ? "#fff" : "rgba(255,255,255,0.45)",
                      fontWeight: on ? 700 : 500, fontSize: 13, transition: "all 0.12s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <s.icon size={15} weight={on ? "fill" : "regular"} />
                      {s.label}
                    </span>
                    {on && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.6)" }} />}
                  </button>
                );
              })}
            </div>

            {/* Warning */}
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "13px 14px", display: "flex", gap: 9, alignItems: "flex-start",
            }}>
              <Warning size={14} weight="fill" style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>
                Незнание правил не освобождает от ответственности. Играйте честно.
              </div>
            </div>
          </div>

          {/* CONTENT — заголовок на чёрном, правила отдельными карточками */}
          {section && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)",
                fontSize: 11, fontWeight: 600, borderRadius: 8, padding: "5px 12px", marginBottom: 18,
              }}>
                <section.icon size={13} weight="duotone" /> {section.tag}
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>{section.title}</h1>
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, marginBottom: 26 }}>
                {section.sub}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {section.rules.map((rule, i) => (
                  <div key={i} style={{ ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: "1px solid rgba(255,255,255,0.18)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.55 }}>{rule}</span>
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
