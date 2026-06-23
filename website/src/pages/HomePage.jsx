import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TelegramLogo, YoutubeLogo, TiktokLogo,
  ArrowUpRight, CaretRight, UsersThree,
} from "@phosphor-icons/react";

const card = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 20,
};
const innerCard = { background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" };

const sectionMeta = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.3)",
  marginTop: 4,
};

const SOCIALS = [
  { label: "TELEGRAM", icon: TelegramLogo, color: "#29b6f6", href: "https://t.me/sb7games" },
  { label: "YOUTUBE",  icon: YoutubeLogo,  color: "#f44336", href: "https://www.youtube.com/@sb_games7" },
  { label: "TIKTOK",   icon: TiktokLogo,   color: "#fff",    href: "https://www.tiktok.com/@sb7games" },
];

export default function HomePage() {
  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* HERO */}
        <div
          style={{
            borderRadius: 24, minHeight: "calc(100vh - 116px)", padding: "48px 48px",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", marginBottom: 40, position: "relative", overflow: "hidden",
            backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center",
          }}
        >
          {/* dark overlay so text reads over photo */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5), rgba(0,0,0,0.85))", borderRadius: 24 }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "clamp(32px, 8vw, 64px)", fontWeight: 900, letterSpacing: "0.01em", lineHeight: 1, marginBottom: 4 }}>
            SB GAMES
          </div>
          <div style={{ fontSize: "clamp(28px, 7vw, 60px)", fontWeight: 900, lineHeight: 0.95, textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 22 }}>
            КОМПЛЕКС<br />СЕРВЕРОВ
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: 700, maxWidth: 460, margin: "0 auto 30px" }}>
            Один аккаунт, быстрый старт и разные режимы.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/download" style={{
              background: "#fff", color: "#000", padding: "14px 30px", borderRadius: 12,
              fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 8, textTransform: "uppercase",
            }}>
              Скачать лаунчер ↓
            </Link>
            <Link to="/howtoplay" style={{
              background: "rgba(255,255,255,0.05)", color: "#fff", padding: "14px 30px", borderRadius: 12,
              fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.08)", textTransform: "uppercase",
            }}>
              Как начать играть &gt;
            </Link>
          </div>
          </div>{/* /z-index wrapper */}
        </div>

        {/* ТЕКУЩИЕ РЕЖИМЫ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                ТЕКУЩИЕ РЕЖИМЫ
              </div>
              <div style={{ ...sectionMeta }}>Ваш выбор — ваша история</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 6 }}>
              <span style={{ color: "#3b82f6", fontSize: 9 }}>●</span> 5 серверов
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { id: "starwars",     name: "STARWARS",   color: "#a855f7", image: "https://games.sb-capital.group/servers/starwars.jpg",   sub: "Звёздные Войны" },
              { id: "minigames",    name: "MINIGAMES",  color: "#22c55e", image: "https://games.sb-capital.group/servers/minigames.jpg", sub: "Мини-игры" },
              { id: "gta",          name: "GTA",        color: "#ef4444", image: "https://games.sb-capital.group/servers/gta.jpg",       sub: "Grand Theft Auto RP" },
              { id: "vanilla_plus", name: "VANILA+",    color: "#06b6d4", image: "https://games.sb-capital.group/servers/vanilla.jpg",   sub: "Ванильный+" },
              { id: "anarchy",      name: "АНАРХИЯ",    color: "#f59e0b", image: "https://games.sb-capital.group/servers/anarchy.jpg",   sub: "Без правил" },
            ].map(({ id, name, color, image, sub }) => (
              <Link key={id} to="/download" style={{
                position: "relative", height: 200, borderRadius: 20, overflow: "hidden",
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
                textDecoration: "none", color: "#fff",
              }}>
                {/* hero image */}
                <img src={image} alt={name} loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.45)" }}
                />
                {/* gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${color}30 0%, transparent 60%)` }} />
                {/* content */}
                <div style={{ position: "relative", padding: "20px 22px" }}>
                  <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.02em", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* КОМЬЮНИТИ + НОВОСТИ */}
        <div style={{ display: "grid", gridTemplateColumns: window.innerWidth > 768 ? "1fr 1.55fr" : "1fr", gap: 20, marginBottom: 20 }}>

          {/* КОМЬЮНИТИ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                КОМЬЮНИТИ
              </div>
              <div style={{ ...sectionMeta }}>Становись частью команды</div>
            </div>

            {SOCIALS.map(({ label, icon: Icon, color, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" style={{
                ...card, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
                textDecoration: "none", color: "#fff",
              }}>
                <Icon size={22} color={color} weight="fill" />
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", flex: 1 }}>{label}</span>
                <CaretRight size={14} style={{ color: "rgba(255,255,255,0.25)" }} />
              </a>
            ))}
          </motion.div>

          {/* НОВОСТИ И ОБНОВЛЕНИЯ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
            style={{ ...card, padding: "30px 30px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
          >
            <UsersThree size={120} weight="duotone" style={{ position: "absolute", top: 16, right: 10, color: "rgba(255,255,255,0.03)" }} />
            <div style={{
              display: "inline-block", background: "rgba(59,130,246,0.14)", color: "#3b82f6",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              borderRadius: 20, padding: "5px 13px", marginBottom: 16, width: "fit-content",
            }}>
              ОБНОВЛЕНИЯ
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, letterSpacing: "0.01em", marginBottom: 14, textTransform: "uppercase" }}>
              НОВОСТИ И<br />ОБНОВЛЕНИЯ
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.65, marginBottom: 26, flex: 1, maxWidth: 420 }}>
              Следи за проектом в соцсетях. Там мы выкладываем анонсы ивентов.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <a href="https://t.me/sb7games" target="_blank" rel="noreferrer" style={{
                background: "#3b82f6", color: "#fff", padding: "12px 22px", borderRadius: 10,
                fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textDecoration: "none", textTransform: "uppercase",
              }}>
                Читать новости
              </a>
              <a href="https://t.me/sb7games" target="_blank" rel="noreferrer" style={{
                background: "rgba(255,255,255,0.05)", color: "#fff", padding: "12px 22px", borderRadius: 10,
                fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.08)", textTransform: "uppercase",
              }}>
                НАШ ТЕЛЕГРАМ
              </a>
            </div>
          </motion.div>
        </div>

        <footer style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 12, paddingTop: 24 }}>
          © 2026 SBGames. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
