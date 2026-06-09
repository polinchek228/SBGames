import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, DeviceMobile, CurrencyEth, ArrowRight } from "@phosphor-icons/react";
import { API_URL, getToken } from "../lib/api.js";

const AMOUNTS = [100, 300, 500, 1000, 2000, 5000];
const METHODS = [
  { id: "card_ru",  icon: CreditCard, label: "Карта (RU)",   sub: "ЮKassa, Visa/Mastercard/МИР" },
  { id: "card_ua",  icon: CreditCard, label: "Карта (UA)",   sub: "Monobank, Visa/Mastercard" },
  { id: "crypto",   icon: CurrencyEth,label: "Криптовалюта", sub: "USDT, BTC, ETH" },
  { id: "sbp",      icon: DeviceMobile,label: "СБП",         sub: "Быстрые платежи РФ" },
];

export default function TopupPage({ user }) {
  const [amount,    setAmount]    = useState(500);
  const [custom,    setCustom]    = useState("");
  const [method,    setMethod]    = useState("crypto");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);

  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  const handlePay = async () => {
    if (!finalAmount || finalAmount < 50) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/create-code`, { method: "POST" });
      // For now just show requisites
      setResult({ type: "requisites", amount: finalAmount });
    } catch {
      setResult({ type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative z-10 max-w-4xl mx-auto px-4 pb-16">
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-black text-white mb-2">Пополнение баланса</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          Выбери сумму, способ оплаты и подтверди платёж. Баланс обновится автоматически.
        </p>
        <div className="inline-flex items-center gap-2 mt-3 rounded-xl px-4 py-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>Текущий баланс:</span>
          <span className="text-[13px] font-black text-white tabular-nums">{(user?.balance ?? 0).toLocaleString("ru-RU")}</span>
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left: amount + method */}
        <div className="col-span-2 flex flex-col gap-4">

          {/* Amount */}
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(12,12,12,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              Сумма пополнения
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setCustom(""); }}
                  className="rounded-xl py-3 flex flex-col items-center gap-0.5 transition-all"
                  style={amount === a && !custom
                    ? { background: "#2563EB", color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }
                  }
                >
                  <span className="text-[15px] font-black">{a}</span>
                  <span className="text-[9px] uppercase tracking-widest opacity-70">СБТ</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${custom ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.07)"}` }}
            >
              <input
                type="number"
                value={custom}
                onChange={e => { setCustom(e.target.value); setAmount(0); }}
                placeholder="Другая сумма"
                className="flex-1 bg-transparent text-[13px] text-white placeholder-white/25"
              />
              <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>СБТ</span>
            </div>
          </div>

          {/* Method */}
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(12,12,12,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              Способ оплаты
            </p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(({ id, icon: Icon, label, sub }) => (
                <button key={id} onClick={() => setMethod(id)}
                  className="rounded-xl p-4 flex flex-col gap-1.5 text-left transition-all"
                  style={method === id
                    ? { background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.4)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }
                  }
                >
                  <Icon size={18} style={{ color: method === id ? "#60a5fa" : "rgba(255,255,255,0.5)" }} />
                  <p className="text-[13px] font-semibold text-white">{label}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: summary */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl p-5"
            style={{ background: "rgba(12,12,12,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
              Итог
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[28px] font-black text-white tabular-nums">{finalAmount || "—"}</span>
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            </div>
            {[
              { label: "Комиссия",     val: "0%" },
              { label: "Способ оплаты", val: METHODS.find(m => m.id === method)?.label || "—" },
            ].map(({ label, val }) => (
              <div key={label} className="flex items-center justify-between mb-2">
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                <span className="text-[12px] font-semibold text-white">{val}</span>
              </div>
            ))}
            <div className="rounded-xl p-3 mt-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                ○ Подтверждение происходит через Telegram. Мы не храним данные платежа.
              </p>
            </div>
          </div>

          <AnimatePresence>
            {result?.type === "requisites" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4 text-[12px]"
                style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)" }}
              >
                <p className="font-bold text-white mb-2">Реквизиты для оплаты</p>
                <p style={{ color: "rgba(255,255,255,0.55)" }}>
                  После перевода {result.amount} ₽ напишите в{" "}
                  <a href="https://t.me/sbgamessupport_bot" className="text-blue-400">поддержку</a>{" "}
                  с чеком — пополним в течение 10 мин.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handlePay} disabled={!finalAmount || finalAmount < 50 || loading}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] text-white disabled:opacity-40 transition-colors"
            style={{ background: "#2563EB" }}
          >
            {loading ? "Загрузка..." : <>Перейти к оплате {finalAmount || ""} <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </main>
  );
}
