import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, DeviceMobile, CurrencyEth, ArrowRight } from "@phosphor-icons/react";
import { API_URL, getToken } from "../lib/api.js";

const card = { background: "#0d0d0d", borderRadius: 16 };
const innerCard = { background: "#111", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" };
const metaLabel = { fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 };

const AMOUNTS = [100, 300, 500, 1000, 2000, 5000];
const METHODS = [
  { id: "card_ru", icon: CreditCard,   label: "Карта (RU)",   sub: "ЮKassa, Visa/МИР" },
  { id: "card_ua", icon: CreditCard,   label: "Карта (UA)",   sub: "Monobank, Visa" },
  { id: "crypto",  icon: CurrencyEth,  label: "Криптовалюта", sub: "USDT, BTC, ETH" },
  { id: "sbp",     icon: DeviceMobile, label: "СБП",          sub: "Быстрые платежи" },
];

export default function TopupPage({ user }) {
  const [amount,  setAmount]  = useState(500);
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
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 64px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10 }}>Пополнение баланса</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 14 }}>
            Выберите сумму, способ оплаты и подтвердите платёж.
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, background: "#0d0d0d", padding: "8px 16px", borderRadius: 10 }}>
            <span style={{ color: "rgba(255,255,255,0.45)" }}>Текущий баланс:</span>
            <span>{(user?.balance ?? 0).toLocaleString("ru-RU")}</span>
            <span style={{ color: "#3b82f6", fontSize: 9 }}>●</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, alignItems: "start" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Amount */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ ...card, padding: "22px 20px" }}
            >
              <div style={metaLabel}>Сумма пополнения</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9, marginBottom: 12 }}>
                {AMOUNTS.map(a => (
                  <button key={a} onClick={() => { setAmount(a); setCustom(""); }}
                    style={{
                      background: amount === a && !custom ? "#3b82f6" : "#111",
                      border: amount === a && !custom ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.07)",
                      color: "#fff", borderRadius: 10, padding: "13px 6px",
                      fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "background 0.12s",
                    }}
                  >
                    {a.toLocaleString()}
                    <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 4 }}>СБТ</span>
                  </button>
                ))}
              </div>
              <input
                type="number" min={1} placeholder="Своя сумма..."
                value={custom}
                onChange={e => { setCustom(e.target.value); setAmount(0); }}
                style={{
                  width: "100%", background: "#111",
                  border: custom ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10, padding: "12px 14px", color: "#fff",
                  fontSize: 14, outline: "none", boxSizing: "border-box",
                }}
              />
            </motion.div>

            {/* Method */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 }}
              style={{ ...card, padding: "22px 20px" }}
            >
              <div style={metaLabel}>Способ оплаты</div>
              {method === "crypto" && error && (
                <div style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 9, padding: "10px 13px", color: "#ef4444", fontSize: 12, marginBottom: 12,
                }}>
                  {error}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 9 }}>
                {METHODS.map(({ id, icon: Icon, label, sub }) => (
                  <button key={id} onClick={() => setMethod(id)}
                    style={{
                      background: "#111", textAlign: "left", cursor: "pointer",
                      border: method === id ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: "15px 13px",
                      display: "flex", flexDirection: "column", gap: 6,
                      transition: "border-color 0.12s",
                    }}
                  >
                    <Icon size={17} style={{ color: method === id ? "#3b82f6" : "rgba(255,255,255,0.45)" }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{label}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{sub}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT: ИТОГ */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{ ...card, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={metaLabel}>ИТОГ</div>

            <div style={{ ...innerCard, padding: "16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 32, fontWeight: 900 }}>{finalAmount || "—"}</span>
                <span style={{ color: "#3b82f6", fontSize: 10 }}>●</span>
              </div>
              {[
                { label: "Комиссия",      val: "0%" },
                { label: "Способ оплаты", val: methodLabel },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 7 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.6, margin: 0 }}>
              После оплаты баланс зачислится автоматически. При проблемах — обратитесь в поддержку.
            </p>

            <AnimatePresence>
              {result?.type === "requisites" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)",
                    borderRadius: 10, padding: "12px 13px", fontSize: 12,
                  }}
                >
                  <p style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>Реквизиты для оплаты</p>
                  <p style={{ color: "rgba(255,255,255,0.5)" }}>
                    После перевода {result.amount} ₽ напишите в{" "}
                    <a href="https://t.me/sbgamessupport_bot" style={{ color: "#60a5fa" }}>поддержку</a>{" "}
                    с чеком — пополним в течение 10 мин.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!method.startsWith("card") && error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 9, padding: "10px 12px", color: "#ef4444", fontSize: 12,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={!finalAmount || finalAmount < 50 || loading}
              style={{
                background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12,
                padding: "15px 0", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em",
                cursor: !finalAmount || finalAmount < 50 || loading ? "not-allowed" : "pointer",
                opacity: !finalAmount || finalAmount < 50 || loading ? 0.45 : 1,
                transition: "opacity 0.12s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {loading ? "Загрузка..." : <>Перейти к оплате {finalAmount || ""} <ArrowRight size={14} /></>}
            </button>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
