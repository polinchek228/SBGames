import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CaretLeft, ArrowClockwise } from "@phosphor-icons/react";
import { API_URL } from "../../lib/api.js";

// Минимальный Markdown → HTML (тот же, что в build-forum, для тела статьи)
function mdToHtml(md) {
  let h = md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = h.split(/\r?\n/), out = [];
  let inList = false, inCode = false, buf = [];
  const flush = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const line of lines) {
    if (/^```/.test(line.trim())) { if (inCode) { out.push(`<pre><code>${buf.join("\n")}</code></pre>`); buf=[]; inCode=false; } else { flush(); inCode=true; } continue; }
    if (inCode) { buf.push(line); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if (/^&gt;\s?/.test(line)) { flush(); out.push(`<blockquote>${inline(line.replace(/^&gt;\s?/,""))}</blockquote>`); continue; }
    if (/^[-*]\s+/.test(line)) { if (!inList){out.push("<ul>");inList=true;} out.push(`<li>${inline(line.replace(/^[-*]\s+/,""))}</li>`); continue; }
    if (line.trim()==="") { flush(); continue; }
    flush(); out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  if (inCode) out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
  return out.join("\n");
}
function inline(t){return t.replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noreferrer">$1</a>');}

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
