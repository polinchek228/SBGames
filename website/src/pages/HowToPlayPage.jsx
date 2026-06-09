import React from "react";
import { Link } from "react-router-dom";
import { DownloadSimple, CheckCircle } from "@phosphor-icons/react";

const STEPS = [
  {
    n: "01", title: "Зарегистрируйтесь",
    desc: "Создайте аккаунт SBGames и привяжите Telegram. Авторизация происходит через бота @sbgamessupport_bot — безопасно и быстро.",
    action: null,
  },
  {
    n: "02", title: "Скачайте лаунчер",
    desc: "Установите клиент на Windows, macOS или Linux. Лаунчер автоматически подтянет нужные файлы игры.",
    action: { label: "Скачать лаунчер", to: "/download" },
  },
  {
    n: "03", title: "Войдите в лаунчер",
    desc: "Откройте лаунчер и нажмите 'Войти через Telegram'. Откроется бот — нажмите СТАРТ. Придумайте игровой ник.",
    action: null,
  },
  {
    n: "04", title: "Выберите сервер",
    desc: "В разделе 'Играть' выберите StarWars. Нажмите кнопку ИГРАТЬ — лаунчер запустит Minecraft с нужными настройками.",
    action: null,
  },
  {
    n: "05", title: "Заходите и играйте",
    desc: "После запуска вы автоматически попадёте на сервер. Исследуйте миры, сражайтесь и развивайтесь!",
    action: null,
  },
];

export default function HowToPlayPage() {
  return (
    <main className="relative z-10 max-w-3xl mx-auto px-4 pb-16">
      <div className="text-center mb-10">
        <h1 className="text-[32px] font-black text-white mb-2">Как начать играть</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Простой путь: зарегистрируйтесь, скачайте лаунчер, выберите сервер и входите.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <div key={step.n} className="rounded-2xl p-6 flex gap-5"
            style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <div className="flex-shrink-0">
              <span className="text-[28px] font-black tabular-nums" style={{ color: "rgba(255,255,255,0.08)" }}>
                {step.n}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-bold text-white mb-2">{step.title}</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                {step.desc}
              </p>
              {step.action && (
                <Link to={step.action.to}
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  <DownloadSimple size={13} weight="bold" />
                  {step.action.label}
                </Link>
              )}
            </div>
            <div className="flex-shrink-0 mt-1">
              <CheckCircle size={18} style={{ color: i < 1 ? "#4ade80" : "rgba(255,255,255,0.1)" }} weight="fill" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl p-5 flex items-center justify-between"
        style={{ background: "rgba(37,99,235,0.1)" }}
      >
        <div>
          <p className="text-[14px] font-bold text-white">Готов начать?</p>
          <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Скачай лаунчер прямо сейчас</p>
        </div>
        <Link to="/download"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px] text-white bg-blue-600 hover:bg-blue-500 transition-colors"
        >
          <DownloadSimple size={14} weight="bold" />
          Скачать
        </Link>
      </div>
    </main>
  );
}
