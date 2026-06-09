import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GameController, TelegramLogo, YoutubeLogo } from "@phosphor-icons/react";

const card = { background: "#0d0d0d", borderRadius: 16 };
const innerCard = { background: "#111", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" };

const sectionMeta = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.3)",
  marginBottom: 4,
};

const STEPS = [
  { label: "ШАГ 1", title: "Скачайте лаунчер",  desc: "Загрузите наш лаунчер с официального сайта и установите его на своё устройство." },
  { label: "ШАГ 2", title: "Создайте аккаунт",  desc: "Зарегистрируйтесь или войдите в существующий аккаунт через лаунчер." },
  { label: "ШАГ 3", title: "Выберите режим",    desc: "Выберите понравившийся игровой мир и подключитесь к серверу." },
  { label: "ШАГ 4", title: "Начните играть",    desc: "Погрузитесь в игровой процесс и станьте частью нашего комьюнити." },
];

export default function HomePage() {
  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ ...card, borderRadius: 20, padding: "72px 48px", textAlign: "center", marginBottom: 20 }}
        >
          <div style={{ fontSize: 68, fontWeight: 900, letterSpacing: "0.03em", lineHeight: 1, marginBottom: 10 }}>
            SB GAMES
          </div>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.1)", marginBottom: 18 }}>
            КОМПЛЕКС СЕРВЕРОВ
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, maxWidth: 460, margin: "0 auto 32px" }}>
            Один аккаунт, быстрый старт и разные режимы.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/download" style={{
              background: "#fff", color: "#000", padding: "14px 30px", borderRadius: 12,
              fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", textDecoration: "none",
            }}>
              СКАЧАТЬ ЛАУНЧЕР ↓
            </Link>
            <Link to="/howtoplay" style={{
              background: "#1a1a1a", color: "#fff", padding: "14px 30px", borderRadius: 12,
              fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              КАК НАЧАТЬ ИГРАТЬ &gt;
            </Link>
          </div>
        </motion.div>

        {/* ТЕКУЩИЕ РЕЖИМЫ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          style={{ ...card, padding: "24px 24px 20px", marginBottom: 20 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={sectionMeta}>Игровые миры</div>
              <div style={{ fontSize: 17, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ТЕКУЩИЕ РЕЖИМЫ
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a855f7", fontSize: 11, fontWeight: 700 }}>
              <span>●</span> 1 СЕРВЕР ОНЛАЙН
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ ...innerCard, padding: "18px 16px" }}>
              <GameController size={26} color="#a855f7" weight="duotone" style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.04em" }}>STARWARS</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>Игровой мир</div>
            </div>
          </div>
        </motion.div>

        {/* КОМЬЮНИТИ + НОВОСТИ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.55fr", gap: 20, marginBottom: 20 }}>

          {/* КОМЬЮНИТИ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            style={{ ...card, padding: "24px 22px", display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <div style={sectionMeta}>Соцсети</div>
              <div style={{ fontSize: 17, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                КОМЬЮНИТИ
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>
                СТАНОВИСЬ ЧАСТЬЮ КОМАНДЫ
              </div>
            </div>

            <a href="https://t.me/sb7games" target="_blank" rel="noreferrer" style={{
              ...innerCard, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
              textDecoration: "none", color: "#fff",
            }}>
              <TelegramLogo size={24} color="#29b6f6" weight="fill" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Telegram</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Новости и обновления</div>
              </div>
            </a>

            <a href="https://youtube.com/@sbgames" target="_blank" rel="noreferrer" style={{
              ...innerCard, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
              textDecoration: "none", color: "#fff",
            }}>
              <YoutubeLogo size={24} color="#f44336" weight="fill" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>YouTube</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Видео и трансляции</div>
              </div>
            </a>
          </motion.div>

          {/* НОВОСТИ И ОБНОВЛЕНИЯ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
            style={{ ...card, padding: "28px 26px", display: "flex", flexDirection: "column" }}
          >
            <div style={{
              display: "inline-block", background: "rgba(59,130,246,0.14)", color: "#3b82f6",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              borderRadius: 20, padding: "4px 12px", marginBottom: 14, width: "fit-content",
            }}>
              ОБНОВЛЕНИЯ
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.03em", marginBottom: 10 }}>
              НОВОСТИ И ОБНОВЛЕНИЯ
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.65, marginBottom: 24, flex: 1 }}>
              Следите за последними новостями и обновлениями серверов SB Games. Мы регулярно добавляем новый контент и улучшаем игровой опыт.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link to="/news" style={{
                background: "#3b82f6", color: "#fff", padding: "11px 20px", borderRadius: 10,
                fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textDecoration: "none",
              }}>
                ЧИТАТЬ НОВОСТИ
              </Link>
              <a href="https://discord.gg/sbgames" target="_blank" rel="noreferrer" style={{
                background: "#1a1a1a", color: "#fff", padding: "11px 20px", borderRadius: 10,
                fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                НАШ ДИСКОРД
              </a>
            </div>
          </motion.div>
        </div>

        {/* КАК НАЧАТЬ ИГРАТЬ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ ...card, padding: "40px 32px", marginBottom: 20 }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.03em", marginBottom: 10 }}>
              КАК НАЧАТЬ ИГРАТЬ
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Начни своё путешествие в мире SB Games всего за несколько простых шагов.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/download" style={{
                background: "#fff", color: "#000", padding: "12px 26px", borderRadius: 10,
                fontWeight: 700, fontSize: 13, textDecoration: "none",
              }}>
                Скачать лаунчер
              </Link>
              <Link to="/topup" style={{
                background: "#1a1a1a", color: "#fff", padding: "12px 26px", borderRadius: 10,
                fontWeight: 700, fontSize: 13, textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                Пополнить баланс
              </Link>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {STEPS.map((s) => (
              <div key={s.label} style={{ ...innerCard, padding: "18px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#3b82f6", textTransform: "uppercase", marginBottom: 10 }}>
                  {s.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <footer style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 12, paddingTop: 8 }}>
          © 2026 SBGames. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
