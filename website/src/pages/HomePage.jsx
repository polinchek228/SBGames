import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { DownloadSimple, ArrowRight, TelegramLogo, YoutubeLogo, ArrowUpRight } from "@phosphor-icons/react";

const SERVERS = [
  { id: "starwars", name: "STARWARS", sub: "Звёздные Войны", bg: "linear-gradient(160deg,#0a0a1f,#000)", accent: "#818cf8" },
];

const STEPS = [
  { n: 1, title: "Зарегистрируйтесь",  desc: "Создайте аккаунт SBGames и привяжите Telegram." },
  { n: 2, title: "Скачайте лаунчер",   desc: "Установите клиент и получите доступ к серверам.", link: true },
  { n: 3, title: "Выберите сервер",    desc: "StarWars — подберите мир под себя." },
  { n: 4, title: "Заходите и играйте", desc: "Запускайтесь, подключайтесь и начинайте игру сразу." },
];

export default function HomePage() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pb-20">

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center text-center py-20">
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden"
          style={{ background: "rgba(12,12,12,0.9)", border: "1px solid rgba(255,255,255,0.07)", padding: "72px 48px" }}
        >
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-[64px] font-black leading-none tracking-tight text-white mb-2"
          >
            SB GAMES
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-[40px] font-black tracking-widest uppercase mb-4"
            style={{ color: "rgba(255,255,255,0.18)" }}
          >
            Комплекс серверов
          </motion.p>
          <p className="text-[15px] mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
            Один аккаунт, быстрый старт и разные режимы.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="https://github.com/polinchek228/SBGames/releases/latest"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] bg-white text-black hover:bg-white/90 transition-colors"
            >
              <DownloadSimple size={16} weight="bold" />
              Скачать лаунчер
            </a>
            <Link to="/rules"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] transition-colors"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}
            >
              Как начать играть
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Серверы ── */}
      <section className="mb-16">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-[18px] font-black tracking-widest uppercase text-white">Текущие режимы</h2>
            <p className="text-[11px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Ваш выбор — ваша история</p>
          </div>
          <span className="text-[11px]" style={{ color: "#818cf8" }}>● 1 сервер онлайн</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SERVERS.map(s => (
            <motion.div key={s.id}
              whileHover={{ scale: 1.02 }}
              className="rounded-2xl overflow-hidden relative"
              style={{ background: s.bg, border: "1px solid rgba(255,255,255,0.07)", height: 140 }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute top-3 right-3">
                <ArrowUpRight size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${s.accent}20`, border: `1px solid ${s.accent}30` }}
                >
                  <div className="w-3 h-3 rounded-sm" style={{ background: s.accent }} />
                </div>
                <p className="text-[13px] font-black text-white">{s.name}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Как начать ── */}
      <section className="mb-16">
        <h2 className="text-[18px] font-black tracking-widest uppercase text-white mb-1">Как начать играть</h2>
        <p className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.3)" }}>
          Простой путь: зарегистрируйтесь, скачайте лаунчер, выберите сервер и входите.
        </p>
        <div className="flex items-center gap-3 mb-6">
          <a href="https://github.com/polinchek228/SBGames/releases/latest"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[12px] bg-white text-black hover:bg-white/90 transition-colors"
          >
            <DownloadSimple size={14} weight="bold" />
            Скачать лаунчер
          </a>
          <Link to="/topup"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[12px] transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}
          >
            Пополнить баланс
            <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {STEPS.map(s => (
            <div key={s.n} className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                ШАГ {s.n} ○
              </p>
              <p className="text-[13px] font-bold text-white mb-1">{s.title}</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Комьюнити + Новости ── */}
      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="text-[18px] font-black tracking-widest uppercase text-white mb-1">Комьюнити</h2>
          <p className="text-[10px] tracking-widest uppercase mb-4" style={{ color: "rgba(255,255,255,0.2)" }}>Становись частью команды</p>
          {[
            { icon: TelegramLogo, label: "Telegram", href: "https://t.me/sb7games", color: "#2CA5E0" },
          ].map(({ icon: Icon, label, href, color }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-2 transition-colors group"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Icon size={18} style={{ color }} />
              <span className="text-[13px] font-semibold text-white/70 group-hover:text-white transition-colors">{label}</span>
              <ArrowUpRight size={12} className="ml-auto" style={{ color: "rgba(255,255,255,0.2)" }} />
            </a>
          ))}
        </div>

        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg mb-4 inline-block"
            style={{ background: "#2563EB20", color: "#60a5fa", border: "1px solid #2563EB30" }}
          >
            Обновления
          </span>
          <h2 className="text-[24px] font-black text-white leading-tight mb-2">Новости и<br/>обновления</h2>
          <p className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Следи за проектом в соцсетях. Там мы выкладываем анонсы ивентов.
          </p>
          <div className="flex gap-3">
            <a href="https://t.me/sb7games" target="_blank" rel="noreferrer"
              className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              Читать новости
            </a>
          </div>
        </div>
      </section>

      <footer className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
        © 2026 SBGames. All rights reserved.
      </footer>
    </main>
  );
}
