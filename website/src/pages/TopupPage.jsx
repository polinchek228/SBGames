import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, DeviceMobile, CurrencyEth, Check, Lightning, Wallet } from "@phosphor-icons/react";
import { API_URL, getToken } from "../lib/api.js";

const AMOUNTS = [100, 300, 500, 1000, 2000, 5000];

const Coin = ({ size = 14 }) => (
  <img src="/money.png" alt="SBT" style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover",
  }} />
);

const METHODS = [
  { id: "card_ru", icon: CreditCard,  label: "Карта МИР",        sub: "Российские карты" },
  { id: "card_ua", icon: CreditCard,  label: "Visa / Mastercard", sub: "Международные"   },
  { id: "sbp",     icon: Lightning,   label: "СБП",               sub: "Быстрые платежи" },
  { id: "crypto",  icon: CurrencyEth, label: "Крипто",            sub: "USDT · BTC · ETH"},
];

export default function TopupPage({ user }) {
  const [amount,  setAmount]  = useState(5000);
  const [custom,  setCustom]  = useState("");
  const [method,  setMethod]  = useState("crypto");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const finalAmount  = custom ? (parseInt(custom) || 0) : amount;
  const currentMethod = METHODS.find(m => m.id === method);

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
        setError("Способ оплаты временно недоступен");
      } else {
        setResult({ type: "requisites" });
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative z-10 max-w-2xl mx-auto px-4 pb-16">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
          style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <Wallet size={22} color="#60a5fa" />
        </div>
        <h1 className="text-[32px] font-black text-white mb-2">Пополнение</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          1 SBT = 1 ₽ · без комиссий · моментально
        </p>
        {user && (
          <div className="inline-flex items-center gap-2 mt-3 rounded-xl px-4 py-2"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Баланс: <span className="text-white font-bold">{(user.balance ?? 0).toLocaleString("ru-RU")}</span>
            </span>
            <Coin size={11} />
          </div>
        )}
      </div>

      {/* Amount grid */}
      <div className="mb-5">
        <p className="text-[11px] font-bold tracking-widest uppercase mb-3"
          style={{ color: "rgba(255,255,255,0.3)" }}>Сумма</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {AMOUNTS.map(a => {
            const sel = amount === a && !custom;
            return (
              <button key={a} onClick={() => { setAmount(a); setCustom(""); }}
                className="relative rounded-2xl p-4 flex flex-col gap-1 transition-all duration-150 text-left"
                style={sel
                  ? { background: "rgba(37,99,235,0.12)", boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.45)" }
                  : { background: "rgba(255,255,255,0.04)" }
                }
              >
                {sel && (
                  <Check size={11} weight="bold" color="#60a5fa"
                    style={{ position: "absolute", top: 8, right: 8 }} />
                )}
                <div className="flex items-center gap-1.5 font-black text-white" style={{ fontSize: 18 }}>
                  {a.toLocaleString()} <Coin size={12} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {a} ₽
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative">
          <input
            type="number" min={1} placeholder="Другая сумма…"
            value={custom}
            onChange={e => { setCustom(e.target.value); setAmount(0); }}
            className="w-full rounded-xl text-[13px] text-white outline-none"
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              padding: "13px 52px 13px 16px",
            }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold"
            style={{ color: "rgba(255,255,255,0.22)" }}>SBT</span>
        </div>
      </div>

      {/* Method */}
      <div className="mb-5">
        <p className="text-[11px] font-bold tracking-widest uppercase mb-3"
          style={{ color: "rgba(255,255,255,0.3)" }}>Способ оплаты</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map(({ id, icon: Icon, label, sub }) => {
            const sel = method === id;
            return (
              <button key={id} onClick={() => setMethod(id)}
                className="rounded-2xl p-4 flex items-center gap-3 text-left transition-all duration-150"
                style={sel
                  ? { background: "rgba(37,99,235,0.1)", boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.4)" }
                  : { background: "rgba(255,255,255,0.04)" }
                }
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: sel ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.06)" }}>
                  <Icon size={17} style={{ color: sel ? "#60a5fa" : "rgba(255,255,255,0.35)" }} />
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-tight"
                    style={{ color: sel ? "#fff" : "rgba(255,255,255,0.65)" }}>{label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary + Pay */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase mb-2"
              style={{ color: "rgba(255,255,255,0.3)" }}>Итого</p>
            <div className="flex items-center gap-2">
              <span className="font-black text-white" style={{ fontSize: 36, lineHeight: 1 }}>
                {finalAmount || "—"}
              </span>
              {finalAmount > 0 && <Coin size={20} />}
            </div>
          </div>
          <div className="text-right pb-1">
            {finalAmount > 0 && (
              <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                = {finalAmount} ₽
              </p>
            )}
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>
              {currentMethod?.label} · комиссия 0%
            </p>
          </div>
        </div>

        <AnimatePresence>
          {result?.type === "requisites" && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 mb-4"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p className="text-[13px] font-bold text-white mb-1">Реквизиты для оплаты</p>
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                Напиши в <a href="https://t.me/sbgamescbot" style={{ color: "#60a5fa" }}>@sbgamescbot</a> с чеком — пополним в течение 10 минут.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-xl p-4 mb-4"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-[12px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={!finalAmount || finalAmount < 50 || loading}
          className="w-full rounded-xl py-4 flex items-center justify-center gap-2 font-bold text-[14px] text-white transition-all"
          style={{
            background: finalAmount >= 50 ? "linear-gradient(90deg, #2563eb, #7c3aed)" : "rgba(255,255,255,0.06)",
            opacity: !finalAmount || finalAmount < 50 || loading ? 0.5 : 1,
            cursor: !finalAmount || finalAmount < 50 || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Загрузка…" : (
            <>Пополнить {finalAmount > 0 ? finalAmount.toLocaleString() : ""} {finalAmount > 0 && <Coin size={14} />}</>
          )}
        </button>
      </div>

    </main>
  );
}
