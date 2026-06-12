import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle } from "@phosphor-icons/react";

const card = { background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" };

const STEPS = [
  { n: "ШАГ 1", title: "Зарегистрируйтесь", desc: "Создайте аккаунт SBGames и привяжите Telegram.", action: null },
  { n: "ШАГ 2", title: "Скачайте лаунчер",  desc: "Установите клиент и получите доступ к серверам.", action: { label: "Скачать лаунчер ↓", to: "/download" } },
  { n: "ШАГ 3", title: "Выберите сервер",   desc: "StarWars — подберите мир под себя.", action: null },
  { n: "ШАГ 4", title: "Заходите и играйте", desc: "Запускайте, подключайтесь и начинайте игру сразу.", action: null },
];

export default function HowToPlayPage() {
  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 48px" }}>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 36 }}
        >
          <h1 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "0.01em", marginBottom: 14 }}>
            Как начать играть
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, lineHeight: 1.6, maxWidth: 560, marginBottom: 24 }}>
            Простой путь: зарегистрируйтесь, скачайте лаунчер, выберите сервер и входите.
            Всё остальное мы сделали за вас.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/download" style={{
              background: "#fff", color: "#000", padding: "13px 26px", borderRadius: 12,
              fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}>
              Скачать лаунчер ↓
            </Link>
            <Link to="/topup" style={{
              background: "rgba(255,255,255,0.05)", color: "#fff", padding: "13px 26px", borderRadius: 12,
              fontWeight: 700, fontSize: 13, textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              Пополнить баланс ↗
            </Link>
          </div>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 64 }}>
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.06 * i }}
              style={{ ...card, padding: "20px 18px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                  {s.n}
                </span>
                <CheckCircle size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>{s.desc}</div>
              {s.action && (
                <Link to={s.action.to} style={{
                  display: "inline-block", marginTop: 12, color: "#3b82f6",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}>
                  {s.action.label}
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        <footer style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 12 }}>
          © 2026 SBGames. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
