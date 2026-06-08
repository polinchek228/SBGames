import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowClockwise, CalendarBlank, Eye, ArrowRight, Megaphone, Star, Tag, WarningCircle } from "@phosphor-icons/react";

const MOCK_NEWS = [
  {
    id: 1, tag: "ОБНОВЛЕНИЕ", date: "10.01.2026", title: "Pixelmon 1.5.0 — Новые покемоны",
    text: "Добавлено 40+ новых покемонов, полностью переработана система аренных боёв и улучшен баланс легендарок. Проверь что нового!",
    views: 2140, time: "19:40",
  },
  {
    id: 2, tag: "СОБЫТИЕ", date: "СЕЙЧАС", title: "Зимний Ивент 2026",
    text: "Специальные зимние покемоны появились в биомах тундры. Собери всех 12 до конца месяца и получи уникальную награду.",
    views: 5821, time: "12:00",
  },
  {
    id: 3, tag: "НОВОСТИ", date: "10.01.2026", title: "StarWars: Открыт новый сервер",
    text: "Галактическая война продолжается. Новый сервер с улучшенными Force-способностями и переработанными классами.",
    views: 1753, time: "17:53",
  },
  {
    id: 4, tag: "ПАТЧ", date: "08.01.2026", title: "Magic 2.0 — Большой патч",
    text: "Полный ребаланс школ магии, 150+ новых заклинаний, редизайн интерфейса и два новых класса: Некромант и Друид.",
    views: 3300, time: "15:22",
  },
  {
    id: 5, tag: "АКЦИЯ", date: "07.01.2026", title: "−30% на весь магазин",
    text: "Новогодняя акция: скидка 30% на все предметы магазина до конца января. Не упусти шанс.",
    views: 9120, time: "09:00",
  },
  {
    id: 6, tag: "НОВОСТИ", date: "05.01.2026", title: "Сезон 3 — Рейтинговые бои",
    text: "Третий рейтинговый сезон стартовал. Новые награды, обновлённая таблица лидеров и эксклюзивные скины за топ-10.",
    views: 4411, time: "18:30",
  },
];

const TAG_META = {
  "ОБНОВЛЕНИЕ": { icon: ArrowClockwise, color: "text-blue-400",   bg: "bg-blue-500/10   border-blue-500/20" },
  "СОБЫТИЕ":    { icon: Star,           color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  "НОВОСТИ":    { icon: Megaphone,       color: "text-white/50",   bg: "bg-white/[0.05]  border-white/[0.1]" },
  "ПАТЧ":       { icon: WarningCircle,   color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  "АКЦИЯ":      { icon: Tag,             color: "text-green-400",  bg: "bg-green-500/10  border-green-500/20" },
};

export default function NewsPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded]   = useState(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 900));
    setRefreshing(false);
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <Megaphone size={20} weight="fill" className="text-white/70" />
            <h1 className="text-[18px] font-display font-black tracking-tight text-white">Новости</h1>
            <span className="text-[9px] font-black tracking-widest text-white bg-red-600 px-2 py-0.5 rounded-md">LIVE</span>
          </div>
          <p className="text-[11px] text-white/25 mt-0.5 pl-7">Последние события и обновления</p>
        </div>
        <button onClick={handleRefresh}
          className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.07] text-white/40 hover:text-white flex items-center justify-center transition-colors"
        >
          <ArrowClockwise size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-3 gap-3">
          {MOCK_NEWS.map((item, i) => {
            const meta = TAG_META[item.tag] || TAG_META["НОВОСТИ"];
            const TagIcon = meta.icon;
            const isExpanded = expanded === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex flex-col rounded-2xl bg-[#0a0a0a] border border-white/[0.06] overflow-hidden hover:border-white/[0.11] transition-all duration-200 cursor-pointer group"
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                {/* Top colour bar */}
                <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${meta.color.replace("text-","").replace("-400","")}, transparent)` }} />

                <div className="p-4 flex flex-col flex-1 gap-2.5">
                  {/* Tag + date */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded-lg border ${meta.bg} ${meta.color}`}>
                      <TagIcon size={10} weight="bold" />
                      {item.tag}
                    </span>
                    <div className="flex items-center gap-1 text-white/20">
                      <CalendarBlank size={10} />
                      <span className="text-[9px]">{item.date}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-[13px] font-bold text-white leading-snug line-clamp-2 group-hover:text-white/90 transition-colors">
                    {item.title}
                  </h3>

                  {/* Text */}
                  <p className={`text-[11px] text-white/40 leading-relaxed transition-all duration-300 ${isExpanded ? "" : "line-clamp-2"}`}>
                    {item.text}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/[0.05]">
                    <div className="flex items-center gap-1 text-white/20">
                      <Eye size={11} />
                      <span className="text-[9px]">{item.views.toLocaleString("ru-RU")}</span>
                      <span className="text-[9px] ml-1">{item.time}</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/30 group-hover:text-white/55 transition-colors">
                      <span className="text-[9px] font-semibold tracking-wider">ЧИТАТЬ</span>
                      <ArrowRight size={10} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
