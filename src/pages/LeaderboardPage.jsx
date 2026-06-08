import React from "react";
import { Wrench } from "@phosphor-icons/react";

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
      <Wrench size={48} className="text-white/10" weight="duotone" />
      <div className="text-center">
        <p className="text-[16px] font-bold text-white/40">Восхождение</p>
        <p className="text-[12px] text-white/20 mt-1">В разработке</p>
      </div>
      {/* Забор */}
      <div className="flex items-center gap-0 mt-2 opacity-20 select-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className={`w-6 h-8 border border-yellow-500/60 ${i % 2 === 0 ? "bg-yellow-500/20" : "bg-black/40"} -ml-px`} />
        ))}
      </div>
      <p className="text-[10px] text-white/15 tracking-widest uppercase">Скоро</p>
    </div>
  );
}
