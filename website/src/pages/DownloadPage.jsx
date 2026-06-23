import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DownloadSimple, WindowsLogo, LinuxLogo, ArrowClockwise } from "@phosphor-icons/react";

const PLATFORMS = [
  { id: "windows", icon: WindowsLogo, label: "Windows", sub: "Windows 10 / 11", ext: ".exe", color: "#60a5fa" },
  { id: "linux",   icon: LinuxLogo,   label: "Linux",   sub: "Ubuntu / Debian",  ext: ".AppImage", color: "#86efac" },
];

export default function DownloadPage() {
  const [manifest, setManifest] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState("windows");

  useEffect(() => {
    fetch("https://games.sb-capital.group/downloads/latest.json")
      .then(r => r.ok ? r.json() : null)
      .then(data => { setManifest(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const version = manifest?.version || "v1.0.0";
  const date    = manifest?.publishedAt
    ? new Date(manifest.publishedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const selectedPlatform = PLATFORMS.find(p => p.id === selected);
  const selectedAsset    = manifest?.platforms?.[selected] || null;

  return (
    <main className="relative z-10 max-w-3xl mx-auto px-4 pb-16">

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-[32px] font-black text-white mb-2">Скачать лаунчер</h1>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          Выбери свою платформу — установи и играй
        </p>
        {!loading && manifest && (
          <div className="inline-flex items-center gap-2 mt-3 rounded-xl px-4 py-2"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              Последняя версия: <span className="text-white font-bold">{version}</span>
              {date && <> · {date}</>}
            </span>
          </div>
        )}
      </div>

      {/* Platform selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setSelected(p.id)}
            className="rounded-2xl p-5 flex flex-col items-center gap-3 transition-all duration-150"
            style={selected === p.id
              ? { background: `${p.color}12`, boxShadow: `inset 0 0 0 1px ${p.color}40` }
              : { background: "rgba(255,255,255,0.04)" }
            }
          >
            <p.icon size={28} style={{ color: selected === p.id ? p.color : "rgba(255,255,255,0.4)" }} weight="fill" />
            <div className="text-center">
              <p className="text-[14px] font-bold" style={{ color: selected === p.id ? "#fff" : "rgba(255,255,255,0.6)" }}>
                {p.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{p.sub}</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
            >
              {p.ext}
            </span>
          </button>
        ))}
      </div>

      {/* Download button */}
      <div className="rounded-2xl p-6 flex items-center gap-5" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${selectedPlatform.color}15` }}
        >
          <selectedPlatform.icon size={28} weight="fill" style={{ color: selectedPlatform.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white">SBGames Launcher {version}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {selectedPlatform.label} · {selectedPlatform.sub}
          </p>
          {selectedAsset && (
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              {(selectedAsset.size / 1024 / 1024).toFixed(1)} МБ
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
            <ArrowClockwise size={16} className="animate-spin" />
          </div>
        ) : selectedAsset ? (
          <motion.a
            href={selectedAsset.url}
            download
            aria-label={`Скачать ${selectedPlatform.label}`}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-black transition-colors hover:opacity-90"
            style={{ background: selectedPlatform.color, flexShrink: 0 }}
          >
            <DownloadSimple size={16} weight="bold" />
            Скачать
          </motion.a>
        ) : (
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px]"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}
          >
            Скоро
          </div>
        )}
      </div>

      {/* Install notes */}
      <div className="mt-6 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)" }}>
        <p className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Установка</p>
        <div className="flex flex-col gap-2">

          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(96,165,250,0.12)" }}>
              <WindowsLogo size={14} weight="fill" color="#60a5fa" />
            </div>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              <span className="text-white font-semibold">Windows</span> — запусти .exe и следуй установщику
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(134,239,172,0.12)" }}>
              <LinuxLogo size={14} weight="fill" color="#86efac" />
            </div>
            <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              <span className="text-white font-semibold">Linux</span> —{" "}
              <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(134,239,172,0.1)", color: "#86efac" }}>
                chmod +x *.AppImage && ./*.AppImage
              </code>
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
