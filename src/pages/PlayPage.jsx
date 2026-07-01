import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Settings, X, Cpu, HardDrive, AlertTriangle, ShieldAlert, Info, Plus, Package, FileImage, Sparkles, Trash2, Search, Download, Check, ExternalLink, ChevronDown, ArrowLeft, MoreHorizontal, Grid3X3, List, Folder, FolderOpen, Settings2, RefreshCw, Camera, ArrowUpDown, Save, Link2, ShieldCheck } from "lucide-react";
import { UsersThree } from "@phosphor-icons/react";
import { invoke, notifyDesktop, setDiscordPresence, clearDiscordPresence, getMinecraftStatus, killMinecraft, launchInstance, instanceCreate, instanceDelete, instanceOpenFolder, importMrpack } from "../lib/tauri.js";
import { pushLocalActivity } from "../components/RecentActivityCard.jsx";
import { searchMods, searchResourcePacks, searchShaders, getPopular, getProjectVersions, getProject, downloadUrl, formatDownloads, truncateText, getMcVersions, getModrinthLoaders, getLatestVersions } from "../lib/modrinth.js";

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
  { id: "mods", label: "Моды", icon: Package, accent: "#60a5fa", type: "mod" },
  { id: "resourcepacks", label: "Ресурспаки", icon: FileImage, accent: "#60a5fa", type: "resourcepack" },
  { id: "shaders", label: "Шейдеры", icon: Sparkles, accent: "#60a5fa", type: "shader" },
];

const FABRIC_API_PROJECT = "P7dR8mSH";

// Кастомный дропдаун в стиле лаунчера (единый синий акцент, без нативного <select>).
function CustomDropdown({ value, onChange, options, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const selected = options.find(o => o.value === value);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(o => !o)}
        className="w-full rounded-xl text-[12px] px-3 py-2.5 flex items-center justify-between gap-2 outline-none cursor-pointer transition-all"
        style={{ background: "rgba(255,255,255,0.05)", color: "#e5e7eb" }}>
        <span className="truncate">{selected ? selected.label : "—"}</span>
        <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 max-h-52 overflow-y-auto"
            style={{ background: "rgba(20,20,28,0.98)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
            {options.map(o => {
              const active = o.value === value;
              return (
                <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                  className="w-full text-left text-[12px] px-3 py-2 flex items-center justify-between gap-2 transition-colors"
                  style={{ background: active ? "rgba(96,165,250,0.12)" : "transparent", color: active ? "#93c5fd" : "rgba(255,255,255,0.75)" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <span className="truncate">{o.label}</span>
                  {active && <Check size={12} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [builderTab, setBuilderTab] = useState("overview");
  const [draft, setDraft] = useState({ name: "", mcVersion: "1.20.1", loader: "forge", mods: [], resourcePacks: [], shaders: [], screenshots: [] });

  // Dynamic versions & loaders from API
  const [mcVersions, setMcVersions] = useState(FALLBACK_VERSIONS);
  const [loaders, setLoaders] = useState([{ id: "forge", label: "Forge" }, { id: "fabric", label: "Fabric" }, { id: "quilt", label: "Quilt" }, { id: "neoforge", label: "NeoForge" }, { id: "all", label: "Все" }]);
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

  // Feature: version comparison
  const [modLatestVersions, setModLatestVersions] = useState({});

  // Feature: category filter
  const [categoryFilter, setCategoryFilter] = useState(null);

  // Feature: dependency suggestion modal
  const [depModal, setDepModal] = useState(null);

  // Feature: Update All / Backup
  const [updatingAll, setUpdatingAll] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [importFlash, setImportFlash] = useState(false);

  // Feature: Profiles
  const [profiles, setProfiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sbg_modpack_profiles") || "[]"); } catch { return []; }
  });
  const [activeProfile, setActiveProfile] = useState(() => localStorage.getItem("sbg_active_profile") || "");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Sidebar menu (ДОП)
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [sidebarMenuTab, setSidebarMenuTab] = useState("servers"); // servers | modpacks
  const sidebarMenuRef = useRef(null);

  // Screenshots for modpack
  const [screenshotInput, setScreenshotInput] = useState("");

  // Server sync
  const [syncResult, setSyncResult] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Compatibility warnings
  const [compatWarnings, setCompatWarnings] = useState([]);

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
  useEffect(() => { localStorage.setItem("sbg_modpack_profiles", JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => { if (activeProfile) localStorage.setItem("sbg_active_profile", activeProfile); else localStorage.removeItem("sbg_active_profile"); }, [activeProfile]);
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e) => { if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setShowProfileMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProfileMenu]);
  useEffect(() => {
    localStorage.setItem("sbg_play_showModpackModal", showModpackModal ? "1" : "0");
    if (!showModpackModal) localStorage.removeItem("sbg_play_modpackReport");
  }, [showModpackModal]);
  useEffect(() => { if (modpackReport) localStorage.setItem("sbg_play_modpackReport", JSON.stringify(modpackReport)); }, [modpackReport]);
  useEffect(() => { if (guardModal) localStorage.setItem("sbg_play_guardModal", JSON.stringify(guardModal)); else localStorage.removeItem("sbg_play_guardModal"); }, [guardModal]);
  useEffect(() => { localStorage.setItem("sbg_custom_modpacks", JSON.stringify(customModpacks)); }, [customModpacks]);

  // Миграция: старые модпаки без instanceId → создать инстансы на бэке.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const legacy = customModpacks.filter(m => !m.instanceId && !m.id?.length?.match(/^[0-9a-f]{8}-/));
      if (!legacy.length) return;
      for (const mp of legacy) {
        if (cancelled) break;
        try {
          const allMods = [
            ...(mp.mods || []).map(m => ({ ...m, kind: "mods" })),
            ...(mp.resourcePacks || []).map(m => ({ ...m, kind: "resourcepacks" })),
            ...(mp.shaders || []).map(m => ({ ...m, kind: "shaderpacks" })),
          ];
          const cfg = {
            id: "", name: mp.name || "Unnamed", mcVersion: mp.mcVersion || "1.20.1",
            loader: (mp.loader || "vanilla").toLowerCase(), loaderVersion: mp.loaderVersion || null,
            javaVersion: 0, minRamMb: 512, maxRamMb: 4096, jvmArgs: [], mods: allMods,
          };
          const instanceId = await instanceCreate(cfg);
          if (!cancelled) {
            setCustomModpacks(prev => prev.map(p =>
              p.id === mp.id ? { ...p, instanceId, id: instanceId } : p
            ));
          }
        } catch (e) { console.warn("[migration] skip", mp.id, e); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch MC versions and loaders from API
  useEffect(() => {
    (async () => {
      setLoadingMcData(true);
      try {
        const [versions, modrinthLoaders] = await Promise.all([getMcVersions(), getModrinthLoaders()]);
        if (versions?.length) setMcVersions(versions);
        if (modrinthLoaders?.length) {
          const ALLOWED_LOADERS = ["forge", "fabric", "quilt", "neoforge"];
          const mapped = modrinthLoaders
            .filter(l => ALLOWED_LOADERS.includes(l.slug))
            .map(l => ({ id: l.slug, label: l.name || l.slug }));
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
      setDiscordPresence("SB Games", "Выбирает сервер", {
        largeImage: "logo", largeText: "Minecraft с модами",
        smallImage: "online", smallText: user?.username || "Игрок",
        startTimestamp: Math.floor(Date.now() / 1000),
        buttons: [{ label: "Начать играть", url: "https://games.sb-capital.group" }],
      });
      return;
    }
    window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: selected.id } }));
    setDiscordPresence(selected.name, "Готов к запуску", {
      largeImage: selected.id,
      largeText: selected.description || selected.name,
      smallImage: "online",
      smallText: user?.username || "Игрок",
      startTimestamp: Math.floor(Date.now() / 1000),
      buttons: [{ label: "Начать играть", url: "https://games.sb-capital.group" }],
    });
  }, [selected]);

  // Discord RPC cycling — живой статус каждые 8 сек
  useEffect(() => {
    if (selected) return; // не крутим если сервер уже выбран
    const lines = [
      "Выбери сервер для игры",
      `${SERVERS.length} серверов доступно`,
      `${friends.filter(f => onlineIds.has(f.id)).length} друзей онлайн`,
      "Играй с друзьями",
      "Новые мини-игры каждую неделю",
    ];
    let idx = 0;
    const t = setInterval(() => {
      idx = (idx + 1) % lines.length;
      setDiscordPresence("SB Games", lines[idx], {
        largeImage: "logo", largeText: "Minecraft с модами",
        smallImage: "online", smallText: user?.username || "Игрок",
        startTimestamp: Math.floor(Date.now() / 1000),
        buttons: [{ label: "Начать играть", url: "https://games.sb-capital.group" }],
      });
    }, 8000);
    return () => clearInterval(t);
  }, [selected, user?.id, friends, onlineIds]);

  useEffect(() => {
    setDiscordPresence("SB Games", "Выбирает сервер", {
      largeImage: "logo", largeText: "Minecraft с модами",
      smallImage: "online", smallText: user?.username || "Игрок",
      startTimestamp: Math.floor(Date.now() / 1000),
      buttons: [{ label: "Начать играть", url: "https://games.sb-capital.group" }],
    });
    return () => { window.dispatchEvent(new CustomEvent("serverChange", { detail: { id: null } })); };
  }, []);

  // ДОП-меню закрывается кликом по затемнению или кнопке X (см. модалку ниже)

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

  // Auto-check compatibility when builder opens or version/loader changes
  useEffect(() => {
    if (!showBuilder) return;
    const timer = setTimeout(() => checkCompatibility(), 600);
    return () => clearTimeout(timer);
  }, [showBuilder, draft.mcVersion, draft.loader, draft.mods.length]);

  // Fetch latest versions for installed mods
  useEffect(() => {
    if (!showBuilder) return;
    const allIds = [...draft.mods, ...draft.resourcePacks, ...draft.shaders]
      .filter(m => !m.local && !m.auto && m.projectId)
      .map(m => m.projectId);
    const unique = [...new Set(allIds)];
    if (unique.length === 0) return;
    let cancelled = false;
    (async () => {
      const latest = await getLatestVersions(unique, draft.mcVersion, draft.loader);
      if (!cancelled) setModLatestVersions(latest);
    })();
    return () => { cancelled = true; };
  }, [showBuilder, draft.mcVersion, draft.loader, draft.mods.length, draft.resourcePacks.length, draft.shaders.length]);

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
      categories: hit.categories || [], disabled: false,
    };
    const key = activeTab === "mods" ? "mods" : activeTab === "resourcepacks" ? "resourcePacks" : "shaders";
    const exists = draft[key].some(m => m.projectId === item.projectId);
    if (!exists) {
      setDraft(prev => ({ ...prev, [key]: [...prev[key], item] }));
      // Check required dependencies
      const requiredDeps = (version.dependencies || []).filter(d => d.dependency_type === "required" && d.project_id);
      const missing = requiredDeps.filter(d => !isItemAdded(d.project_id));
      if (missing.length > 0) {
        setDepModal({ parent: hit.title, deps: missing });
      }
    }
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

  // ── Server sync: fetch /api/mods/manifest and compare ──
  // TODO: Rust backend — добавить endpoint /api/mods/manifest который возвращает
  // актуальный манифест модов с сервера (список модов, версий, хешей).
  // Сейчас fetch идёт напрямую на games.sb-capital.group, но для instance-level
  // синхронизации нужен Rust-side манифест с хранением в instance config.
  const syncWithServer = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("https://games.sb-capital.group/api/mods/manifest");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      const serverMods = manifest.mods || manifest.files || [];
      const localIds = new Set([
        ...draft.mods.map(m => m.projectId || m.slug),
        ...draft.resourcePacks.map(m => m.projectId || m.slug),
        ...draft.shaders.map(m => m.projectId || m.slug),
      ]);
      const serverIds = new Set(serverMods.map(m => m.projectId || m.slug || m.id));
      const missing = serverMods.filter(m => !localIds.has(m.projectId || m.slug || m.id));
      const extra = [...localIds].filter(id => !serverIds.has(id));
      setSyncResult({ missing, extra, total: serverMods.length });
    } catch (err) {
      setSyncResult({ error: String(err) });
    }
    setSyncing(false);
    setTimeout(() => setSyncResult(null), 4000);
  };

  // ── Compatibility check via Modrinth API ──
  // TODO: Rust backend — кешировать результаты проверки совместимости
  // чтобы не делать запрос к Modrinth API при каждом открытии билдера.
  // Также можно добавить offline-проверку по локальному кешу версий.
  const checkCompatibility = async () => {
    const allMods = [...draft.mods, ...draft.resourcePacks, ...draft.shaders].filter(m => m.projectId && !m.auto && !m.local);
    if (allMods.length === 0) { setCompatWarnings([]); return; }
    const warnings = [];
    // TODO: batch check — currently checks first 10 mods to avoid rate limiting
    const toCheck = allMods.slice(0, 10);
    for (const mod of toCheck) {
      try {
        const res = await fetch(`https://api.modrinth.com/v2/project/${mod.projectId}/version?game_versions=["${draft.mcVersion}"]&loaders=["${draft.loader}"]`);
        if (res.ok) {
          const versions = await res.json();
          if (versions.length === 0) {
            warnings.push({ title: mod.title, slug: mod.slug, reason: `Нет версий для ${draft.mcVersion} (${draft.loader})` });
          }
        }
      } catch {}
    }
    setCompatWarnings(warnings);
  };

  const removeItem = (key, idx) => {
    setDraft(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const toggleDisabled = (key, idx) => {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].map((item, i) => i === idx ? { ...item, disabled: !item.disabled } : item),
    }));
  };

  const addAllDeps = async () => {
    if (!depModal) return;
    for (const dep of depModal.deps) {
      if (isItemAdded(dep.project_id)) continue;
      try {
        const versions = await getProjectVersions(dep.project_id, draft.mcVersion, draft.loader);
        if (versions.length) {
          const ver = versions[0];
          const url = downloadUrl(ver);
          const item = {
            projectId: dep.project_id, slug: dep.slug || dep.project_id, title: dep.file_name || dep.project_id,
            icon_url: null, version: ver.version_number, downloads: 0, downloadUrl: url,
            filename: ver.files?.[0]?.filename || `${dep.project_id}.jar`,
            categories: [], disabled: false,
          };
          setDraft(prev => ({ ...prev, mods: [...prev.mods, item] }));
        }
      } catch {}
    }
    setDepModal(null);
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
          categories: [], disabled: false,
        };
        setDraft(prev => ({ ...prev, mods: [apiItem, ...prev.mods] }));
      }
    }
  }, [draft.loader, showBuilder]);

  const saveModpack = async () => {
    if (!draft.name.trim()) return;
    const allMods = [
      ...(draft.mods || []).filter(m => !m.disabled).map(m => ({ ...m, kind: "mods" })),
      ...(draft.resourcePacks || []).filter(m => !m.disabled).map(m => ({ ...m, kind: "resourcepacks" })),
      ...(draft.shaders || []).filter(m => !m.disabled).map(m => ({ ...m, kind: "shaderpacks" })),
    ];
    const cfg = {
      id: draft.instanceId || "", // пустой → бэк сгенерирует uuid
      name: draft.name.trim(),
      mcVersion: draft.mcVersion,
      loader: (draft.loader || "vanilla").toLowerCase(),
      loaderVersion: draft.loaderVersion || null,
      javaVersion: 0, // бэк сам выводит из mcVersion
      minRamMb: 512,
      maxRamMb: (ramGb || 4) * 1024,
      jvmArgs: [],
      mods: allMods,
    };
    try {
      const instanceId = await instanceCreate(cfg);
      const mp = {
        ...draft,
        name: draft.name.trim(),
        instanceId,
        id: instanceId,
        mods: draft.mods || [],
        resourcePacks: draft.resourcePacks || [],
        shaders: draft.shaders || [],
        screenshots: draft.screenshots || [],
      };
      setCustomModpacks(prev => {
        const existing = prev.findIndex(p => p.id === mp.id);
        if (existing >= 0) { const copy = [...prev]; copy[existing] = mp; return copy; }
        return [...prev, mp];
      });
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 800);
      setShowBuilder(false);
    } catch (err) {
      console.error("[saveModpack]", err);
      setLaunchError(String(err));
    }
  };

  const deleteModpack = async (id) => {
    try { await instanceDelete(id); } catch { /* idempotent */ }
    setCustomModpacks(prev => prev.filter(p => p.id !== id));
    if (selected?.id === `custom_${id}`) setSelected(null);
  };

  const openBuilder = (existing) => {
    setDraft(existing || { name: "", mcVersion: "1.20.1", loader: "forge", mods: [], resourcePacks: [], shaders: [], instanceId: "", loaderVersion: null, launchCount: 0, lastLaunchedAt: null });
    setSelectedModDetail(null);
    setSearchQuery("");
    setActiveTab("mods");
    setCategoryFilter(null);
    setBuilderTab("overview");
    setShowBuilder(true);
    setSelected(null);
  };

  const selectCustom = (mp) => {
    setSelected({ id: `custom_${mp.id}`, name: mp.name, subtitle: `${mp.loader.toUpperCase()} ${mp.mcVersion}`,
      description: `Моды: ${mp.mods.length} | Ресурспаки: ${mp.resourcePacks.length} | Шейдеры: ${mp.shaders.length}${mp.launchCount ? ` | Запусков: ${mp.launchCount}` : ""}${mp.lastLaunchedAt ? ` | Последний: ${new Date(mp.lastLaunchedAt).toLocaleDateString("ru-RU")}` : ""}`,
      bg: "linear-gradient(160deg, #0a1426 0%, #050b18 60%, #000 100%)", accent: "#60a5fa", customPack: mp });
    setShowBuilder(false);
    setShowSidebarMenu(false);
  };

  // ── Feature: Backup before update ──
  const backupCurrentMods = () => {
    const key = `sbg_backup_${draft.name || "unnamed"}_${Date.now()}`;
    const backup = { name: draft.name, mcVersion: draft.mcVersion, loader: draft.loader, mods: draft.mods, resourcePacks: draft.resourcePacks, shaders: draft.shaders, timestamp: Date.now() };
    try {
      const existing = JSON.parse(localStorage.getItem("sbg_modpack_backups") || "[]");
      existing.push({ key, ...backup });
      localStorage.setItem("sbg_modpack_backups", JSON.stringify(existing.slice(-20)));
    } catch {}
    return backup;
  };

  // ── Feature: Update All ──
  const updateAllMods = async () => {
    setUpdatingAll(true);
    backupCurrentMods();
    try {
      const keys = ["mods", "resourcePacks", "shaders"];
      for (const key of keys) {
        const items = draft[key];
        if (!items?.length) continue;
        const updated = [...items];
        for (let i = 0; i < updated.length; i++) {
          const item = updated[i];
          if (item.local || item.auto || !item.projectId) continue;
          try {
            const versions = await getProjectVersions(item.projectId, draft.mcVersion, draft.loader);
            if (versions.length > 0) {
              const latest = versions[0];
              const url = downloadUrl(latest);
              updated[i] = { ...item, version: latest.version_number, downloadUrl: url, filename: latest.files?.[0]?.filename || item.filename };
            }
          } catch {}
        }
        setDraft(prev => ({ ...prev, [key]: updated }));
      }
    } catch (err) { console.error("[updateAllMods]", err); }
    setUpdatingAll(false);
  };

  // ── Feature: Export modpack ──
  const exportModpack = () => {
    const data = { name: draft.name, mcVersion: draft.mcVersion, loader: draft.loader, mods: draft.mods, resourcePacks: draft.resourcePacks, shaders: draft.shaders, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(draft.name || "modpack").replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Feature: Import from URL ──
  const importFromUrl = async () => {
    const raw = importUrl.trim();
    if (!raw) return;
    setImportingUrl(true);
    try {
      let slug = raw;
      const match = raw.match(/modrinth\.com\/(mod|plugin|resourcepack|shader)\/([^/?#]+)/);
      if (match) slug = match[2];
      else if (raw.includes("/")) slug = raw.split("/").pop().split("?")[0];
      const project = await getProject(slug);
      if (!project) return;
      const versions = await getProjectVersions(project.id, draft.mcVersion, draft.loader);
      const version = versions.length > 0 ? versions[0] : null;
      const tabType = project.project_type === "resourcepack" ? "resourcePacks" : project.project_type === "shader" ? "shaders" : "mods";
      const item = {
        projectId: project.id, slug: project.slug, title: project.title, icon_url: project.icon_url,
        version: version?.version_number || "?", downloads: project.downloads,
        downloadUrl: version ? downloadUrl(version) : null,
        filename: version?.files?.[0]?.filename || `${project.slug}.jar`,
      };
      setDraft(prev => {
        const exists = prev[tabType].some(m => m.projectId === item.projectId);
        if (exists) return prev;
        return { ...prev, [tabType]: [...prev[tabType], item] };
      });
      setImportUrl("");
      setImportFlash(true);
      setTimeout(() => setImportFlash(false), 1200);
    } catch (err) { console.error("[importFromUrl]", err); }
    setImportingUrl(false);
  };

  // ── Feature: Profiles ──
  const saveProfile = () => {
    if (!draft.name.trim()) return;
    const profile = { name: draft.name.trim(), mcVersion: draft.mcVersion, loader: draft.loader, mods: draft.mods, resourcePacks: draft.resourcePacks, shaders: draft.shaders, savedAt: Date.now() };
    setProfiles(prev => {
      const idx = prev.findIndex(p => p.name === profile.name);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = profile; return copy; }
      return [...prev, profile];
    });
    setActiveProfile(profile.name);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 800);
  };

  const loadProfile = (name) => {
    const profile = profiles.find(p => p.name === name);
    if (!profile) return;
    setDraft(prev => ({ ...prev, name: profile.name, mcVersion: profile.mcVersion, loader: profile.loader, mods: profile.mods || [], resourcePacks: profile.resourcePacks || [], shaders: profile.shaders || [] }));
    setActiveProfile(name);
    setShowProfileMenu(false);
  };

  const deleteProfile = (name) => {
    setProfiles(prev => prev.filter(p => p.name !== name));
    if (activeProfile === name) setActiveProfile("");
  };

  const handlePlay = async () => {
    if (!selected) return;
    setLaunching(true);
    setLaunchError(null);
    await setDiscordPresence(selected.name, "Играет в Minecraft", {
      largeImage: selected.id,
      largeText: selected.description || selected.name,
      smallImage: "playing",
      smallText: user?.username || "Игрок",
      startTimestamp: Math.floor(Date.now() / 1000),
      buttons: [{ label: "Присоединиться", url: `https://games.sb-capital.group` }],
    });
    const startedAt = Date.now();
    try {
      if (selected.id?.startsWith("custom_") && selected.customPack?.instanceId) {
        const result = await launchInstance(
          selected.customPack.instanceId,
          user?.username || "Player",
          user?.uuid || "00000000-0000-0000-0000-000000000000",
          localStorage.getItem("sbgames_token") || "0",
        );
        saveSession(selected.id, user?.username);
        sessionStorage.setItem("sbg_last_session", JSON.stringify({ serverId: selected.id, startedAt }));
        await notifyDesktop("SB Games", `${result}`);
        setMcRunning(true); setLaunching(false); setLaunched(true);
        setTimeout(() => setLaunched(false), 4000);
        // Track launch history
        setCustomModpacks(prev => prev.map(p => {
          if (selected.customPack?.id === p.id) {
            return { ...p, launchCount: (p.launchCount || 0) + 1, lastLaunchedAt: Date.now() };
          }
          return p;
        }));
        return;
      }
      const result = await invoke("launch_minecraft", {
        serverId: selected.id, username: user?.username || "Player",
        token: localStorage.getItem("sbgames_token") || "0", ramGb, javaPath,
        jwt: localStorage.getItem("sbgames_token") || null,
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
    clearDiscordPresence();
  };

  function saveSession(serverId, username) {
    try { const sessions = JSON.parse(localStorage.getItem("sbgames_sessions") || "[]"); sessions.unshift({ serverId, username, time: Date.now() }); localStorage.setItem("sbgames_sessions", JSON.stringify(sessions.slice(0, 50))); } catch {}
  }

  const displayItems = (() => {
    const base = searchQuery ? searchResults : popularResults;
    if (!categoryFilter) return base;
    return base.filter(item => (item.categories || []).includes(categoryFilter));
  })();
  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="relative h-full overflow-hidden" style={{ background: "transparent" }}>
      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div key={selected ? selected.id + "_bg" : showBuilder ? "builder_bg" : "empty_bg"} className="absolute inset-0"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          {selected ? (
            <>
              {selected.image && <img src={selected.image} alt={selected.name || "Сервер"} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.25 }} onError={e => e.currentTarget.style.display = "none"} />}
              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 80%, ${selected.accent}20, transparent 60%)` }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)" }} />
            </>
          ) : showBuilder ? (
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 80%, rgba(37,99,235,0.08), transparent 60%)" }} />
          ) : (
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(8,8,12,1) 0%, rgba(12,12,18,1) 100%)" }} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <div className="absolute left-0 top-0 bottom-0 z-20" style={{ width: 220, padding: "16px 0 16px 16px" }}>
        <div className="h-full rounded-2xl flex flex-col overflow-hidden"
          style={{ background: "rgba(8,8,8,0.92)", boxShadow: "0 8px 48px rgba(0,0,0,0.8)", backdropFilter: "blur(24px)" }}>
          <div className="px-4 pt-4 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0"><img src="/logo.jpg" alt="SBGames" className="w-full h-full object-cover" /></div>
              <p className="text-[13px] font-black tracking-wide" style={{ background: "linear-gradient(135deg, #3b82f6, #60a5fa, #93c5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>SBGames</p>
            </div>
            <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Начните играть</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
            {SERVERS.map((srv, idx) => {
              const active = selected?.id === srv.id && !showBuilder;
              const online = serverOnline[srv.id] || 0;
              return (
                <motion.div key={srv.id} className="relative group"
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}>
                  <button onClick={() => { setShowBuilder(false); setShowSidebarMenu(false); setSelected(selected?.id === srv.id && !showBuilder ? null : srv); }}
                    className="w-full text-left focus:outline-none">
                    <motion.div
                      animate={{ opacity: active ? 1 : 0.5 }}
                      whileHover={{ opacity: 1, scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ duration: 0.2 }}
                      className="relative rounded-xl overflow-hidden"
                      style={{
                        boxShadow: active
                          ? `0 0 20px ${srv.accent}35, 0 4px 24px ${srv.accent}18, inset 0 1px 0 ${srv.accent}15`
                          : "none",
                      }}>
                      <div className="h-[90px] relative overflow-hidden" style={{ background: srv.bg }}>
                        {srv.image && (
                          <motion.img src={srv.image} alt={srv.name || "Сервер"}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy" onError={e => e.currentTarget.style.display = "none"}
                            whileHover={{ scale: 1.08 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {active && <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 100%, ${srv.accent}22, transparent 65%)` }} />}
                        {active && (
                          <motion.div layoutId="srv-bar"
                            className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full"
                            style={{ background: `linear-gradient(90deg, transparent, ${srv.accent}, transparent)` }}
                            transition={{ type: "spring", stiffness: 400, damping: 35 }}
                          />
                        )}
                        <div className="absolute bottom-2.5 left-3">
                          <p className="text-[12px] font-black text-white tracking-wide leading-none">{srv.name}</p>
                          <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{srv.subtitle}</p>
                        </div>
                        {online > 0 && (
                          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                              animate={{ boxShadow: ["0 0 0 0 rgba(74,222,128,0.5)", "0 0 0 4px rgba(74,222,128,0)"] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                            />
                            <span className="text-[9px] font-bold text-green-400">{online}</span>
                          </motion.div>
                        )}

                      </div>
                    </motion.div>
                  </button>
                </motion.div>
              );
            })}

            {/* Кастомные сборки в основном списке */}
            {customModpacks.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-1 pt-1 pb-0.5">
                  <Folder size={9} style={{ color: "rgba(96,165,250,0.6)" }} />
                  <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>Мои сборки</p>
                </div>
                {customModpacks.map(mp => {
                  const activeC = selected?.id === `custom_${mp.id}` && !showBuilder;
                  return (
                    <div key={mp.id} className="relative group/mp">
                      <button onClick={() => selectCustom(mp)} className="w-full text-left focus:outline-none">
                        <motion.div animate={{ opacity: activeC ? 1 : 0.55 }} whileHover={{ opacity: activeC ? 1 : 0.8 }} transition={{ duration: 0.15 }}
                          className="relative rounded-xl overflow-hidden h-[52px] flex items-center gap-2.5 px-2.5"
                          style={{ background: activeC ? "rgba(37,99,235,0.14)" : "rgba(255,255,255,0.03)",
                            boxShadow: activeC ? "0 0 12px rgba(37,99,235,0.35), 0 4px 16px rgba(37,99,235,0.15)" : "none" }}>
                          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(59,130,252,0.14))" }}>
                            <FolderOpen size={15} style={{ color: "rgba(147,197,253,0.95)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-white truncate leading-tight">{mp.name}</p>
                            <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{mp.loader.toUpperCase()} {mp.mcVersion} · {mp.mods.length} модов{mp.launchCount ? ` · ${mp.launchCount} запусков` : ""}</p>
                          </div>
                        </motion.div>
                      </button>
                      {/* Hover actions: edit / delete */}
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/mp:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); openBuilder(mp); }}
                          className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/10" title="Редактировать">
                          <Settings size={10} style={{ color: "rgba(255,255,255,0.55)" }} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteModpack(mp.id); }}
                          className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-red-500/15" title="Удалить">
                          <Trash2 size={10} style={{ color: "rgba(239,68,68,0.7)" }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer: Create modpack (primary) + ДОП (icon button) */}
          <div className="px-2.5 pt-1 pb-2.5 flex-shrink-0 flex items-center gap-2 relative" ref={sidebarMenuRef}>
            <button onClick={() => openBuilder(null)} className="flex-1 text-left focus:outline-none">
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.985 }}
                className="relative rounded-xl overflow-hidden h-[38px] flex items-center gap-2 px-2.5"
                style={{
                  background: showBuilder
                    ? "linear-gradient(135deg, rgba(29,78,216,0.95), rgba(37,99,235,0.9))"
                    : "rgba(255,255,255,0.05)",
                  boxShadow: showBuilder ? "0 0 16px rgba(37,99,235,0.4)" : "none",
                }}>
                <Plus size={14} style={{ color: showBuilder ? "#fff" : "rgba(255,255,255,0.7)" }} />
                <span className="text-[11px] font-bold truncate" style={{ color: showBuilder ? "#fff" : "rgba(255,255,255,0.85)" }}>Создать сборку</span>
              </motion.div>
            </button>
            <button onClick={() => setShowSidebarMenu(!showSidebarMenu)} title="Дополнительно"
              className="w-[38px] h-[38px] rounded-xl flex items-center justify-center transition-all flex-shrink-0"
              style={{
                background: showSidebarMenu ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
                color: showSidebarMenu ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.55)",
              }}
              onMouseEnter={e => { if (!showSidebarMenu) { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; } }}
              onMouseLeave={e => { if (!showSidebarMenu) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; } }}>
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ДОП — модальное окно с вкладками ═══ */}
      <AnimatePresence>
        {showSidebarMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={e => { if (e.target === e.currentTarget) setShowSidebarMenu(false); }}>
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }} transition={{ duration: 0.18 }}
              className="w-[460px] rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: "rgba(12,12,18,0.97)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.05)" }}>
                  <MoreHorizontal size={16} style={{ color: "rgba(255,255,255,0.6)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white leading-tight">Дополнительно</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{sidebarMenuTab === "servers" ? `${SERVERS.length} серверов` : `${customModpacks.length} сборок`}</p>
                </div>
                <button onClick={() => setShowSidebarMenu(false)} aria-label="Закрыть" className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}><X size={13} /></button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                {[
                  { id: "servers", label: "Серверы", icon: UsersThree },
                  { id: "modpacks", label: "Сборки", icon: FolderOpen },
                ].map(t => (
                  <button key={t.id} onClick={() => setSidebarMenuTab(t.id)}
                    className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-[12px] font-bold transition-all"
                    style={{
                      background: sidebarMenuTab === t.id ? "rgba(255,255,255,0.07)" : "transparent",
                      color: sidebarMenuTab === t.id ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)",
                    }}>
                    <t.icon size={13} weight={sidebarMenuTab === t.id ? "fill" : "regular"} />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                {sidebarMenuTab === "servers" ? (
                  SERVERS.map((srv, idx) => {
                    const activeS = selected?.id === srv.id && !showBuilder;
                    const online = serverOnline[srv.id] || 0;
                    return (
                      <motion.button key={srv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.03 }}
                        onClick={() => { setShowBuilder(false); setSelected(srv); setShowSidebarMenu(false); }}
                        className="group w-full rounded-xl flex items-center gap-3 px-2.5 py-2.5 text-left transition-all"
                        style={{ background: activeS ? "rgba(255,255,255,0.06)" : "transparent" }}
                        onMouseEnter={e => { if (!activeS) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e => { if (!activeS) e.currentTarget.style.background = "transparent"; }}>
                        <div className="w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden relative" style={{ background: srv.bg }}>
                          {srv.image && <img src={srv.image} alt={srv.name || "Сервер"} className="w-full h-full object-cover" loading="lazy" onError={e => e.currentTarget.style.display = "none"} />}
                          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4))" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white truncate leading-tight">{srv.name}</p>
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{srv.description}</p>
                        </div>
                        {online > 0 ? (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(34,197,94,0.1)" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
                            <span className="text-[9px] font-bold" style={{ color: "#4ade80" }}>{online}</span>
                          </div>
                        ) : activeS ? (
                          <Check size={13} style={{ color: "rgba(255,255,255,0.4)" }} />
                        ) : null}
                      </motion.button>
                    );
                  })
                ) : (
                  <>
                    {customModpacks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <FolderOpen size={22} style={{ color: "rgba(255,255,255,0.15)" }} />
                        </div>
                        <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Пока нет сборок</p>
                        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Создай свою первую сборку модов</p>
                      </div>
                    ) : (
                      customModpacks.map(mp => {
                        const activeM = selected?.id === `custom_${mp.id}` && !showBuilder;
                        return (
                          <div key={mp.id} className="group/item rounded-xl flex items-center gap-2.5 px-2.5 py-2 transition-all"
                            style={{ background: activeM ? "rgba(255,255,255,0.06)" : "transparent" }}>
                            <button onClick={() => { selectCustom(mp); setShowSidebarMenu(false); }} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
                              <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                                style={{ background: "rgba(255,255,255,0.05)" }}>
                                <FolderOpen size={15} style={{ color: "rgba(255,255,255,0.4)" }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-bold text-white truncate leading-tight">{mp.name}</p>
                                <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{mp.loader.toUpperCase()} {mp.mcVersion} · {mp.mods.length} модов{mp.launchCount ? ` · ${mp.launchCount} запусков` : ""}</p>
                              </div>
                            </button>
                            <div className="flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); openBuilder(mp); setShowSidebarMenu(false); }}
                                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                                style={{ color: "rgba(255,255,255,0.35)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"} title="Редактировать">
                                <Settings size={11} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteModpack(mp.id); }}
                                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                                style={{ color: "rgba(239,68,68,0.5)" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"} title="Удалить">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {/* Создать сборку */}
                    <button onClick={() => { openBuilder(null); setShowSidebarMenu(false); }}
                      className="w-full mt-2 rounded-xl flex items-center justify-center gap-2 px-3 h-11 transition-all"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                      <Plus size={14} />
                      <span className="text-[12px] font-bold">Создать сборку</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      {showBuilder ? (
        /* ═══ BUILDER ═══ */
        <div className="absolute inset-0 flex" style={{ paddingLeft: 252 }}>
          {/* Left panel — opaque */}
          <div className="w-[320px] flex flex-col" style={{ background: "rgba(10,10,14,0.95)", backdropFilter: "blur(12px)" }}>
            <div className="flex flex-col flex-1 overflow-hidden">

              {/* ═══ Header (always visible) ═══ */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[16px] font-black text-white leading-tight">{draft.name || "Новая сборка"}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Настрой свою сборку модов</p>
                  </div>
                  <button onClick={() => openBuilder(null)} className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all"
                    style={{ background: "rgba(96,165,250,0.1)", color: "#93c5fd" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(96,165,250,0.18)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(96,165,250,0.1)"}>
                    <Plus size={11} /> Новая
                  </button>
                </div>

                {/* Stats */}
                <div className="flex gap-2 mb-4">
                  {[
                    { label: "Моды", icon: Package, count: draft.mods.filter(m => !m.disabled).length, total: draft.mods.length },
                    { label: "Паки", icon: FileImage, count: draft.resourcePacks.filter(m => !m.disabled).length, total: draft.resourcePacks.length },
                    { label: "Шейдеры", icon: Sparkles, count: draft.shaders.filter(m => !m.disabled).length, total: draft.shaders.length },
                  ].map(s => (
                    <div key={s.label} className="flex-1 rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <s.icon size={10} style={{ color: "rgba(255,255,255,0.3)" }} />
                        <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[18px] font-black" style={{ color: "#60a5fa" }}>{s.count}</span>
                        {s.total > s.count && <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>/ {s.total}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tab bar */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                  {[
                    { id: "overview", label: "Обзор", icon: Info },
                    { id: "settings", label: "Настройки", icon: Settings2 },
                    { id: "content", label: "Контент", icon: Package },
                    { id: "import", label: "Импорт", icon: Download },
                    { id: "actions", label: "Действия", icon: ShieldCheck },
                  ].map(tab => {
                    const active = builderTab === tab.id;
                    return (
                      <button key={tab.id} onClick={() => setBuilderTab(tab.id)}
                        className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[9px] font-semibold transition-all relative"
                        style={{
                          color: active ? "#fff" : "rgba(255,255,255,0.3)",
                          background: active ? "rgba(255,255,255,0.08)" : "transparent",
                        }}>
                        <tab.icon size={13} style={{ color: active ? "#60a5fa" : "rgba(255,255,255,0.25)" }} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

              {/* ═══ Tab content (scrollable) ═══ */}
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>

                {/* ── Обзор ── */}
                {builderTab === "overview" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    <div className="flex flex-col gap-4">
                      {/* Quick info */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between py-2">
                          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Версия MC</span>
                          <span className="text-[12px] font-semibold text-white">{draft.mcVersion}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Загрузчик</span>
                          <span className="text-[12px] font-semibold text-white capitalize">{draft.loader}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Всего элементов</span>
                          <span className="text-[12px] font-semibold text-white">{draft.mods.length + draft.resourcePacks.length + draft.shaders.length}</span>
                        </div>
                      </div>

                      {/* Launch history */}
                      {(draft.launchCount > 0 || draft.lastLaunchedAt) && (
                        <div className="rounded-xl p-3.5" style={{ background: "rgba(34,197,94,0.08)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <Play size={13} style={{ color: "#22c55e" }} />
                            <span className="text-[11px] font-semibold" style={{ color: "#22c55e" }}>Статистика запусков</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between">
                              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Запусков</span>
                              <span className="text-[12px] font-semibold text-white">{draft.launchCount || 0}</span>
                            </div>
                            {draft.lastLaunchedAt && (
                              <div className="flex justify-between">
                                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Последний</span>
                                <span className="text-[12px] text-white">{new Date(draft.lastLaunchedAt).toLocaleDateString("ru-RU")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tips */}
                      <div className="rounded-xl p-3.5" style={{ background: "rgba(96,165,250,0.06)" }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Info size={12} style={{ color: "#60a5fa" }} />
                          <span className="text-[11px] font-semibold" style={{ color: "#60a5fa" }}>Подсказка</span>
                        </div>
                        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Добавляй моды через вкладку «Контент» или «Импорт». Античит не распространяется на пользовательские сборки.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Настройки ── */}
                {builderTab === "settings" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    <div className="flex flex-col gap-4">
                      {profiles.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Профиль</span>
                          <div className="relative" ref={profileMenuRef}>
                            <button onClick={() => setShowProfileMenu(!showProfileMenu)}
                              className="w-full rounded-lg text-[12px] px-3 py-2.5 flex items-center justify-between outline-none transition-all"
                              style={{ background: "rgba(255,255,255,0.06)", color: activeProfile ? "#e5e7eb" : "rgba(255,255,255,0.4)" }}>
                              <span className="truncate">{activeProfile || "Выбрать профиль"}</span>
                              <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                            </button>
                            {showProfileMenu && (
                              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl z-50 overflow-hidden"
                                style={{ background: "rgba(18,18,24,0.98)", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}>
                                {profiles.map(p => (
                                   <div key={p.name} className="flex items-center px-2 py-1.5 group/pro">
                                    <button onClick={() => loadProfile(p.name)} className="flex-1 text-left px-2 py-1 rounded-lg text-[11px] transition-colors"
                                      style={{ color: activeProfile === p.name ? "#60a5fa" : "rgba(255,255,255,0.6)" }}
                                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                      {p.name}
                                    </button>
                                    <button onClick={() => deleteProfile(p.name)} className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/pro:opacity-100 transition-opacity hover:bg-red-500/15">
                                      <Trash2 size={9} style={{ color: "rgba(239,68,68,0.7)" }} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Название</span>
                        <input value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Моя сборка"
                          className="w-full rounded-lg text-[13px] px-3 py-2.5 outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }} />
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Версия и загрузчик</span>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <CustomDropdown ariaLabel="Версия Minecraft" value={draft.mcVersion}
                              onChange={v => setDraft(p => ({ ...p, mcVersion: v }))}
                              options={mcVersions.map(v => ({ value: v.id, label: v.id + (v.type === "snapshot" ? " (snapshot)" : "") }))} />
                          </div>
                          <div className="flex-1">
                            <CustomDropdown ariaLabel="Загрузчик" value={draft.loader}
                              onChange={v => setDraft(p => ({ ...p, loader: v }))}
                              options={loaders.map(l => ({ value: l.id, label: l.label }))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Контент ── */}
                {builderTab === "content" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    <div className="flex flex-col gap-4">
                      {TABS.map(tab => {
                        const items = tab.id === "mods" ? draft.mods : tab.id === "resourcepacks" ? draft.resourcePacks : draft.shaders;
                        const key = tab.id === "mods" ? "mods" : tab.id === "resourcepacks" ? "resourcePacks" : "shaders";
                        if (items.length === 0) return null;
                        return (
                          <div key={tab.id} className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5 mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                              <tab.icon size={10} /> {tab.label} ({items.filter(m => !m.disabled).length}/{items.length})
                            </span>
                            <div className="flex flex-col">
                              {items.map((item, i) => {
                                const latest = modLatestVersions[item.projectId];
                                const isOutdated = latest && item.version !== "?" && item.version !== latest;
                                const isUpToDate = latest && item.version === latest;
                                return (
                                  <div key={i} className="flex items-center gap-2.5 px-2 py-2 group/item transition-all -mx-2 rounded-lg"
                                    style={{ opacity: item.disabled ? 0.35 : 1 }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    {item.icon_url ? <img src={item.icon_url} alt={item.title || "Мод"} className="w-6 h-6 rounded-md flex-shrink-0" /> : <tab.icon size={12} style={{ color: tab.accent, flexShrink: 0 }} />}
                                    <span className="text-[12px] text-white truncate flex-1">{item.title}{item.auto ? " (auto)" : ""}{item.local ? " (local)" : ""}</span>
                                    {!item.auto && !item.local && latest && (
                                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" title={isOutdated ? `Обновление: ${latest}` : isUpToDate ? "Последняя версия" : ""}
                                        style={{ background: isOutdated ? "#f59e0b" : isUpToDate ? "#22c55e" : "rgba(255,255,255,0.15)" }} />
                                    )}
                                    <span className="text-[10px] flex-shrink-0 tabular-nums" style={{ color: isOutdated ? "#fbbf24" : "rgba(255,255,255,0.25)" }}>{item.version}</span>
                                    {!item.auto && !item.local && (
                                      <button onClick={() => toggleDisabled(key, i)} className="p-0.5 rounded opacity-0 group-hover/item:opacity-100 transition-all" title={item.disabled ? "Включить" : "Отключить"}>
                                        <div className="w-4 h-2.5 rounded-full transition-all" style={{ background: item.disabled ? "rgba(255,255,255,0.12)" : "rgba(74,222,128,0.5)", position: "relative" }}>
                                          <div className="w-2 h-2 rounded-full absolute top-[1px] transition-all" style={{ background: "#fff", left: item.disabled ? "1px" : "13px" }} />
                                        </div>
                                      </button>
                                    )}
                                    {!item.auto && <button onClick={() => removeItem(key, i)} className="p-0.5 rounded opacity-0 group-hover/item:opacity-100 hover:bg-white/10 transition-all">
                                      <Trash2 size={11} style={{ color: "rgba(239,68,68,0.6)" }} />
                                    </button>}
                                  </div>
                                );
                              })}
                            </div>
                            {tab.id === "mods" && items.length > 0 && (() => {
                              const allCats = [...new Set(items.flatMap(m => m.categories || []).filter(Boolean))];
                              if (allCats.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {allCats.slice(0, 8).map(cat => (
                                    <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                                      className="text-[9px] px-2 py-0.5 rounded-full font-semibold transition-all"
                                      style={{
                                        background: categoryFilter === cat ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.06)",
                                        color: categoryFilter === cat ? "#93c5fd" : "rgba(255,255,255,0.35)",
                                      }}>
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                      {draft.mods.length === 0 && draft.resourcePacks.length === 0 && draft.shaders.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Package size={32} style={{ color: "rgba(255,255,255,0.08)" }} />
                          <p className="text-[12px] mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>Пока ничего не добавлено</p>
                          <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.12)" }}>Добавь через «Импорт» или найди справа</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── Импорт ── */}
                {builderTab === "import" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Архив</span>
                        <label className="flex items-center justify-center gap-2 h-11 rounded-lg cursor-pointer transition-all"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>
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
                            setImportFlash(true);
                            setTimeout(() => setImportFlash(false), 1200);
                          }} />
                          <Package size={14} /> Добавить из архива (.zip / .jar)
                        </label>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Ссылка на мод</span>
                        <div className="flex gap-2">
                          <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="modrinth.com/mod/sodium"
                            onKeyDown={e => { if (e.key === "Enter") importFromUrl(); }}
                            className="flex-1 rounded-lg text-[11px] px-3 py-2.5 outline-none" style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }} />
                          <button onClick={importFromUrl} disabled={!importUrl.trim() || importingUrl}
                            className="h-9 px-3.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                            style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd" }}>
                            {importingUrl ? <div className="w-3 h-3 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" /> : <Link2 size={10} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Действия ── */}
                {builderTab === "actions" && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    <div className="flex flex-col gap-3">
                      <button onClick={updateAllMods} disabled={updatingAll || (!draft.mods.length && !draft.resourcePacks.length && !draft.shaders.length)}
                        className="h-11 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                        style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "#fff", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}
                        onMouseEnter={e => { if (!updatingAll) e.currentTarget.style.boxShadow = "0 4px 28px rgba(37,99,235,0.45)"; }}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,99,235,0.3)"}>
                        {updatingAll ? <><div className="w-3.5 h-3.5 border-[1.5px] border-white/30 border-t-white rounded-full animate-spin" /> Обновление...</> : <><RefreshCw size={12} /> Обновить всё</>}
                      </button>

                      <button onClick={saveProfile} disabled={!draft.name.trim()}
                        className="h-11 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                        style={{
                          background: saveFlash ? "linear-gradient(135deg, #16a34a, #22c55e)" : draft.name.trim() ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "rgba(96,165,250,0.12)",
                          color: "#fff",
                          boxShadow: saveFlash ? "0 4px 20px rgba(34,197,94,0.35)" : draft.name.trim() ? "0 4px 20px rgba(37,99,235,0.3)" : "none",
                          transition: "background 0.3s, box-shadow 0.3s",
                        }}
                        onMouseEnter={e => { if (draft.name.trim() && !saveFlash) e.currentTarget.style.boxShadow = "0 4px 28px rgba(37,99,235,0.45)"; }}
                        onMouseLeave={e => { if (!saveFlash) e.currentTarget.style.boxShadow = draft.name.trim() ? "0 4px 20px rgba(37,99,235,0.3)" : "none"; }}>
                        {saveFlash ? <><Check size={12} /> Сохранено!</> : <><Folder size={12} /> Сохранить профиль</>}
                      </button>

                      <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.06)" }} />

                      <div className="flex gap-2">
                        <button onClick={backupCurrentMods} disabled={!draft.mods.length && !draft.resourcePacks.length && !draft.shaders.length}
                          className="flex-1 h-10 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-30"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
                          <Save size={11} /> Бэкап
                        </button>
                        <button onClick={exportModpack}
                          className="flex-1 h-10 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
                          <Download size={11} /> Экспорт
                        </button>
                      </div>

                      <div className="flex items-start gap-2 mt-2 pt-3">
                        <Info size={11} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0, marginTop: 1 }} />
                        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Античит не распространяется на пользовательские сборки. Fabric API добавляется автоматически.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>

            </div>

            <div className="px-5 py-4 flex gap-2.5">
              <button onClick={() => setShowBuilder(false)} className="flex-1 h-11 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>Отмена</button>
              <button onClick={saveModpack} disabled={!draft.name.trim()}
                className="flex-1 h-10 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-30"
                style={{
                  background: saveFlash ? "linear-gradient(135deg, #16a34a, #22c55e)" : draft.name.trim() ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "rgba(96,165,250,0.15)",
                  boxShadow: saveFlash ? "0 0 24px rgba(34,197,94,0.4)" : draft.name.trim() ? "0 0 20px rgba(37,99,235,0.35)" : "none",
                  transition: "background 0.3s, box-shadow 0.3s",
                }}>
                {saveFlash ? "Сохранено!" : "Сохранить"}
              </button>
            </div>
          </div>

          {/* Right panel: Modrinth browser — opaque */}
          <div className="flex-1 flex flex-col" style={{ background: "rgba(10,10,14,0.92)" }}>
            {/* Tabs + search */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-3">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(""); setSelectedModDetail(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{ background: activeTab === tab.id ? `${tab.accent}15` : "transparent", color: activeTab === tab.id ? tab.accent : "rgba(255,255,255,0.4)", border: activeTab === tab.id ? `1px solid ${tab.accent}30` : "1px solid transparent" }}>
                  <tab.icon size={13} /> {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              {/* Sync with server */}
              <button onClick={syncWithServer} disabled={syncing}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                style={{ background: syncResult && !syncResult.error ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)", color: syncResult && !syncResult.error ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
                {syncing ? <div className="w-3 h-3 border-[1.5px] border-white/30 border-t-white/70 rounded-full animate-spin" /> : <ArrowUpDown size={12} />}
                {syncing ? "Синхронизация..." : "Синхронизация"}
              </button>
              <div className="relative" style={{ width: 320 }}>
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Поиск ${currentTab?.label?.toLowerCase()}...`}
                  className="w-full h-9 rounded-xl text-[12px] pl-9 pr-3 outline-none" style={{ background: "rgba(255,255,255,0.05)", color: "#fff" }} />
                {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-[1.5px] border-white/20 border-t-white/60 rounded-full animate-spin" />}
              </div>
            </div>

            {/* Sync result */}
            {syncResult && (
              <div className="mx-6 mt-3 rounded-xl p-3 flex flex-col gap-1.5" style={{
                background: syncResult.error ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.06)",
              }}>
                {syncResult.error ? (
                  <p className="text-[11px]" style={{ color: "#fca5a5" }}>Ошибка: {syncResult.error}</p>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold" style={{ color: "#4ade80" }}>Сервер: {syncResult.total} модов в манифесте</p>
                    {syncResult.missing.length > 0 && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>Отсутствует локально: {syncResult.missing.length}</p>}
                    {syncResult.extra.length > 0 && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>Лишних (не на сервере): {syncResult.extra.length}</p>}
                    {syncResult.missing.length === 0 && syncResult.extra.length === 0 && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Всё синхронизировано</p>}
                  </>
                )}
              </div>
            )}

            {/* Compatibility warnings */}
            {compatWarnings.length > 0 && (
              <div className="mx-6 mt-2 rounded-xl p-3 flex flex-col gap-1.5" style={{ background: "rgba(245,158,11,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#fbbf24" }}>Проблемы совместимости</p>
                {compatWarnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                    <AlertTriangle size={10} style={{ color: "#fbbf24", flexShrink: 0 }} />
                    <span className="font-semibold text-white">{w.title}</span> — {w.reason}
                  </div>
                ))}
              </div>
            )}

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
                    {selectedModDetail.icon_url && <img src={selectedModDetail.icon_url} alt={selectedModDetail.title || "Мод"} className="w-16 h-16 rounded-2xl flex-shrink-0" />}
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
                        const allItems = [...draft.mods, ...draft.resourcePacks, ...draft.shaders];
                        const installedItem = allItems.find(m => m.projectId === selectedModDetail.project_id);
                        const isInstalled = installedItem?.version === ver.version_number;
                        return (
                           <div key={ver.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: isInstalled ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)" }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold" style={{ color: isInstalled ? "#4ade80" : "#fff" }}>{ver.version_number}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ background: ver.version_type === "release" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)", color: ver.version_type === "release" ? "#4ade80" : "#fbbf24" }}>{ver.version_type}</span>
                                {isInstalled && <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>УСТАНОВЛЕНА</span>}
                              </div>
                              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{ver.date_published?.slice(0, 10)} · {ver.game_versions?.join(", ")}</p>
                            </div>
                            <button onClick={() => addModFromVersion(selectedModDetail, ver)} disabled={added && !isInstalled}
                              className="h-8 px-4 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                              style={{ background: isInstalled ? "rgba(34,197,94,0.15)" : added ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, #2563eb, #3b82f6)", color: isInstalled || added ? "#4ade80" : "#fff" }}>
                              {isInstalled ? <><Check size={12} className="inline mr-1" />Установлена</> : added ? <><Check size={12} className="inline mr-1" />Добавлен</> : <><Download size={12} className="inline mr-1" />Добавить</>}
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
                           style={{ background: "rgba(255,255,255,0.03)" }}
                           onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                      <div className="flex items-start gap-3">
                        {hit.icon_url && <img src={hit.icon_url} alt={hit.title || "Мод"} className="w-10 h-10 rounded-xl flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-bold text-white truncate">{hit.title}</p>
                            {added && <Check size={11} style={{ color: "#4ade80", flexShrink: 0 }} />}
                          </div>
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{hit.author} · {formatDownloads(hit.downloads)}</p>
                          {added && (() => {
                            const allItems = [...draft.mods, ...draft.resourcePacks, ...draft.shaders];
                            const installed = allItems.find(m => m.projectId === hit.project_id);
                            const latest = modLatestVersions[hit.project_id];
                            if (!installed) return null;
                            return (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>{installed.version}</span>
                                {latest && installed.version !== latest && (
                                  <>
                                    <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>→</span>
                                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24" }}>{latest}</span>
                                  </>
                                )}
                              </div>
                            );
                          })()}
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
        <div className="absolute inset-0 z-10 flex flex-col">
          <img src="/hero.jpg" alt="SBGames" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55, objectPosition: "center" }} onError={e => e.currentTarget.style.display = "none"} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.8) 100%)" }} />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <div className="text-[64px] font-display font-black leading-none tracking-tight text-white text-center" style={{ textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}>SB GAMES</div>
            <div className="text-[56px] font-display font-black leading-none tracking-tight uppercase text-center" style={{ color: "rgba(255,255,255,0.22)" }}>КОМПЛЕКС<br />СЕРВЕРОВ</div>
          </div>
          <div className="relative z-10 flex items-center gap-3 pb-8 pr-8 px-10">
            <div className="flex items-center gap-2 rounded-2xl px-4 h-[44px]" style={{ background: "rgba(255,255,255,0.08)" }}>
              <img src="/money.png" alt="SBT" className="w-5 h-5 flex-shrink-0" style={{ filter: "none" }} onError={e => e.currentTarget.style.display = "none"} />
              <span className="text-[14px] font-black text-white tabular-nums">{(user?.balance ?? 0).toLocaleString("en-US")}</span>
              <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>SBT</span>
            </div>
            <div className="flex-1" />
            <motion.button onClick={handlePlay} data-launch-btn disabled={true} whileTap={{ scale: 0.96 }}
              className="flex items-center gap-3 h-[44px] rounded-2xl font-black text-[14px] tracking-widest uppercase opacity-40 cursor-not-allowed"
              style={{ padding: "0 32px", background: "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(59,130,246,0.9))", color: "#fff" }}>
              ВЫБЕРИ СЕРВЕР <Play size={16} weight="fill" />
            </motion.button>
            <motion.button onClick={() => setShowSettings(true)} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}><Settings size={15} /></motion.button>
          </div>
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
              <img src="/money.png" alt="SBT" className="w-5 h-5 flex-shrink-0" style={{ filter: "none" }} onError={e => e.currentTarget.style.display = "none"} />
              <span className="text-[14px] font-black text-white tabular-nums">{(user?.balance ?? 0).toLocaleString("en-US")}</span>
              <span className="text-[11px] font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>SBT</span>
            </div>
            {mcRunning ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 h-[44px] px-6 rounded-2xl font-black text-[13px] tracking-widest uppercase" style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80" }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> В ИГРЕ
                </div>
                <motion.button onClick={handleClose} aria-label="Закрыть" whileTap={{ scale: 0.95 }} className="h-[44px] px-4 rounded-2xl font-bold text-[11px] tracking-wider uppercase transition-all"
                  style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5" }}
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
                  role="alert"
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[480px] rounded-xl px-4 py-3 text-[12px]"
                  style={{ background: "rgba(220,38,38,0.15)", color: "#fca5a5" }}>
                  <p className="font-bold mb-1">Не удалось запустить</p>
                  <p className="text-[11px] opacity-80">{launchError}</p>
                  <button onClick={() => setLaunchError(null)} aria-label="Закрыть ошибку" className="absolute top-1 right-2 text-[14px] opacity-50 hover:opacity-100" style={{ color: "#fca5a5" }}>×</button>
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
              role="dialog" aria-modal="true" aria-label="Настройки запуска"
              className="w-[420px] rounded-2xl p-5 flex flex-col gap-4" style={{ background: "rgba(10,10,14,0.98)", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}>
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-white">Настройки запуска</p>
                <button onClick={() => setShowSettings(false)} aria-label="Закрыть настройки" className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}><X size={12} /></button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}><HardDrive size={11} />Оперативная память</span>
                  <span className="text-[12px] font-bold text-white tabular-nums">{ramGb} ГБ</span>
                </div>
                <input type="range" min="1" max="16" step="1" value={ramGb} onChange={e => setRamGb(parseInt(e.target.value))} className="w-full accent-blue-500" />
                <div className="flex gap-2 mt-1">
                  {[{ label: "Слабый ПК", ram: 2 }, { label: "Баланс", ram: 4 }, { label: "Максимум", ram: 8 }].map(p => (
                    <button key={p.label} onClick={() => setRamGb(p.ram)}
                      className="flex-1 h-8 rounded-lg text-[10px] font-bold transition-all"
                      style={{
                        background: ramGb === p.ram ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.04)",
                        color: ramGb === p.ram ? "#93c5fd" : "rgba(255,255,255,0.4)",
                      }}>
                      {p.label} ({p.ram} ГБ)
                    </button>
                  ))}
                </div>
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
              role="dialog" aria-modal="true" aria-label="Предупреждение"
              className="w-full max-w-[520px] rounded-3xl p-6 flex flex-col gap-4"
              style={{ background: "linear-gradient(160deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,0.98) 100%)", boxShadow: "0 0 80px rgba(239,68,68,0.25), 0 24px 60px rgba(0,0,0,0.7)" }}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}><AlertTriangle size={22} weight="fill" style={{ color: "#fca5a5" }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white">Обнаружена подозрительная активность</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>Мод-пак скомпрометирован. Запуск заблокирован.</p>
                </div>
                <button onClick={handleModpackCancel} aria-label="Закрыть" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}><X size={14} /></button>
              </div>
              <div className="rounded-2xl p-3 max-h-[280px] overflow-y-auto" style={{ background: "rgba(0,0,0,0.4)" }}>
                {modpackReport.rejected?.length > 0 && modpackReport.rejected.map((issue, i) => (
                  <div key={i} className="rounded-lg p-2.5 mb-1.5" style={{ background: "rgba(239,68,68,0.08)" }}>
                    <div className="flex items-center gap-2"><ShieldAlert size={11} style={{ color: "#fca5a5", flexShrink: 0 }} /><span className="text-[11px] font-bold text-white font-mono truncate">{issue.name}</span></div>
                    <p className="text-[10px] mt-1 ml-5" style={{ color: "rgba(255,255,255,0.5)" }}>{issue.detail}</p>
                  </div>
                ))}
                {modpackReport.missing?.length > 0 && modpackReport.missing.map((issue, i) => (
                  <div key={i} className="rounded-lg p-2 mb-1" style={{ background: "rgba(147,197,253,0.06)" }}>
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

        {depModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} onClick={e => { if (e.target === e.currentTarget) setDepModal(null); }}>
            <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }} transition={{ duration: 0.18 }}
              className="w-[400px] rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: "rgba(10,10,14,0.98)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(96,165,250,0.12)" }}>
                  <Download size={15} style={{ color: "#60a5fa" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-white leading-tight">Зависимости</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{depModal.parent} требует {depModal.deps.length} {depModal.deps.length === 1 ? "зависимость" : "зависимостей"}</p>
                </div>
              </div>
              <div className="rounded-xl p-2 space-y-1" style={{ background: "rgba(0,0,0,0.3)" }}>
                {depModal.deps.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <Package size={10} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                    <span className="text-[11px] text-white truncate">{d.file_name || d.project_id}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDepModal(null)} className="flex-1 h-9 rounded-xl text-[12px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>Пропустить</button>
                <button onClick={addAllDeps} className="flex-1 h-9 rounded-xl text-[12px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>Добавить всё</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {guardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={e => { if (e.target === e.currentTarget) setGuardModal(null); }}>
            <motion.div initial={{ scale: 0.92, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="w-full max-w-[480px] rounded-3xl p-6 flex flex-col gap-4"
              style={{ background: "linear-gradient(160deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,0.98) 100%)", boxShadow: "0 0 80px rgba(239,68,68,0.3), 0 24px 60px rgba(0,0,0,0.7)" }}>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}><ShieldAlert size={22} weight="fill" style={{ color: "#fca5a5" }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white">Защита SB Games</p>
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{guardModal.reason === "inject" ? "Инжект DLL" : "Изменения в мод-паке"}</p>
                </div>
                <button onClick={() => setGuardModal(null)} aria-label="Закрыть" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}><X size={14} /></button>
              </div>
              <div className="rounded-2xl p-3" style={{ background: "rgba(0,0,0,0.4)" }}>
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