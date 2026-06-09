import React, { useState } from "react";
import { Shield, ChatDots, GameController } from "@phosphor-icons/react";

const SECTIONS = [
  {
    id: "general", icon: Shield, label: "Общие положения", tag: "Раздел 1",
    title: "Общие положения",
    sub: "Фундаментальные основы нашего проекта",
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
    title: "Поведение и чат",
    sub: "Правила общения на серверах",
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
    title: "Игровой процесс",
    sub: "Правила игры на серверах",
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
    <main className="relative z-10 max-w-5xl mx-auto px-4 pb-16">
      <div className="grid" style={{ gridTemplateColumns: "220px 1fr", gap: 16 }}>

        {/* Sidebar */}
        <div className="flex flex-col gap-2">
          <div className="rounded-2xl p-4 mb-1"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
              <p className="text-[14px] font-black text-white">Правила</p>
            </div>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              Документация проекта
            </p>
          </div>

          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActive(s.id)}
              className="rounded-xl px-4 py-2.5 text-left flex items-center justify-between transition-all"
              style={active === s.id
                ? { background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid transparent", color: "rgba(255,255,255,0.5)" }
              }
            >
              <div className="flex items-center gap-2">
                <s.icon size={13} />
                <span className="text-[12px] font-medium">{s.label}</span>
              </div>
              {active === s.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
          ))}

          <div className="rounded-xl p-3 mt-1"
            style={{ background: "rgba(255,200,0,0.05)", border: "1px solid rgba(255,200,0,0.15)" }}
          >
            <p className="text-[10px]" style={{ color: "rgba(255,200,0,0.6)" }}>
              ⚠ Незнание правил не освобождает от ответственности. Играйте честно.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {section && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.25)" }}
                >
                  {section.tag}
                </span>
              </div>
              <h1 className="text-[24px] font-black text-white mb-1">{section.title}</h1>
              <p className="text-[13px] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>{section.sub}</p>
              <div className="flex flex-col gap-2">
                {section.rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.75)" }}>{rule}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
