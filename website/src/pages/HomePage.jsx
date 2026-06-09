import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { DownloadSimple, ArrowRight, TelegramLogo, ArrowUpRight } from "@phosphor-icons/react";

const SERVERS = [
  { id: "starwars", name: "STARWARS", sub: "Звёздные Войны", bg: "linear-gradient(160deg,#0a0a1f,#000)", accent: "#818cf8" },
];

export default function HomePage() {
  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 pb-20">

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center text-center py-16">
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden"
          style={{ background: "rgba(10,10,10,0.95)", padding: "72px 48px" }}
        >
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-[64px] font-black leading-none tracking-tight text-white mb-2"
          >
            SB GAMES
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-[40px] font-black tracking-widest uppercase mb-4"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            Комплекс серверов
          </motion.p>
          <p className="text-[15px] mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
            Один аккаунт, быстрый старт и разные режимы.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/download"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] bg-white text-black hover:bg-white/90 transition-colors"
            >
              <DownloadSimple size={16} weight="bold" />
              Скачать лаунчер
            </Link>
            <Link to="/howtoplay"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)" }}
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
            <motion.div key={s.id} whileHover={{ scale: 1.02 }}
              className="rounded-2xl overflow-hidden relative"
              style={{ background: s.bg, height: 140 }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute top-3 right-3">
                <ArrowUpRight size={14} style={{ color: "rgba(255,255,255,0.25)" }} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${s.accent}20` }}
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

      {/* ── Комьюнити + Новости ── */}
      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl p-6" style={{ background: "rgba(10,10,10,0.95)" }}>
          <h2 className="text-[18px] font-black tracking-widest uppercase text-white mb-1">Комьюнити</h2>
          <p className="text-[10px] tracking-widest uppercase mb-4" style={{ color: "rgba(255,255,255,0.2)" }}>Становись частью команды</p>
          <a href="https://t.me/sb7games" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-2 transition-colors group"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <TelegramLogo size={18} style={{ color: "#2CA5E0" }} />
            <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>Telegram</span>
            <ArrowUpRight size={12} className="ml-auto" style={{ color: "rgba(255,255,255,0.15)" }} />
          </a>
        </div>

        <div className="rounded-2xl p-6" style={{ background: "rgba(10,10,10,0.95)" }}>
          <span className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-lg mb-4 inline-block"
            style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa" }}
          >
            Обновления
          </span>
          <h2 className="text-[24px] font-black text-white leading-tight mb-2">Новости и<br/>обновления</h2>
          <p className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
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

      <footer className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.15)" }}>
        © 2026 SBGames. All rights reserved.
      </footer>
    </main>
  );
}
