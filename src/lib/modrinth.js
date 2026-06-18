const BASE = "https://api.modrinth.com/v2";

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
  const res = await fetch(url.toString(), { headers: { "User-Agent": "SBGames-Launcher/1.0" } });
  if (!res.ok) throw new Error(`Modrinth ${res.status}`);
  return res.json();
}

export async function searchMods(query, mcVersion, loader, limit = 20, offset = 0) {
  const facets = [["project_type:mod"]];
  if (loader && loader !== "all") facets.push([`categories:${loader}`]);
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  return get("/search", { query: query || "", facets: JSON.stringify(facets), limit, index: "relevance", offset });
}

export async function searchResourcePacks(query, mcVersion, limit = 20, offset = 0) {
  const facets = [["project_type:resourcepack"]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  return get("/search", { query: query || "", facets: JSON.stringify(facets), limit, index: "relevance", offset });
}

export async function searchShaders(query, mcVersion, limit = 20, offset = 0) {
  const facets = [["project_type:shader"]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  return get("/search", { query: query || "", facets: JSON.stringify(facets), limit, index: "relevance", offset });
}

export async function getPopular(mcVersion, loader, type = "mod", limit = 20) {
  const facets = [[`project_type:${type === "resourcepack" ? "resourcepack" : type}`]];
  if (loader && loader !== "all" && type === "mod") facets.push([`categories:${loader}`]);
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  return get("/search", { facets: JSON.stringify(facets), limit, index: "downloads" });
}

export async function getProject(id) {
  return get(`/project/${id}`);
}

export async function getProjectVersions(projectId, mcVersion, loader) {
  const params = { project_id: projectId };
  if (mcVersion) params.game_versions = JSON.stringify([mcVersion]);
  if (loader && loader !== "all") params.loaders = JSON.stringify([loader]);
  return get(`/project/${projectId}/version`, params);
}

export function downloadUrl(version) {
  if (!version?.files?.length) return null;
  const primary = version.files.find(f => f.primary) || version.files[0];
  return primary?.url || null;
}

export function formatDownloads(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function truncateText(text, max = 160) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

let _versionsCache = null;
let _versionsPromise = null;

export async function getMcVersions() {
  if (_versionsCache) return _versionsCache;
  if (_versionsPromise) return _versionsPromise;
  _versionsPromise = (async () => {
    try {
      const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");
      if (!res.ok) throw new Error(`Mojang ${res.status}`);
      const data = await res.json();
      const versions = data.versions
        .filter(v => v.type === "release" || v.type === "snapshot")
        .map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }));
      _versionsCache = versions;
      return versions;
    } catch {
      _versionsCache = [
        { id: "1.21.4", type: "release" }, { id: "1.21.1", type: "release" }, { id: "1.20.6", type: "release" },
        { id: "1.20.4", type: "release" }, { id: "1.20.1", type: "release" }, { id: "1.19.4", type: "release" },
        { id: "1.19.2", type: "release" }, { id: "1.18.2", type: "release" }, { id: "1.16.5", type: "release" },
        { id: "1.12.2", type: "release" },
      ];
      return _versionsCache;
    }
  })();
  return _versionsPromise;
}

export async function getMcVersionsByLoader(loader) {
  if (!loader || loader === "all") return getMcVersions();
  const all = await getMcVersions();
  return all;
}

export async function getModrinthLoaders() {
  try {
    const res = await fetch(`${BASE}/tag/loader`, { headers: { "User-Agent": "SBGames-Launcher/1.0" } });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    // API returns array of strings like ["forge", "fabric", ...]
    if (Array.isArray(data) && typeof data[0] === "string") {
      return data.map(s => ({ name: s.charAt(0).toUpperCase() + s.slice(1), slug: s }));
    }
    return data;
  } catch {
    return [
      { name: "Forge", slug: "forge" }, { name: "Fabric", slug: "fabric" },
      { name: "Quilt", slug: "quilt" }, { name: "NeoForge", slug: "neoforge" },
      { name: "Rift", slug: "rift" }, { name: "LiteLoader", slug: "liteloader" },
    ];
  }
}
