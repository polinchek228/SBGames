import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../lib/api.js";
import { API_URL } from "../lib/api.js";
import { motion } from "framer-motion";
import AffiliatePage from "./AffiliatePage.jsx";
import {
  TrendUp, CalendarDots, Globe, Gift, ShieldCheck, Headset,
  ChartBarHorizontal, UsersThree, CurrencyDollar, Trophy,
  ArrowRight, CaretDown, CaretUp, Check, Star, Coin,
} from "@phosphor-icons/react";

const card = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 20,
};
const sectionMeta = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
  textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 4,
};

const DEFAULT_LEVELS = [
  { level: 1, percent: 30, players: "0–14",   color: "#3b82f6", accentTop: "rgba(59,130,246,0.15)" },
  { level: 2, percent: 35, players: "15–49",  color: "#6366f1", accentTop: "rgba(99,102,241,0.12)" },
  { level: 3, percent: 40, players: "50–99",  color: "#eab308", accentTop: "rgba(234,179,8,0.15)" },
  { level: 4, percent: 45, players: "100–199", color: "#64748b", accentTop: "rgba(100,116,139,0.12)" },
  { level: 5, percent: 50, players: "200–399", color: "#06b6d4", accentTop: "rgba(6,182,212,0.15)" },
  { level: 6, percent: 55, players: "400–699", color: "#a855f7", accentTop: "rgba(168,85,247,0.15)" },
  { level: 7, percent: 60, players: "700+",    color: "#ef4444", accentTop: "rgba(239,68,68,0.15)" },
];

const BENEFITS = [
  { icon: TrendUp,           title: "До 60% от доната каждого приведённого игрока — пожизненно", desc: "Вы получаете процент от каждого доната, который делает привлечённый вами игрок — пока он играет на наших серверах." },
  { icon: CalendarDots,      title: "Еженедельные выплаты без задержек", desc: "Заработанное — на ваш кошелёк каждую неделю. Без задержек и минимальных порогов вывода." },
  { icon: ShieldCheck,       title: "Без скрытых условий", desc: "Честная модель: вы получаете ровно тот процент, который заработали. Никакого мелкого шрифта." },
  { icon: CurrencyDollar,    title: "Пожизненные начисления, пока игрок активен", desc: "1 раз пригласи и навсегда получи долю от проекта." },
  { icon: Trophy,            title: "Качественный продукт", desc: "Топовые Minecraft-серверы с уникальными режимами, стабильным онлайном и лояльным комьюнити." },
  { icon: Gift,              title: "Бонусы, техника и путешествия", desc: "Регулярные розыгрыши призов: техника, деньги и поездки." },
];

const STEPS = [
  { num: "01", title: "Зарегистрируйтесь", desc: "Создайте аккаунт в партнёрском кабинете за 2 минуты." },
  { num: "02", title: "Получите ссылку", desc: "Уникальная реферальная ссылка и партнёрский кабинет — сразу после регистрации." },
  { num: "03", title: "Привлекайте игроков", desc: "Делитесь ссылкой в соцсетях, стримах, Discord и где угодно." },
  { num: "04", title: "Получайте до 60%", desc: "До 60% от прибыли S&B Games с каждого активного пользователя." },
];

const FAQ = [
  { q: "Сколько я могу зарабатывать?", a: "До 60% от доната каждого привлечённого игрока — пожизненно, пока он играет на наших серверах." },
  { q: "Сколько действует моя ссылка?", a: "Пожизненно. Вы будете получать выплаты с каждого доната приведённого игрока, пока он активен." },
  { q: "Какие выплаты доступны?", a: "Выплаты на карту, криптокошелёк или электронные кошельки. Еженедельно, без задержек." },
  { q: "Нужно ли самому играть, чтобы участвовать?", a: "Нет. Вы можете просто привлекать аудиторию — мы сделаем остальное: серверы, поддержку, удержание." },
  { q: "Из каких стран можно привлекать игроков?", a: "Из любой. S&B Games открыты для игроков со всего мира, без географических ограничений." },
];

function BenefitCard({ icon: Icon, title, desc }) {
  return (
    <div style={{ ...card, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} color="#3b82f6" weight="duotone" />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

function LevelCard({ level, percent, players, color, accentTop }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16,
      background: "#111118", minHeight: 180, padding: "22px 20px",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      {/* Top accent gradient */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 80,
        background: `linear-gradient(180deg, ${accentTop || color + "18"}, transparent)`,
        pointerEvents: "none",
      }} />
      {/* Watermark triangle logo */}
      <div style={{
        position: "absolute", top: 10, right: 12, opacity: 0.06,
        width: 90, height: 90,
      }}>
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M50 10 L90 80 L10 80 Z" stroke={color} strokeWidth="3" fill="none" />
          <path d="M50 28 L75 72 L25 72 Z" stroke={color} strokeWidth="2" fill="none" />
        </svg>
      </div>
      {/* Level label */}
      <div style={{ position: "relative", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "0.01em" }}>
        Level {level}
      </div>
      {/* Stats */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Coin size={15} color="rgba(255,255,255,0.5)" weight="duotone" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{percent}%</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Комиссия</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <UsersThree size={15} color="rgba(255,255,255,0.5)" weight="duotone" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{players}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Игроков</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...card, padding: "18px 22px", cursor: "pointer" }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{q}</span>
        {open ? <CaretUp size={16} color="rgba(255,255,255,0.4)" /> : <CaretDown size={16} color="rgba(255,255,255,0.4)" />}
      </div>
      {open && (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginTop: 10 }}>{a}</p>
      )}
    </div>
  );
}

export default function ReferralPage() {
  const navigate = useNavigate();
  const currentUser = getUser();
  const [levels, setLevels] = useState(DEFAULT_LEVELS);

  useEffect(() => {
    fetch(`${API_URL}/affiliate/levels`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.levels) setLevels(d.levels); })
      .catch(() => {});
  }, []);

  // Logged-in users see the partner dashboard directly on this page.
  if (currentUser) {
    return <AffiliatePage user={currentUser} />;
  }

  const handleCta = () => {
    navigate("/login", { state: { from: "/affiliate", message: "Войдите или зарегистрируйтесь, чтобы стать партнёром" } });
  };

  const ctaBtnStyle = {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "#3b82f6", color: "#fff", padding: "14px 32px", borderRadius: 12,
    fontWeight: 800, fontSize: 13, letterSpacing: "0.04em", textDecoration: "none", textTransform: "uppercase",
    border: "none", cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 64px" }}>

        {/* B1 — Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ ...card, padding: "60px 48px", textAlign: "center", marginBottom: 32, position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(59,130,246,0.08), transparent 70%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{
              display: "inline-block", background: "rgba(59,130,246,0.12)", color: "#3b82f6",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              borderRadius: 20, padding: "5px 14px", marginBottom: 20,
            }}>
              ПАРТНЁРСКАЯ ПРОГРАММА
            </div>
            <h1 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 16, textTransform: "uppercase" }}>
              Зарабатывайте до {levels[levels.length - 1]?.percent || 60}% от доната<br />каждого приведённого игрока — <span style={{ color: "#3b82f6" }}>пожизненно</span>
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", maxWidth: 600, margin: "0 auto 30px", lineHeight: 1.6 }}>
              S&B Games — сеть игровых серверов Minecraft, которая объединяет тысячи игроков по всему миру.
              Вы получаете до {levels[levels.length - 1]?.percent || 60}% от доната привлечённого игрока — пока он остаётся активном на наших серверах.
            </p>
            <button onClick={handleCta} style={ctaBtnStyle}>
              Начать зарабатывать <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </motion.div>

        {/* B2 — О программе */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
          style={{ ...card, padding: "40px 36px", marginBottom: 20 }}
        >
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>О программе</div>
            <div style={{ ...sectionMeta }}>Партнёрская программа S&B Games</div>
          </div>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 700 }}>
            S&B Games — комплекс игровых серверов Minecraft, где тысячи игроков покупают привилегии, кейсы и донат-валюту.
            Ваша задача — приводить таких игроков. Мы предлагаем <strong style={{ color: "#fff" }}>самые высокие партнёрские условия</strong> в индустрии:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 20 }}>
            {[
              { icon: TrendUp, text: "До 60% от доната", color: "#3b82f6" },
              { icon: CalendarDots, text: "Еженедельные выплаты", color: "#22c55e" },
              { icon: CurrencyDollar, text: "Пожизненные начисления", color: "#f59e0b" },
              { icon: ShieldCheck, text: "Без скрытых условий", color: "#a855f7" },
            ].map(({ icon: I, text, color }) => (
              <div key={text} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <Check size={16} color={color} weight="bold" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* B3 — Почему выгодно */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
          style={{ marginBottom: 20 }}
        >
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>Почему это выгодно?</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {BENEFITS.map(b => <BenefitCard key={b.title} {...b} />)}
          </div>
        </motion.div>

        {/* B4 — Как начать */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
          style={{ ...card, padding: "40px 36px", marginBottom: 20 }}
        >
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>Как начать зарабатывать?</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} style={{ padding: "20px 18px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{
                  fontSize: 32, fontWeight: 900, color: "#3b82f6", opacity: 0.3, marginBottom: 12,
                  lineHeight: 1,
                }}>{num}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* B5 — Уровни / Сколько зарабатываете */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          style={{ marginBottom: 20 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>Сколько вы зарабатываете?</div>
              <div style={{ ...sectionMeta }}>Чем больше игроков — тем выше процент</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {levels.slice(0, 4).map(l => <LevelCard key={l.level} {...l} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 14 }}>
            {levels.slice(4).map(l => <LevelCard key={l.level} {...l} />)}
          </div>
        </motion.div>

        {/* B6 — FAQ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.24 }}
          style={{ marginBottom: 20 }}
        >
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em" }}>Часто задаваемые вопросы</div>
            <div style={{ ...sectionMeta }}>Всё, что нужно знать перед стартом</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ.map(f => <FAQItem key={f.q} {...f} />)}
          </div>
        </motion.div>

        {/* B7 — CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.28 }}
          style={{
            ...card, padding: "48px 40px", textAlign: "center", position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(59,130,246,0.1), transparent 70%)" }} />
          <div style={{ position: "relative" }}>
            <h2 style={{ fontSize: 30, fontWeight: 900, textTransform: "uppercase", marginBottom: 10 }}>Готовы начать зарабатывать?</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>
              Присоединяйтесь к партнёрской программе S&B Games и получайте до 60% с доната
            </p>
            <button onClick={handleCta} style={ctaBtnStyle}>
              Присоединиться <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </motion.div>

      </div>
    </main>
  );
}
