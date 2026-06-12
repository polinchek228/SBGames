import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, DeviceMobile, CurrencyEth, Check } from "@phosphor-icons/react";
import { API_URL, getToken } from "../lib/api.js";

const AMOUNTS = [100, 300, 500, 1000, 2000, 5000];
// 1 SBT = 1 ₽

const Coin = ({ size = 14 }) => (
  <img src="/money.png" alt="SBT" style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    objectFit: "cover", display: "inline-block",
  }} />
);

const METHODS = [
  { id: "card_ru", icon: CreditCard,   label: "Карта (RU)",        sub: "Карта МИР" },
  { id: "card_ua", icon: CreditCard,   label: "Карта Master/Visa", sub: "Visa/Mastercard" },
  { id: "crypto",  icon: CurrencyEth,  label: "Криптовалюта", sub: "USDT, BTC, ETH" },
  { id: "sbp",     icon: DeviceMobile, label: "СБП",          sub: "Быстрые платежи" },
];

export default function TopupPage({ user }) {
  const [amount,  setAmount]  = useState(5000);
  const [custom,  setCustom]  = useState("");
  const [method,  setMethod]  = useState("crypto");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const finalAmount = custom ? (parseInt(custom) || 0) : amount;
  const methodLabel = METHODS.find(m => m.id === method)?.label ?? "—";

  const handlePay = async () => {
    if (!finalAmount || finalAmount < 50) return;
    setError(""); setResult(null); setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ amount: finalAmount, method }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.configured === false) {
        setError("CryptoBot is not configured");
      } else {
        setResult({ type: "requisites", amount: finalAmount });
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "12px 24px 64px" }}>
      <div style={{ background: "#0a0a0a", borderRadius: 28, padding: "40px 48px 48px", border: "1px solid rgba(255,255,255,0.04)" }}>

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.01em" }}>Пополнение баланса</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
            Выбери сумму в SBT, способ оплаты и подтверди платёж. Баланс обновится автоматически.
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            padding: "8px 18px", borderRadius: 10,
          }}>
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Текущий баланс:</span>
            <span style={{ fontWeight: 800 }}>{(user?.balance ?? 0).toLocaleString("ru-RU")}</span>
            <Coin size={14} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* AMOUNTS */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
                Сумма пополнения (SBT)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
                {AMOUNTS.map(a => {
                  const sel = amount === a && !custom;
                  return (
                    <button key={a} onClick={() => { setAmount(a); setCustom(""); }}
                      style={{
                        position: "relative",
                        background: sel ? "#2563eb" : "rgba(255,255,255,0.03)",
                        border: sel ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10, padding: "14px 12px 10px",
                        cursor: "pointer", transition: "all 0.12s",
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                      }}
                    >
                      {sel && (
                        <Check size={12} weight="bold" style={{ position: "absolute", top: 8, right: 9, color: "rgba(255,255,255,0.8)" }} />
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1 }}>
                        {a.toLocaleString()}
                        <Coin size={13} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>{a} ₽</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="number" min={1} placeholder="Другая сумма в SBT"
                  value={custom}
                  onChange={e => { setCustom(e.target.value); setAmount(0); }}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10, padding: "13px 48px 13px 16px", color: "rgba(255,255,255,0.5)",
                    fontSize: 13, outline: "none",
                  }}
                />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>SBT</span>
              </div>
            </div>

            {/* METHODS */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10, marginTop: 6 }}>
                Способ оплаты
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {METHODS.map(({ id, icon: Icon, label, sub }) => {
                  const sel = method === id;
                  return (
                    <button key={id} onClick={() => setMethod(id)}
                      style={{
                        background: sel ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.03)",
                        border: sel ? "1px solid rgba(59,130,246,0.6)" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12, padding: "16px 14px",
                        display: "flex", flexDirection: "column", gap: 8, textAlign: "left",
                        cursor: "pointer", transition: "all 0.12s",
                      }}
                    >
                      <Icon size={18} style={{ color: sel ? "#60a5fa" : "rgba(255,255,255,0.45)" }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", lineHeight: 1.4 }}>{sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: ИТОГ */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              background: "linear-gradient(160deg, rgba(37,99,235,0.10), rgba(255,255,255,0.02) 45%)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              Итого <Coin size={12} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{finalAmount || "—"}</span>
                <Coin size={18} />
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>
                = {finalAmount || "—"} ₽ · курс 1:1
              </div>
              {[
                { label: "Комиссия",      val: "0%" },
                { label: "Способ оплаты", val: methodLabel },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{
                marginTop: 12, padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  Подтверждение через Telegram. Данные платежа не хранятся.
                </span>
              </div>
            </div>

            <AnimatePresence>
              {result?.type === "requisites" && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 9, padding: "11px 12px", fontSize: 12 }}
                >
                  <p style={{ fontWeight: 700, color: "#fff", marginBottom: 5 }}>Реквизиты для оплаты</p>
                  <p style={{ color: "rgba(255,255,255,0.5)" }}>
                    Напишите в <a href="https://t.me/sbgamescbot" style={{ color: "#60a5fa" }}>поддержку</a> с чеком — пополним за 10 мин.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div style={{ background: "rgba(120,20,20,0.5)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, padding: "10px 13px", color: "#fca5a5", fontSize: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!finalAmount || finalAmount < 50 || loading}
              style={{
                background: finalAmount >= 50 ? "linear-gradient(90deg, #2563eb, #7c3aed)" : "#1d3461",
                color: "#fff", border: "none", borderRadius: 12,
                padding: "15px 0", fontWeight: 700, fontSize: 14,
                cursor: !finalAmount || finalAmount < 50 || loading ? "not-allowed" : "pointer",
                opacity: !finalAmount || finalAmount < 50 || loading ? 0.5 : 1,
                transition: "opacity 0.12s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? "Загрузка..." : <>Пополнить&nbsp;{finalAmount || ""} <Coin size={15} /></>}
            </button>
          </motion.div>
        </div>
      </div>
      </div>
    </main>
  );
}
