import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Settings, X, Cpu, HardDrive, AlertTriangle, ShieldAlert, Info, Plus, Package, FileImage, Sparkles, Trash2, Search, Download, Check, ExternalLink, ChevronDown, ArrowLeft, MoreHorizontal, Grid3X3, List } from "lucide-react";
import { UsersThree } from "@phosphor-icons/react";
import { invoke, notifyDesktop, setDiscordPresence, getMinecraftStatus, killMinecraft } from "../lib/tauri.js";
import { pushLocalActivity } from "../components/RecentActivityCard.jsx";
import { searchMods, searchResourcePacks, searchShaders, getPopular, getProjectVersions, downloadUrl, formatDownloads, truncateText, getMcVersions, getModrinthLoaders } from "../lib/modrinth.js";

const SERVERS = [
  { id: "starwars", name: "STARWARS", subtitle: "Звёздные Войны", description: "Встань на сторону Ордена Джедаев или Тёмной стороны.", bg: "linear-gradient(160deg, #0a0a1f 0%, #050510 60%, #000 100%)", accent: "#818cf8", online: 0, image: "https://games.sb-capital.group/servers/starwars.jpg" },
  { id: "minigames", name: "MINIGAMES", subtitle: "Мини-игры", description: "BedWars, SkyWars, TheBridge и десятки других мини-игр.", bg: "linear-gradient(160deg, #0f1f0a 0%, #051005 60%, #000 100%)", accent: "#22c55e", online: 0, image: "https://games.sb-capital.group/servers/minigames.jpg" },
  { id: "gta", name: "GTA", subtitle: "Grand Theft Auto RP", description: "Живи в городе без правил. Криминал, бизнес, полиция и хаос.", bg: "linear-gradient(160deg, #1f0a0a 0%, #100505 60%, #000 100%)", accent: "#ef4444", online: 0, image: "https://games.sb-capital.group/servers/gta.jpg" },
  { id: "vanilla_plus", name: "VANILA+", subtitle: "Ванильный+", description: "Классический Minecraft с небольшими улучшениями.", bg: "linear-gradient(160deg, #0a1a1f 0%, #050d10 60%, #000 100%)", accent: "#06b6d4", online: 0, image: "https://games.sb-capital.group/servers/vanilla.jpg" },
  { id: "anarchy", name: "АНАРХИЯ", subtitle: "Без правил", description: "Полная свобода действий. Мир где сила решает всё.", bg: "linear-gradient(160deg, #1f1a0a 0%, #100d05 60%, #000 100%)", accent: "#f59e0b", online: 0, image: "https://games.sb-capital.group/servers/anarchy.jpg" },
];

const FALLBACK_VERSIONS = [
  { id: "1.21.4", type: "release" }, { id: "1.21.1", type: "release" }, { id: "1.20.6", type: "release" },
  { id: "1.20.4", type: "release" }, { id: "1.20.1", type: "release" }, { id: "1.19.4", type: "release" },
  { id: "1.19.2", type: "release" }, { id: "1.18.2", type: "release" }, { id: "1.16.5", type: "release" },
  { id: "1.12.2", type: "release" },
];

const TABS = [
  { id: "mods", label: "Моды", icon: Package, accent: "#a855f7", type: "mod" },
  { id: "resourcepacks", label: "Ресурспаки", icon: FileImage, accent: "#06b6d4", type: "resourcepack" },
  { id: "shaders", label: "Шейдеры", icon: Sparkles, accent: "#f59e0b", type: "shader" },
];

const FABRIC_API_PROJECT = "P7dR8mSH";

export default function PlayPage({ user, onOpenCommunity }) {
  const [selected, setSelected] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [showSettings, setShowSettings] = useState(() => localStorage.getItem("sbg_play_showSettings") === "1");
  const [modpackReport, setModpackReport] = useState(() => { try { return JSON.parse(localStorage.getItem("sbg_play_modpackReport") || "null"); } catch { return null; } });
  const [showModpackModal, setShowModpackModal] = useState(() => localStorage.getItem("sbg_play_showModpackModal") === "1");
  const [ramGb, setRamGb] = useState(() => parseInt(localStorage.getItem("sbg_ram_gb") || "4"));
  const [javaPath, setJavaPath] = useState(() => localStorage.getItem("sbg_java_path") || "");

  // Custom modpacks (multiple)
  const [customModpacks, setCustomModpacks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbg_custom_modpacks") || "[]"); } catch { return []; }
  });
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState({ name: "", mcVersion: "1.20.1", loader: "forge", mods: [], resourcePacks: [], shaders: [] });

  // Dynamic versions & loaders from API
  const [mcVersions, setMcVersions] = useState(FALLBACK_VERSIONS);
  const [loaders, setLoaders] = useState([{ name: "Forge", slug: "forge" }, { name: "Fabric", slug: "fabric" }, { name: "Quilt", slug: "quilt" }, { name: "NeoForge", slug: "neoforge" }, { name: "Все", slug: "all" }]);
  const [loadingMcData, setLoadingMcData] = useState(true);

  // Modrinth state
  const [activeTab, setActiveTab] = useState("mods");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [popularResults, setPopularResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const searchTimer = useRef(null);
  const [selectedModDetail, setSelectedModDetail] = useState(null);
  const [modVersions, setModVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Sidebar menu (ДОП)
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const sidebarMenuRef = useRef(null);

  useEffect(() => { localStorage.setItem("sbg_ram_gb", String(ramGb)); }, [ramGb]);
  useEffect(() => { if (javaPath) localStorage.setItem("sbg_java_path", javaPath); }, [javaPath]);

  const [mcRunning, setMcRunning] = useState(false);
  const [guardModal, setGuardModal] = useState(() => { try { return JSON.parse(localStorage.getItem("sbg_play_guardModal") || "null"); } catch { return null; } });
  const pollRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getMinecraftStatus();
        if (cancelled) return;
        setMcRunning(!!status?.running);
        if (!status?.running && status?.guard) setGuardModal(status.guard);
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => { localStorage.setItem("sbg_play_showSettings", showSettings ? "1" : "0"); }, [showSettings]);
  useEffect(() => {
    localStorage.setItem("sbg_play_showModpackModal", showModpackModal ? "1" : "0");
    if (!showModpackModal) localStorage.removeItem("sbg_play_modpackReport");
  }, [showModpackModal]);
  useEffect(() => { if (modpackReport) localStorage.setItem("sbg_play_modpackReport", JSON.stringify(modpackReport)); }, [modpackReport]);
  useEffect(() => { if (guardModal) localStorage.setItem("sbg_play_guardModal", JSON.stringify(guardModal)); else localStorage.removeItem("sbg_play_guardModal"); }, [guardModal]);
  useEffect(() => { localStorage.setItem("sbg_custom_modpacks", JSON.stringify(customModpacks)); }, [customModpacks]);

  // Fetch MC versions and loaders from API
  useEffect(() => {
    (async () => {
      setLoadingMcData(true);
      try {
        const [versions, modrinthLoaders] = await Promise.all([getMcVersions(), getModrinthLoaders()]);
        if (versions?.length) setMcVersions(versions);
        if (modrinthLoaders?.length) {
          const mapped = modrinthLoaders.map(l => ({ id: l.slug, label: l.name || l.slug }));
          if (mapped.length) setLoaders([...mapped, { id: "all", label: "Все" }]);
        }
      } catch {}
      setLoadingMcData(false);
    })();
  }, []);

  // Fetch online counts for servers
  const [serverOnline, setServerOnline] = useState({});
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("https://games.sb-capital.group/api/servers/online");
        if (res.ok) {
          const data = await res.json();
          setServerOnline(data);
        }
      } catch {}
    };
    fetchOnline();
    const iv = setInterval(fetchOnline, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!selected) {
      window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } }));
      setDiscordPresence("В лаунчере", "Выбирает сервер", "sbgames");
      return;
    }
    window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: selected.id } }));
    setDiscordPresence(`Выбирает сервер: ${selected.name}`, "В лаунчере", "sbgames");
  }, [selected]);

  useEffect(() => {
    setDiscordPresence("В лаунчере", "Выбирает сервер", "sbgames");
    return () => { window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } })); };
  }, []);

  // Close sidebar menu on outside click
  useEffect(() => {
    const handler = (e) => { if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target)) setShowSidebarMenu(false); };
    if (showSidebarMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSidebarMenu]);

  // Load popular items when tab/version/loader changes
  const loadPopular = useCallback(async (version, loader, tab) => {
    try {
      const tabDef = TABS.find(t => t.id === tab);
      const data = await getPopular(version, loader, tabDef?.type || "mod", 20);
      setPopularResults(data.hits || []);
    } catch { setPopularResults([]); }
  }, []);

  useEffect(() => {
    if (!showBuilder) return;
    loadPopular(draft.mcVersion, draft.loader, activeTab);
  }, [showBuilder, draft.mcVersion, draft.loader, activeTab, loadPopular]);

  // Modrinth search
  const doSearch = useCallback(async (query, tab, version, loader, page = 0, append = false) => {
    if (!query && page === 0) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const limit = 20;
      const offset = page * limit;
      let data;
      if (tab === "mods") data = await searchMods(query, version, loader, limit, offset);
      else if (tab === "resourcepacks") data = await searchResourcePacks(query, version, limit, offset);
      else data = await searchShaders(query, version, limit, offset);
      setSearchResults(prev => append ? [...prev, ...data.hits] : data.hits);
      setHasMore(data.hits.length === limit);
    } catch { }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchPage(0);
      doSearch(searchQuery, activeTab, draft.mcVersion, draft.loader, 0, false);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, activeTab, draft.mcVersion, draft.loader, doSearch]);

  const loadMore = () => {
    const next = searchPage + 1;
    setSearchPage(next);
    doSearch(searchQuery, activeTab, draft.mcVersion, draft.loader, next, true);
  };

  const openModDetail = async (hit) => {
    setSelectedModDetail(hit);
    setLoadingVersions(true);
    try {
      const versions = await getProjectVersions(hit.slug || hit.project_id, draft.mcVersion, draft.loader);
      setModVersions(versions);
    } catch { setModVersions([]); }
    setLoadingVersions(false);
  };

  const addModFromVersion = (hit, version) => {
    const url = downloadUrl(version);
    const item = {
      projectId: hit.project_id, slug: hit.slug, title: hit.title, icon_url: hit.icon_url,
      version: version.version_number, downloads: hit.downloads, downloadUrl: url,
      filename: version.files?.[0]?.filename || `${hit.slug}.jar`,
    };
    const key = activeTab === "mods" ? "mods" : activeTab === "resourcepacks" ? "resourcePacks" : "shaders";
    const exists = draft[key].some(m => m.projectId === item.projectId);
    if (!exists) setDraft(prev => ({ ...prev, [key]: [...prev[key], item] }));
  };

  const addModDirect = (hit) => {
    const item = {
      projectId: hit.project_id, slug: hit.slug, title: hit.title, icon_url: hit.icon_url,
      version: "?", downloads: hit.downloads, downloadUrl: null, filename: `${hit.slug}`,
    };
    const key = activeTab === "mods" ? "mods" : activeTab === "resourcepacks" ? "resourcePacks" : "shaders";
    const exists = draft[key].some(m => m.projectId === item.projectId);
    if (!exists) setDraft(prev => ({ ...prev, [key]: [...prev[key], item] }));
  };

  const removeItem = (key, idx) => {
    setDraft(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const isItemAdded = (projectId) => {
    return draft.mods.some(m => m.projectId === projectId) ||
      draft.resourcePacks.some(m => m.projectId === projectId) ||
      draft.shaders.some(m => m.projectId === projectId);
  };

  // Auto-add Fabric API when Fabric loader is selected
  useEffect(() => {
    if (draft.loader === "fabric" && showBuilder) {
      const hasFabricApi = draft.mods.some(m => m.projectId === FABRIC_API_PROJECT);
      if (!hasFabricApi) {
        const apiItem = {
          projectId: FABRIC_API_PROJECT, slug: "fabric-api", title: "Fabric API", icon_url: null,
          version: "auto", downloads: 0, downloadUrl: null, filename: "fabric-api", auto: true,
        };
        setDraft(prev => ({ ...prev, mods: [apiItem, ...prev.mods] }));
      }
    }
  }, [draft.loader, showBuilder]);

  const saveModpack = () => {
    if (!draft.name.trim()) return;
    const mp = { ...draft, name: draft.name.trim(), id: Date.now().toString() };
    setCustomModpacks(prev => {
      const existing = prev.findIndex(p => p.id === mp.id);
      if (existing >= 0) { const copy = [...prev]; copy[existing] = mp; return copy; }
      return [...prev, mp];
    });
    setShowBuilder(false);
  };

  const deleteModpack = (id) => {
    setCustomModpacks(prev => prev.filter(p => p.id !== id));
    if (selected?.id === `custom_${id}`) setSelected(null);
  };

  const openBuilder = (existing) => {
    setDraft(existing || { name: "", mcVersion: "1.20.1", loader: "forge", mods: [], resourcePacks: [], shaders: [] });
    setSelectedModDetail(null);
    setSearchQuery("");
    setActiveTab("mods");
    setShowBuilder(true);
    setSelected(null);
  };

  const selectCustom = (mp) => {
    setSelected({ id: `custom_${mp.id}`, name: mp.name, subtitle: `${mp.loader.toUpperCase()} ${mp.mcVersion}`,
      description: `Моды: ${mp.mods.length} | Ресурспаки: ${mp.resourcePacks.length} | Шейдеры: ${mp.shaders.length}`,
      bg: "linear-gradient(160deg, #1a0a2e 0%, #0d0520 60%, #000 100%)", accent: "#a855f7", customPack: mp });
    setShowBuilder(false);
    setShowSidebarMenu(false);
  };

  const handlePlay = async () => {
    if (!selected) return;
    setLaunching(true);
    setLaunchError(null);
    await setDiscordPresence(`Играет на ${selected.name}`, "В игре · SB Games", "sbgames");
    const startedAt = Date.now();
    try {
      if (selected.id?.startsWith("custom_") && selected.customPack) {
        const result = await invoke("launch_custom_modpack", {
          modpack: selected.customPack, username: user?.username || "Player",
          token: localStorage.getItem("sbgames_token") || "0", ramGb, javaPath,
        });
        saveSession(selected.id, user?.username);
        sessionStorage.setItem("sbg_last_session", JSON.stringify({ serverId: selected.id, startedAt }));
        await notifyDesktop("SB Games", `${result}`);
        setMcRunning(true); setLaunching(false); setLaunched(true);
        setTimeout(() => setLaunched(false), 4000);
        return;
      }
      const result = await invoke("launch_minecraft", {
        serverId: selected.id, username: user?.username || "Player",
        token: localStorage.getItem("sbgames_token") || "0", ramGb, javaPath,
      });
      saveSession(selected.id, user?.username);
      sessionStorage.setItem("sbg_last_session", JSON.stringify({ serverId: selected.id, startedAt }));
      await notifyDesktop("SB Games", `${result}`);
      setMcRunning(true); setLaunching(false); setLaunched(true);
      setTimeout(() => setLaunched(false), 4000);
    } catch (err) {
      const errStr = String(err);
      if (errStr.includes("__MODPACK_REPORT__")) {
        try { const report = JSON.parse(errStr.split("__MODPACK_REPORT__")[1]); setModpackReport(report); setShowModpackModal(true); } catch { setLaunchError(errStr); }
      } else { setLaunchError(errStr); }
      setLaunching(false);
    }
  };

  const handleModpackClean = async () => { setShowModpackModal(false); setModpackReport(null); setLaunching(true); await handlePlay(); };
  const handleModpackCancel = () => { setShowModpackModal(false); setModpackReport(null); };

  const handleClose = async () => {
    try {
      const raw = sessionStorage.getItem("sbg_last_session");
      if (raw) {
        const s = JSON.parse(raw);
        const durSec = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000));
        if (durSec > 5) {
          pushLocalActivity(s.serverId, durSec);
          try { const token = localStorage.getItem("sbgames_token"); if (token) fetch("https://games.sb-capital.group/api/activity", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ serverId: s.serverId, startedAt: s.startedAt, endedAt: Date.now(), durationSec: durSec }) }).catch(() => {}); } catch {}
        }
        sessionStorage.removeItem("sbg_last_session");
      }
      await killMinecraft();
    } catch {}
    setMcRunning(false);
  };

  function saveSession(serverId, username) {
    try { const sessions = JSON.parse(localStorage.getItem("sbgames_sessions") || "[]"); sessions.unshift({ serverId, username, time: Date.now() }); localStorage.setItem("sbgames_sessions", JSON.stringify(sessions.slice(0, 50))); } catch {}
  }

  const displayItems = searchQuery ? searchResults : popularResults;
  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="relative h-full overflow-hidden" style={{ background: "transparent" }}>
      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div key={selected ? selected.id + "_bg" : showBuilder ? "builder_bg" : "empty_bg"} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          {selected ? (
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 80%, ${selected.accent}15, transparent 60%)` }} />
          ) : showBuilder ? (
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 80%, rgba(168,85,247,0.08), transparent 60%)" }} />
          ) : (
            <div className="absolute inset-0" style={{ backgroundImage: "url('/hero.jpg')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.4 }} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <div className="absolute left-0 top-0 bottom-0 z-20" style={{ width: 220, padding: "16px 0 16px 16px" }}>
        <div className="h-full rounded-2xl flex flex-col overflow-hidden"
          style={{ background: "rgba(8,8,8,0.92)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.8)", backdropFilter: "blur(24px)" }}>
          <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0"><img src="/logo.jpg" alt="" className="w-full h-full object-cover" /></div>
              <p className="text-[13px] font-black tracking-wide" style={{ background: "linear-gradient(135deg, #3b82f6, #60a5fa, #93c5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>SBGames</p>
            </div>
            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Начните играть</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
            {SERVERS.map(srv => {
              const active = selected?.id === srv.id && !showBuilder;
              const online = serverOnline[srv.id] || 0;
              return (
                <div key={srv.id} className="relative group">
                  <button onClick={() => { setShowBuilder(false); setShowSidebarMenu(false); setSelected(selected?.id === srv.id && !showBuilder ? null : srv); }} className="w-full text-left focus:outline-none">
                    <motion.div animate={{ opacity: active ? 1 : 0.45 }} whileHover={{ opacity: active ? 1 : 0.75 }} transition={{ duration: 0.15 }} className="relative rounded-xl overflow-hidden"
                      style={{ boxShadow: active ? `0 0 12px rgba(37,99,235,0.4), 0 4px 20px ${srv.accent}20` : "none", border: "none" }}>
                      <div className="h-[90px] relative" style={{ background: srv.bg }}>
                        {srv.image && <img src={srv.image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={e => e.currentTarget.style.display = "none"} />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {active && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 100%, rgba(37,99,235,0.15), transparent 65%)` }} />}
                        {active && <motion.div layoutId="srv-bar" className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full" style={{ background: "linear-gradient(90deg, transparent, #2563eb, transparent)" }} transition={{ type: "spring", stiffness: 400, damping: 35 }} />}
                        <div className="absolute bottom-2.5 left-3">
                          <p className="text-[12px] font-black text-white tracking-wide leading-none">{srv.name}</p>
                          <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{srv.subtitle}</p>
                        </div>
                        {online > 0 && (
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            <span className="text-[9px] font-bold text-green-400">{online}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </button>
                </div>
              );
            })}

            {/* Create button */}
            <button onClick={() => openBuilder(null)} className="w-full text-left focus:outline-none">
              <motion.div whileHover={{ opacity: 0.75 }} transition={{ duration: 0.15 }} className="relative rounded-xl overflow-hidden">
                <div className="h-[60px] relative flex items-center justify-center" style={{ background: showBuilder ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.03)", border: `1.5px dashed ${showBuilder ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.12)"}`, borderRadius: "0.75rem" }}>
                  <div className="flex items-center gap-2">
                    <Plus size={14} style={{ color: showBuilder ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.35)" }} />
                    <p className="text-[11px] font-semibold" style={{ color: showBuilder ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.35)" }}>СОЗДАТЬ</p>
                  </div>
                </div>
              </motion.div>
            </button>
          </div>

          {/* ДОП button — bottom right */}
          <div className="px-3 pb-3 flex-shrink-0 relative" ref={sidebarMenuRef}>
            <button onClick={() => setShowSidebarMenu(!showSidebarMenu)}
              className="w-full h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all"
              style={{ background: showSidebarMenu ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
              onMouseLeave={e => { if (!showSidebarMenu) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; } }}>
              <MoreHorizontal size={13} />
              <span className="text-[10px] font-semibold">ДОП</span>
            </button>

            {/* Sidebar dropdown menu */}
            <AnimatePresence>
              {showSidebarMenu && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-10 left-0 right-0 rounded-xl overflow-hidden z-50"
                  style={{ background: "rgba(14,14,18,0.98)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 12px 40px rgba(0,0,0,0.8)", backdropFilter: "blur(24px)" }}>
                  <div className="p-1.5 max-h-[340px] overflow-y-auto">
                    <p className="text-[9px] uppercase tracking-widest font-semibold px-2.5 py-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Серверы</p>
                    {SERVERS.map(srv => (
                      <button key={srv.id} onClick={() => { setShowBuilder(false); setSelected(srv); setShowSidebarMenu(false); }}
                        className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 transition-all hover:bg-white/[0.05]">
                        <div className="w-7 h-7 rounded-lg flex-shrink-0 overflow-hidden" style={{ background: srv.bg }}>
                          {srv.image && <img src={srv.image} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => e.currentTarget.style.display = "none"} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-white truncate">{srv.name}</p>
                          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{srv.subtitle}</p>
                        </div>
                      </button>
                    ))}

                    {customModpacks.length > 0 && (
                      <>
                        <div className="my-1 mx-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                        <p className="text-[9px] uppercase tracking-widest font-semibold px-2.5 py-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>Мои сборки</p>
                        {customModpacks.map(mp => (
                          <div key={mp.id} className="group/item px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-all">
                            <div className="flex items-center gap-2">
                              <button onClick={() => selectCustom(mp)} className="flex-1 text-left min-w-0">
                                <p className="text-[11px] font-bold text-white truncate">{mp.name}</p>
                                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{mp.loader.toUpperCase()} {mp.mcVersion} · {mp.mods.length} модов</p>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); openBuilder(mp); setShowSidebarMenu(false); }}
                                className="p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-white/10 transition-all" title="Редактировать">
                                <Settings size={10} style={{ color: "rgba(255,255,255,0.4)" }} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteModpack(mp.id); }}
                                className="p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-white/10 transition-all" title="Удалить">
                                <Trash2 size={10} style={{ color: "rgba(239,68,68,0.6)" }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {showBuilder ? (
        /* ═══ BUILDER ═══ */
        <div className="absolute inset-0 flex" style={{ paddingLeft: 252 }}>
          {/* Left panel — opaque */}
          <div className="w-[320px] flex flex-col border-r" style={{ background: "rgba(10,10,14,0.95)", borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}>
            <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-black text-white mb-1">Новая сборка</p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Настрой свою сборку модов</p>
                </div>
                <button onClick={() => openBuilder(null)} className="h-7 px-2.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
                  style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.25)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(168,85,247,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(168,85,247,0.12)"}>
                  <Plus size={10} /> Новая
                </button>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Название</span>
                <input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Моя сборка"
                  className="w-full rounded-xl text-[13px] px-3 py-2.5 outline-none" style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }} />
              </div>

              {/* MC Version + Loader in row */}
              <div className="flex gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Версия</span>
                  <div className="relative">
                    <select value={draft.mcVersion} onChange={e => setDraft(p => ({ ...p, mcVersion: e.target.value }))}
                      className="w-full rounded-xl text-[12px] px-3 py-2.5 outline-none appearance-none cursor-pointer" style={{ background: "rgba(255,255,255,0.05)", color: "#e5e7eb" }}>
                      {mcVersions.map(v => (
                        <option key={v.id} value={v.id} style={{ background: "#1a1a24", color: "#e5e7eb" }}>
                          {v.id}{v.type === "snapshot" ? " (snapshot)" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузчик</span>
                  <div className="relative">
                    <select value={draft.loader} onChange={e => setDraft(p => ({ ...p, loader: e.target.value }))}
                      className="w-full rounded-xl text-[12px] px-3 py-2.5 outline-none appearance-none cursor-pointer" style={{ background: "rgba(255,255,255,0.05)", color: "#e5e7eb" }}>
                      {loaders.map(l => (
                        <option key={l.id} value={l.id} style={{ background: "#1a1a24", color: "#e5e7eb" }}>{l.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                </div>
              </div>

              {/* Installed items */}
              {TABS.map(tab => {
                const items = tab.id === "mods" ? draft.mods : tab.id === "resourcepacks" ? draft.resourcePacks : draft.shaders;
                const key = tab.id === "mods" ? "mods" : tab.id === "resourcepacks" ? "resourcePacks" : "shaders";
                if (items.length === 0) return null;
                return (
                  <div key={tab.id} className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <tab.icon size={10} /> {tab.label} ({items.length})
                    </span>
                    <div className="rounded-xl p-1.5 space-y-1" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 group/item" style={{ background: `${tab.accent}08`, border: `1px solid ${tab.accent}15` }}>
                          {item.icon_url ? <img src={item.icon_url} alt="" className="w-5 h-5 rounded flex-shrink-0" /> : <tab.icon size={10} style={{ color: tab.accent, flexShrink: 0 }} />}
                          <span className="text-[11px] text-white truncate flex-1">{item.title}{item.auto ? " (auto)" : ""}{item.local ? " (local)" : ""}</span>
                          <span className="text-[9px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{item.version}</span>
                          {!item.auto && <button onClick={() => removeItem(key, i)} className="p-0.5 rounded opacity-0 group-hover/item:opacity-100 hover:bg-white/10 transition-all">
                            <Trash2 size={10} style={{ color: "rgba(239,68,68,0.7)" }} />
                          </button>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Info */}
              <div className="rounded-xl p-3 flex gap-2.5" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <Info size={13} style={{ color: "#a855f7", flexShrink: 0, marginTop: 1 }} />
                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Античит не распространяется на пользовательские сборки. Fabric API добавляется автоматически.
                </p>
              </div>

              {/* Import from archive */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Импорт</span>
                <label className="flex items-center justify-center gap-2 h-10 rounded-xl cursor-pointer transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}>
                  <input type="file" accept=".zip,.jar" multiple className="hidden" onChange={e => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(f => {
                      const name = f.name.replace(/\.(zip|jar)$/i, "");
                      const isJar = f.name.endsWith(".jar");
                      const item = { projectId: `local_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, slug: name.toLowerCase(), title: name, icon_url: null, version: "local", downloads: 0, downloadUrl: null, filename: f.name, local: true };
                      if (isJar) {
                        setDraft(prev => ({ ...prev, mods: [...prev.mods, item] }));
                      } else {
                        setDraft(prev => ({ ...prev, resourcePacks: [...prev.resourcePacks, item] }));
                      }
                    });
                    e.target.value = "";
                  }} />
                  <Package size={13} /> Добавить из архива (.zip / .jar)
                </label>
              </div>
            </div>

            <div className="p-4 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => setShowBuilder(false)} className="flex-1 h-10 rounded-xl text-[12px] font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>Отмена</button>
              <button onClick={saveModpack} disabled={!draft.name.trim()}
                className="flex-1 h-10 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-30"
                style={{ background: draft.name.trim() ? "linear-gradient(135deg, #9333ea, #a855f7)" : "rgba(168,85,247,0.2)", boxShadow: draft.name.trim() ? "0 0 20px rgba(168,85,247,0.3)" : "none" }}>
                Сохранить
              </button>
            </div>
          </div>

          {/* Right panel: Modrinth browser — opaque */}
          <div className="flex-1 flex flex-col" style={{ background: "rgba(10,10,14,0.92)" }}>
            {/* Tabs + search */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(""); setSelectedModDetail(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{ background: activeTab === tab.id ? `${tab.accent}15` : "transparent", color: activeTab === tab.id ? tab.accent : "rgba(255,255,255,0.4)", border: activeTab === tab.id ? `1px solid ${tab.accent}30` : "1px solid transparent" }}>
                  <tab.icon size={13} /> {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              <div className="relative" style={{ width: 320 }}>
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Поиск ${currentTab?.label?.toLowerCase()}...`}
                  className="w-full h-9 rounded-xl text-[12px] pl-9 pr-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" />}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedModDetail ? (
                /* Detail view */
                <div>
                  <button onClick={() => { setSelectedModDetail(null); setModVersions([]); }}
                    className="flex items-center gap-1.5 text-[12px] mb-4 transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
                    <ArrowLeft size={14} /> Назад к поиску
                  </button>
                  <div className="flex items-start gap-4 mb-5">
                    {selectedModDetail.icon_url && <img src={selectedModDetail.icon_url} alt="" className="w-16 h-16 rounded-2xl flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-[22px] font-black text-white leading-tight">{selectedModDetail.title}</h2>
                      <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{formatDownloads(selectedModDetail.downloads)} загрузок · {selectedModDetail.author}</p>
                      <p className="text-[12px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{truncateText(selectedModDetail.description, 240)}</p>
                      {selectedModDetail.website_url && <a href={selectedModDetail.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] mt-2" style={{ color: "#60a5fa" }}>Modrinth <ExternalLink size={10} /></a>}
                    </div>
                  </div>
                  <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Версии</p>
                  {loadingVersions ? (
                    <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /></div>
                  ) : modVersions.length === 0 ? (
                    <p className="text-[12px] text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Нет версий для {draft.mcVersion}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {modVersions.map(ver => {
                        const added = isItemAdded(selectedModDetail.project_id);
                        return (
                          <div key={ver.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-white">{ver.version_number}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ background: ver.version_type === "release" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)", color: ver.version_type === "release" ? "#4ade80" : "#fbbf24" }}>{ver.version_type}</span>
                              </div>
                              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{ver.date_published?.slice(0, 10)} · {ver.game_versions?.join(", ")}</p>
                            </div>
                            <button onClick={() => addModFromVersion(selectedModDetail, ver)} disabled={added}
                              className="h-8 px-4 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                              style={{ background: added ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, #9333ea, #a855f7)", color: added ? "#4ade80" : "#fff" }}>
                              {added ? <><Check size={12} className="inline mr-1" />Добавлен</> : <><Download size={12} className="inline mr-1" />Добавить</>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {!searchQuery && popularResults.length > 0 && (
                    <p className="text-[11px] uppercase tracking-widest font-semibold mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Популярные {currentTab?.label?.toLowerCase()}
                    </p>
                  )}
                  {displayItems.length === 0 && !searching && (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <Search size={24} style={{ color: "rgba(255,255,255,0.15)" }} />
                      </div>
                      <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>{searchQuery ? "Ничего не найдено" : "Начни поиск в Modrinth"}</p>
                      <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Найди и установи моды, ресурспаки и шейдеры</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {displayItems.map(hit => {
                      const added = isItemAdded(hit.project_id);
                      return (
                        <motion.button key={hit.project_id} onClick={() => openModDetail(hit)} whileHover={{ scale: 1.01 }} className="text-left rounded-2xl p-4 transition-all"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
                          <div className="flex items-start gap-3">
                            {hit.icon_url && <img src={hit.icon_url} alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[13px] font-bold text-white truncate">{hit.title}</p>
                                {added && <Check size={11} style={{ color: "#4ade80", flexShrink: 0 }} />}
                              </div>
                              <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{hit.author} · {formatDownloads(hit.downloads)}</p>
                            </div>
                          </div>
                          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{truncateText(hit.description, 100)}</p>
                        </motion.button>
                      );
                    })}
                  </div>
                  {searching && <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" /></div>}
                  {hasMore && displayItems.length > 0 && !searching && (
                    <button onClick={loadMore} className="w-full mt-4 h-10 rounded-xl text-[12px] font-semibold transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>Загрузить ещё</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : !selected ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          <div className="text-[64px] font-display font-black leading-none tracking-tight text-white text-center" style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}>SB GAMES</div>
          <div className="text-[56px] font-display font-black leading-none tracking-tight uppercase text-center" style={{ color: "rgba(255,255,255,0.22)" }}>КОМПЛЕКС<br />СЕРВЕРОВ</div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col" style={{ paddingLeft: 252 }}>
          <div className="pt-8 pr-10 pl-10 flex flex-col gap-3">
            <h1 className="text-[62px] font-display font-black leading-none tracking-tight text-white" style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}>{selected.name}</h1>
            <p className="text-[13px] leading-[1.8] max-w-[500px]" style={{ color: "rgba(255,255,255,0.55)" }}>{selected.description}</p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5 pb-8 pr-8">
            <button onClick={onOpenCommunity} className="flex items-center gap-2.5 h-[44px] px-5 rounded-2xl transition-all duration-150 flex-shrink-0" style={{ background: "rgba(255,255,255,0.08)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}>
              <UsersThree size={17} weight="regular" style={{ color: "rgba(255,255,255,0.7)" }} />
              <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>Сообщество</span>
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 rounded-2xl px-3.5 h-[44px]" style={{ background: "rgba(255,255,255,0.08)" }}>
              <img src="/money.png" alt="" className="w-5 h-5 flex-shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.6))" }} onError={e => e.currentTarget.style.display = "none"} />
              <span className="text-[14px] font-black text-white tabular-nums">{(user?.balance ?? 0).toLocaleString("en-US")}</span>
              <span className="text-[11px] font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>SBT</span>
            </div>
            {mcRunning ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 h-[44px] px-6 rounded-2xl font-black text-[13px] tracking-widest uppercase" style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> В ИГРЕ
                </div>
                <motion.button onClick={handleClose} whileTap={{ scale: 0.95 }} className="h-[44px] px-4 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#fca5a5"; }}><X size={14} /></motion.button>
              </div>
            ) : (
              <motion.button onClick={handlePlay} data-launch-btn disabled={launching || launched || !selected} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-3 h-[44px] rounded-2xl font-black text-[14px] tracking-widest uppercase disabled:opacity-60 transition-colors duration-150"
                style={{ padding: "0 32px", background: launched ? "#16a34a" : "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(59,130,246,0.9))", color: "#fff", boxShadow: launched ? "0 0 24px rgba(22,163,74,0.4)" : "0 0 24px rgba(37,99,235,0.4)" }}
                onMouseEnter={e => { if (!launching && !launched && selected) e.currentTarget.style.background = "linear-gradient(135deg, rgba(29,78,216,0.95), rgba(37,99,235,0.9))"; }}
                onMouseLeave={e => { if (!launching && !launched) e.currentTarget.style.background = launched ? "#16a34a" : "#2563EB"; }}>
                {launching ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> ЗАПУСК...</> : launched ? <>✓ ЗАПУЩЕНО</> : <>ИГРАТЬ <Play size={16} weight="fill" /></>}
              </motion.button>
            )}
            <motion.button onClick={() => setShowSettings(true)} whileTap={{ scale: 0.9 }} className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}><Settings size={15} /></motion.button>
            <AnimatePresence>
              {launchError && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[480px] rounded-xl px-4 py-3 text-[12px]"
                  style={{ background: "rgba(220,38,38,0.15)", color: "#fca5a5", border: "1px solid rgba(220,38,38,0.3)" }}>
                  <p className="font-bold mb-1">Не удалось запустить</p>
                  <p className="text-[11px] opacity-80">{launchError}</p>
                  <button onClick={() => setLaunchError(null)} className="absolute top-1 right-2 text-[14px] opacity-50 hover:opacity-100" style={{ color: "#fca5a5" }}>×</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }} transition={{ duration: 0.18 }}
              className="w-[420px] rounded-2xl p-5 flex flex-col gap-4" style={{ background: "rgba(10,10,14,0.98)", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-white">Настройки запуска</p>
                <button onClick={() => setShowSettings(false)} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}><X size={12} /></button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}><HardDrive size={11} />Оперативная память</span>
                  <span className="text-[12px] font-bold text-white tabular-nums">{ramGb} ГБ</span>
                </div>
                <input type="range" min="1" max="16" step="1" value={ramGb} onChange={e => setRamGb(parseInt(e.target.value))} className="w-full accent-blue-500" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}><Cpu size={11} />Путь к Java</span>
                <input value={javaPath} onChange={e => setJavaPath(e.target.value)} placeholder="автодетект"
                  className="w-full rounded-xl text-[12px] px-3 py-2 outline-none" style={{ background: "rgba(255,255,255,0.05)", color: "#fff", fontFamily: "monospace" }} />
              </div>
              <button onClick={() => setShowSettings(false)} className="w-full h-9 rounded-xl text-[12px] font-semibold text-white" style={{ background: "rgba(37,99,235,0.7)" }}>Сохранить</button>
            </motion.div>
          </motion.div>
        )}

        {showModpackModal && modpackReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={e => { if (e.target === e.currentTarget) handleModpackCancel(); }}>
            <motion.div initial={{ scale: 0.92, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="w-full max-w-[520px] rounded-3xl p-6 flex flex-col gap-4"
              style={{ background: "linear-gradient(160deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,0.98) 100%)", border: "1px solid rgba(239,68,68,0.35)", boxShadow: "0 0 80px rgba(239,68,68,0.25), 0 24px 60px rgba(0,0,0,0.7)" }}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}><AlertTriangle size={22} weight="fill" style={{ color: "#fca5a5" }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white">Обнаружена подозрительная активность</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>Мод-пак скомпрометирован. Запуск заблокирован.</p>
                </div>
                <button onClick={handleModpackCancel} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}><X size={14} /></button>
              </div>
              <div className="rounded-2xl p-3 max-h-[280px] overflow-y-auto" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {modpackReport.rejected?.length > 0 && modpackReport.rejected.map((issue, i) => (
                  <div key={i} className="rounded-lg p-2.5 mb-1.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <div className="flex items-center gap-2"><ShieldAlert size={11} style={{ color: "#fca5a5", flexShrink: 0 }} /><span className="text-[11px] font-bold text-white font-mono truncate">{issue.name}</span></div>
                    <p className="text-[10px] mt-1 ml-5" style={{ color: "rgba(255,255,255,0.5)" }}>{issue.detail}</p>
                  </div>
                ))}
                {modpackReport.missing?.length > 0 && modpackReport.missing.map((issue, i) => (
                  <div key={i} className="rounded-lg p-2 mb-1" style={{ background: "rgba(147,197,253,0.06)", border: "1px solid rgba(147,197,253,0.12)" }}>
                    <span className="text-[11px] font-mono text-white">{issue.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleModpackCancel} className="flex-1 h-11 rounded-xl text-[12px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>Отмена</button>
                <button onClick={handleModpackClean} className="flex-1 h-11 rounded-xl text-[12px] font-bold text-white" style={{ background: "#2563eb" }}>Удалить и продолжить</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {guardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={e => { if (e.target === e.currentTarget) setGuardModal(null); }}>
            <motion.div initial={{ scale: 0.92, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="w-full max-w-[480px] rounded-3xl p-6 flex flex-col gap-4"
              style={{ background: "linear-gradient(160deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,0.98) 100%)", border: "1px solid rgba(239,68,68,0.4)", boxShadow: "0 0 80px rgba(239,68,68,0.3), 0 24px 60px rgba(0,0,0,0.7)" }}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}><ShieldAlert size={22} weight="fill" style={{ color: "#fca5a5" }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white">Защита SB Games</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{guardModal.reason === "inject" ? "Инжект DLL" : "Изменения в мод-паке"}</p>
                </div>
                <button onClick={() => setGuardModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}><X size={14} /></button>
              </div>
              <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-[12px] font-mono text-white break-all" style={{ lineHeight: 1.5 }}>{guardModal.detail || "—"}</p>
              </div>
              <button onClick={() => setGuardModal(null)} className="w-full h-11 rounded-xl text-[12px] font-bold text-white" style={{ background: "rgba(255,255,255,0.08)" }}>Понятно</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
