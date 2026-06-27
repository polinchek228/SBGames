import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CaretLeft, ArrowClockwise } from "@phosphor-icons/react";
import { API_URL } from "../../lib/api.js";

// Markdown → HTML (полный: заголовки, списки, таблицы, картинки, код, цитаты)
function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}
function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const out = []; let i = 0;
  const isSep = (s) => /^\s*\|?[\s:|-]+\|?\s*$/.test(s) && s.includes("-");
  while (i < lines.length) {
    let line = lines[i];
    if (/^\s*```/.test(line)) { const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(esc(lines[i])); i++; } i++; out.push("<pre><code>" + buf.join("\n") + "</code></pre>"); continue; }
    if (line.includes("|") && i + 1 < lines.length && isSep(lines[i + 1])) {
      const row = (r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const hs = row(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(row(lines[i])); i++; }
      let t = "<table><thead><tr>" + hs.map((h) => "<th>" + inline(esc(h)) + "</th>").join("") + "</tr></thead><tbody>";
      for (const r of rows) t += "<tr>" + r.map((c) => "<td>" + inline(esc(c)) + "</td>").join("") + "</tr>";
      t += "</tbody></table>"; out.push(t); continue;
    }
    let h;
    if ((h = line.match(/^(#{1,6})\s+(.*)$/))) { out.push("<h" + h[1].length + ">" + inline(esc(h[2])) + "</h" + h[1].length + ">"); i++; continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\s*>\s?/.test(line)) { const buf = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(inline(esc(lines[i].replace(/^\s*>\s?/, "")))); i++; } out.push("<blockquote>" + buf.join("<br>") + "</blockquote>"); continue; }
    if (/^\s*\d+[.)]\s+/.test(line)) { out.push("<ol>"); while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { out.push("<li>" + inline(esc(lines[i].replace(/^\s*\d+[.)]\s+/, ""))) + "</li>"); i++; } out.push("</ol>"); continue; }
    if (/^\s*[-*+]\s+/.test(line)) { out.push("<ul>"); let nest = false; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { const ind = lines[i].match(/^(\s*)/)[1].length; const ct = inline(esc(lines[i].replace(/^\s*[-*+]\s+/, ""))); if (ind >= 2) { if (!nest) { out.push("<ul>"); nest = true; } out.push("<li>" + ct + "</li>"); } else { if (nest) { out.push("</ul>"); nest = false; } out.push("<li>" + ct + "</li>"); } i++; } if (nest) out.push("</ul>"); out.push("</ul>"); continue; }
    if (line.trim() === "") { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*(#{1,6}\s|>|\d+[.)]\s|[-*+]\s|```|---|\*\*\*|___)/.test(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && isSep(lines[i + 1]))) { para.push(inline(esc(lines[i]))); i++; }
    out.push("<p>" + para.join("<br>") + "</p>");
  }
  return out.join("\n");
}

export default function ForumArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true); setNotFound(false);
    fetch(`${API_URL}/forum/articles/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setArticle(d); else setNotFound(true); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  // SEO meta под конкретную статью
  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} — SB Games`;
    const set = (k, v) => { let m = document.querySelector(k); if (!m){m=document.createElement("meta"); m.setAttribute(k.startsWith("property")?"property":"name", k.replace(/[^a-z:]+/gi,"")); document.head.appendChild(m);} m.setAttribute("content", v); };
    const d = document.querySelector('meta[name="description"]'); if (d) d.setAttribute("content", article.excerpt || article.title);
    set('meta[property="og:title"]', article.title);
    set('meta[property="og:description"]', article.excerpt || "");
    const c = document.querySelector('link[rel="canonical"]'); if (c) c.href = `https://games.sb-capital.group/forum/read/${slug}`;
  }, [article, slug]);

  if (loading) return (
    <main style={{ background: "#000", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#60a5fa", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </main>
  );
  if (notFound || !article) return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Статья не найдена</h1>
      <Link to="/forum" style={{ color: "#60a5fa" }}>← Вернуться на форум</Link>
    </main>
  );

  const metaParts = [];
  if (article.version) metaParts.push(<span key="v">MC {article.version}</span>);
  if (article.tags && article.tags.length) metaParts.push(<span key="t">{article.tags.slice(0,3).join(" · ")}</span>);
  metaParts.push(<time key="d">{article.publishedAt}</time>);

  return (
    <main style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 64px" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Link to={article.category ? `/forum/${article.category}` : "/forum"} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 18, textDecoration: "none" }}>
            <CaretLeft size={13} weight="bold" /> Назад
          </Link>
          <h1 style={{ fontSize: "clamp(28px,5vw,40px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", letterSpacing: "0.01em" }}>{article.title}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
            {metaParts.map((p, i) => <React.Fragment key={i}>{i > 0 && <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>}{p}</React.Fragment>)}
          </div>
          {(article.tags && article.tags.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "14px 0 28px" }}>
              {article.tags.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>{t}</span>)}
            </div>
          )}

          <article
            className="forum-article"
            style={{ fontSize: 16, color: "rgba(255,255,255,0.82)", lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: mdToHtml(article.body || "") }}
          />
        </motion.div>
      </div>

      <style>{`
        .forum-article h2 { font-size:24px; font-weight:800; margin:36px 0 12px; color:#fff; }
        .forum-article h3 { font-size:19px; font-weight:700; margin:28px 0 10px; color:#fff; }
        .forum-article p { margin:0 0 16px; }
        .forum-article ul { margin:0 0 16px; padding-left:22px; }
        .forum-article li { margin-bottom:6px; }
        .forum-article blockquote { border-left:3px solid #3b82f6; padding:6px 0 6px 16px; margin:0 0 16px; color:rgba(255,255,255,0.6); font-style:italic; }
        .forum-article code { background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:'Courier New',monospace; font-size:14px; }
        .forum-article pre { background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px 16px; overflow-x:auto; }
        .forum-article pre code { background:none; padding:0; }
        .forum-article strong { color:#fff; }
        .forum-article a { color:#60a5fa; }
      `}</style>
    </main>
  );
}
