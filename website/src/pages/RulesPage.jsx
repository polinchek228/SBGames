import React, { useState } from "react";
import { motion } from "framer-motion";
import { Scales, ChatDots, GameController, Skull, Hexagon, Warning } from "@phosphor-icons/react";

const card = { background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" };

const SECTIONS = [
  {
    id: "general", icon: Scales, label: "Общие положения", tag: "Раздел 1",
    title: "Общие положения", sub: "Фундаментальные основы проекта",
    rules: [
      "Администрация вправе изменять правила в любое время без предварительного уведомления.",
      "Незнание правил не освобождает от ответственности.",
      "Все пожертвования являются добровольными и не подлежат возврату.",
      "Аккаунт и всё игровое имущество являются собственностью проекта.",
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
    title: "Игровой процесс", sub: "Правила честной игры",
    rules: [
      "Использование читов, хаков и запрещённых модов запрещено.",
      "Гриферство на защищённых территориях запрещено.",
      "Нельзя использовать баги и дюпы для получения преимущества.",
      "Буст аккаунтов и мультиаккаунтинг запрещены.",
      "Решение администрации в спорных ситуациях является окончательным.",
    ],
  },
  {
    id: "punishments", icon: Skull, label: "Наказания", tag: "Раздел 4",
    title: "Наказания", sub: "Типы санкций и порядок применения",
    rules: [
      "Предупреждение — за незначительные нарушения. Три предупреждения = мут на 24 часа.",
      "Мут — временный запрет чата. Срок от 30 минут до 30 дней в зависимости от нарушения.",
      "Кик — принудительное отключение от сервера без запрета повторного входа.",
      "Временный бан — за серьёзные нарушения. Срок от 1 дня до 6 месяцев.",
      "Перманентный бан — за использование читов и систематические нарушения. Без права восстановления.",
    ],
  },
];

export default function RulesPage() {
  const [active, setActive] = useState("general");
  const section = SECTIONS.find(s => s.id === active);

  return (
    <main style={{ minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "40px 24px 64px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 40, alignItems: "start" }}>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "sticky", top: 90 }}>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Hexagon size={17} weight="bold" style={{ color: "rgba(255,255,255,0.55)" }} />
                <span style={{ fontSize: 18, fontWeight: 800 }}>Правила</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                Документация проекта
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {SECTIONS.map(s => {
                const on = active === s.id;
                return (
                  <button key={s.id} onClick={() => setActive(s.id)}
                    style={{
                      background: on ? "rgba(255,255,255,0.06)" : "transparent",
                      border: "none", borderRadius: 10, padding: "11px 13px",
                      textAlign: "left", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      color: on ? "#fff" : "rgba(255,255,255,0.45)",
                      fontWeight: on ? 700 : 500, fontSize: 13, transition: "all 0.12s",
                    }}
                    onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <s.icon size={14} weight={on ? "fill" : "regular"} />
                      {s.label}
                    </span>
                    {on && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.55)", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "13px 14px", display: "flex", gap: 9, alignItems: "flex-start",
            }}>
              <Warning size={13} weight="fill" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", lineHeight: 1.55 }}>
                Незнание правил не освобождает от ответственности. Играйте честно.
              </div>
            </div>
          </div>

          {/* CONTENT */}
          {section && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600,
                borderRadius: 8, padding: "5px 11px", marginBottom: 16,
              }}>
                <section.icon size={12} weight="duotone" /> {section.tag}
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.02em" }}>{section.title}</h1>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 24 }}>{section.sub}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {section.rules.map((rule, i) => (
                  <div key={i} style={{ ...card, padding: "15px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                      border: "1px solid rgba(255,255,255,0.16)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.38)" }} />
                    </span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{rule}</span>
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
