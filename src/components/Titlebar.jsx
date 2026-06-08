import React from "react";
import { winMinimize, winMaximize, winClose } from "../lib/window.js";

export default function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-9 bg-black flex-shrink-0 select-none px-1"
    >
      {/* Left spacer (same width as controls) */}
      <div className="w-[120px]" />

      {/* Center title */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 cursor-default"
      >
        <img src="/logo.jpg" alt="" className="w-4 h-4 rounded object-cover opacity-50" />
        <span className="text-[11px] font-semibold text-white/35 tracking-wider">SB Games</span>
      </div>

      {/* Right: custom rounded controls */}
      <div className="flex items-center gap-1 pr-2 w-[120px] justify-end">
        {/* Minimize */}
        <button
          onClick={winMinimize}
          className="w-8 h-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-all duration-150 group"
        >
          <svg width="8" height="1" viewBox="0 0 8 1" fill="currentColor" className="text-white/40 group-hover:text-white/80">
            <rect width="8" height="1"/>
          </svg>
        </button>
        {/* Maximize */}
        <button
          onClick={winMaximize}
          className="w-8 h-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition-all duration-150 group"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/40 group-hover:text-white/80">
            <rect x="0.5" y="0.5" width="7" height="7" rx="1"/>
          </svg>
        </button>
        {/* Close */}
        <button
          onClick={winClose}
          className="w-8 h-6 rounded-lg bg-white/[0.06] hover:bg-red-600 flex items-center justify-center transition-all duration-150 group"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-white/40 group-hover:text-white">
            <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
