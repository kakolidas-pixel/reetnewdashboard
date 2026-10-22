import * as data from "./db.js";
import { render as md, inline, excerpt, readingTime } from "./md.js";
import { initPopups, closeAll } from "./popup.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D = (iso, o = { day: "numeric", month: "long", year: "numeric" }) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", o) : "";
const MY = { month: "long", year: "numeric" };

let S = {};
const view = $("#view");

function statusLine(p) {
  const st = p.status || "Ongoing";
  if (st === "Ongoing") return `Ongoing, since ${D(p.startDate, MY)}`;
  if (st === "Complete") return `Completed ${D(p.endDate || p.startDate, MY)}`;
  return st;
}

const projectEntry = p => `
  <article class="entry ${p.cover ? "" : "no-cover"}">
    <div>
      <h3><a href="/projects/${esc(p.slug)}">${esc(p.title)}</a></h3>
      <p class="status">${esc(statusLine(p))}</p>
      <p>${esc(p.summary || excerpt(p.body, 200))}</p>
    </div>
    ${p.cover ? `<a class="cover" href="/projects/${esc(p.slug)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.cover)}" alt=""></a>` : ""}
  </article>`;

/* ---------- views ---------- */

async function home() {
  const [P, W, T] = await Promise.all([data.projects(), data.posts(), data.timeline()]);
  const feat = P.find(p => p.id === S.featuredProject) || P.find(p => p.featured) || P[0];

  const isUpd = p => p.type === "update", isAward = t => t.kind === "award";
  const projOf = id => P.find(p => p.id === id);
  const items = [
    ...T.filter(t => !isAward(t)).map(t => ({ date: t.date, title: t.title, desc: t.description, href: t.link || "", kind: "milestone" })),
    ...T.filter(t => isAward(t) && t.onTimeline !== false).map(t => ({ date: t.date, title: [t.award || t.title, t.event].filter(Boolean).join(", "), desc: [t.committee, t.portfolio].filter(Boolean).join(", "), href: "/awards", kind: "award" })),
    ...W.filter(p => !isUpd(p)).map(p => ({ date: p.date, title: p.title, desc: p.excerpt || excerpt(p.body, 130), href: `/writing/${p.slug}`, kind: "writing" })),
    ...W.filter(isUpd).map(p => ({ date: p.date, title: p.title || `Update on ${projOf(p.projectId)?.title || "a project"}`, desc: excerpt(p.body, 130), href: projOf(p.projectId) ? `/projects/${projOf(p.projectId).slug}` : "", kind: "update" })),
    ...P.map(p => ({ date: p.startDate, title: p.title, desc: p.summary, href: `/projects/${p.slug}`, kind: "project begins" }))
  ].filter(i => i.date).sort((a, b) => b.date.localeCompare(a.date));

  const years = {};
  items.forEach(i => (years[i.date.slice(0, 4)] ||= []).push(i));

  const tl = Object.keys(years).sort().reverse().map(y => `
    <section class="yr">
      <h3 class="yr-n">${y}</h3>
      <ul class="yr-items">${years[y].map(i => `
        <li><time datetime="${i.date}">${D(i.date, { day: "numeric", month: "short" })}</time>
          <div><span class="t">${i.href ? `<a href="${esc(i.href)}">${esc(i.title)}</a>` : esc(i.title)}</span><span class="kind">${i.kind}</span>
          ${i.desc ? `<p>${esc(i.desc)}</p>` : ""}</div></li>`).join("")}
      </ul>
    </section>`).join("");

  return {
    title: "",
    html: `
      <h1 class="name">${esc(S.siteTitle)}</h1>
      ${S.tagline ? `<p class="tagline">${esc(S.tagline)}</p>` : ""}
      ${S.showSchool && S.school ? `<p class="where">${esc(S.school)}</p>` : ""}
      <div class="prose lede">${md(S.intro)}</div>
      ${feat ? `<h2 class="sec">Currently working on</h2>${projectEntry(feat)}` : ""}
      <h2 class="sec">Timeline</h2>
      ${tl ? `<div class="timeline">${tl}</div>` : `<p class="empty">Nothing here yet. Entries appear as work is published.</p>`}`
  };
}

async function about() {
  const portrait = S.portrait ? `<div class="portrait"><img src="${esc(S.portrait)}" alt="Portrait of ${esc(S.siteTitle)}"></div>` : "";
  const links = (S.links || []).length ? `<ul class="links">${S.links.map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join("")}</ul>` : "";
  return {
    title: "About",
    html: `<h1 class="page-title">About</h1>
      ${S.showSchool && S.school ? `<p class="page-sub">${esc(S.school)}</p>` : ""}
      <div class="${portrait ? "about-grid" : ""}"><div><div class="prose">${md(S.about) || `<p class="empty">Nothing written yet.</p>`}</div>${links}</div>${portrait}</div>`
  };
}

async function projects() {
  const P = await data.projects();
  return {
    title: "Projects",
    html: `<h1 class="page-title">Projects</h1><p class="page-sub">Long-running work, each with its own record.</p>
      ${P.length ? P.map(projectEntry).join("") : `<p class="empty">No projects published yet.</p>`}`
  };
}

const sourcesList = sources => {
  const s = (sources || []).filter(x => (x.citation || "").trim());
  return s.length ? `<ol class="sources">${s.map(x => `<li>${inline(x.citation)}${x.url ? ` <a href="${esc(x.url)}">Link</a>` : ""}</li>`).join("")}</ol>` : "";
};
const mnHead = label => `<span class="mn-head"><span class="stripes"></span><span class="mn-label">${label}</span></span>`;
const disclaimerBox = text => (text || "").trim()
  ? `<div class="mn-box disclaimer">${mnHead("Note")}<p>${inline(text)}</p></div>` : "";
const biblioBox = sources => {
  const list = sourcesList(sources);
  return list ? `<details class="mn-box biblio"><summary>${mnHead("Sources")}</summary>${list}</details>` : "";
};
// A right-margin aside holding the disclaimer (if any) above a collapsed-by-default
// bibliography (if any). Falls back to a normal in-flow block on narrower screens --
// true floating margin notes only have room on wide viewports (see the @media rule
// on .margin-notes in site.css).
const marginNotes = (disclaimer, sources) => {
  const d = disclaimerBox(disclaimer), b = biblioBox(sources);
  return (d || b) ? `<aside class="margin-notes">${d}${b}</aside>` : "";
};

async function project([, slug]) {
  const [P, W] = await Promise.all([data.projects(), data.posts()]);
  const p = P.find(x => x.slug === slug);
  if (!p) return notFound();
  const related = W.filter(w => w.projectId === p.id && w.type !== "update");
  const updates = W.filter(w => w.projectId === p.id && w.type === "update");
  const sources = (p.sources || []).filter(s => (s.citation || "").trim());
  return {
    title: p.title,
    html: `<h1 class="page-title">${esc(p.title)}</h1><p class="meta">${esc(statusLine(p))}</p>
      ${tagLine(p.tags)}
      ${marginNotes(p.disclaimer, sources)}
      ${p.cover ? `<figure class="hero-img"><img src="${esc(p.cover)}" alt=""></figure>` : ""}
      <div class="prose" data-md>${md(p.body)}</div>
      ${updates.length ? `<h2 class="sec">Updates</h2>${updates.map(u => `<article class="upd"><time datetime="${u.date}">${D(u.date, { day: "numeric", month: "short", year: "numeric" })}</time><div>${u.title ? `<h3>${esc(u.title)}</h3>` : ""}<div class="prose">${md(u.body)}</div>${(u.disclaimer || "").trim() ? `<div class="inline-note"><p class="label">Note</p><p>${inline(u.disclaimer)}</p></div>` : ""}${(u.sources || []).length ? `<div class="upd-sources"><p class="label">Sources</p>${sourcesList(u.sources)}</div>` : ""}</div></article>`).join("")}` : ""}
      ${related.length ? `<h2 class="sec related">Writing on this project</h2>${related.map(w => postRow(w, [])).join("")}` : ""}`
  };
}

const tagLine = tags => (tags || []).length
  ? `<p class="tags">${tags.map(t => `<a href="#/writing?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join(", ")}</p>` : "";

const postRow = (w, P) => {
  const proj = P.find(p => p.id === w.projectId);
  const isUpd = w.type === "update";
  const title = esc(w.title || (proj ? `Update on ${proj.title}` : "Project update"));
  const href = isUpd ? `/projects/${esc(proj?.slug || "")}` : `/writing/${esc(w.slug)}`;
  return `<article class="post"><time datetime="${w.date}">${D(w.date, { day: "numeric", month: "short", year: "numeric" })}</time>
    <div><h3><a href="${href}">${title}</a></h3>
    ${proj ? `<p class="from">${isUpd ? "Update &middot; " : ""}<a href="/projects/${esc(proj.slug)}">${esc(proj.title)}</a></p>` : ""}
    <p>${esc(w.excerpt || excerpt(w.body, 170))}</p>${tagLine(w.tags)}</div></article>`;
};

async function writing(_, q) {
  const [W0, P] = await Promise.all([data.posts(), data.projects()]);
  const W = W0;
  const f = q.get("project") || "all";
  const tag = q.get("tag") || "";
  let list = W.filter(w => f === "all" ? true : f === "none" ? !w.projectId : f === "updates" ? w.type === "update" : w.projectId === f);
  if (tag) list = list.filter(w => (w.tags || []).includes(tag));
  const cur = k => f === k ? ' aria-current="true"' : "";
  const used = P.filter(p => W.some(w => w.projectId === p.id));
  return {
    title: "Writing",
    html: `<h1 class="page-title">Writing</h1><p class="page-sub">Everything I've written lately, newest first.</p>
      <nav class="filters" aria-label="Filter writing">
        <a href="#/writing"${cur("all")}>All</a><a href="#/writing?project=none"${cur("none")}>Standalone</a>
        <a href="#/writing?project=updates"${cur("updates")}>Updates</a>
        ${used.map(p => `<a href="#/writing?project=${esc(p.id)}"${cur(p.id)}>${esc(p.title)}</a>`).join("")}
      </nav>
      ${tag ? `<p class="page-sub">Tagged &ldquo;${esc(tag)}&rdquo;. <a href="#/writing${f === "all" ? "" : `?project=${esc(f)}`}">Clear tag</a></p>` : ""}
      ${list.length ? list.map(w => postRow(w, P)).join("") : `<p class="empty">Nothing here yet.</p>`}`
  };
}

async function post([, slug]) {
  const [W, P] = await Promise.all([data.posts(), data.projects()]);
  const w = W.find(x => x.slug === slug);
  if (!w) return notFound();
  const proj = P.find(p => p.id === w.projectId);
  const sources = (w.sources || []).filter(s => (s.citation || "").trim());

  // Articles only (no updates), already newest-first from data.posts(). Prev/next give a
  // chronological thread through everything; tag overlap surfaces genuinely related reading
  // when there is any, rather than a generic "recommended" grid with nothing to recommend.
  const articles = W.filter(x => x.type !== "update");
  const idx = articles.findIndex(x => x.slug === slug);
  const newer = idx > 0 ? articles[idx - 1] : null;
  const older = idx >= 0 && idx < articles.length - 1 ? articles[idx + 1] : null;
  const tags = w.tags || [];
  const related = tags.length ? articles
    .filter(x => x.slug !== slug)
    .map(x => ({ post: x, shared: (x.tags || []).filter(t => tags.includes(t)) }))
    .filter(x => x.shared.length)
    .sort((a, b) => b.shared.length - a.shared.length || (b.post.date || "").localeCompare(a.post.date || ""))
    .slice(0, 3) : [];

  const postNav = (older || newer) ? `<nav class="post-nav">
      ${older ? `<a class="prev" href="/writing/${esc(older.slug)}">&larr; ${esc(older.title)}</a>` : "<span></span>"}
      ${newer ? `<a class="next" href="/writing/${esc(newer.slug)}">${esc(newer.title)} &rarr;</a>` : ""}
    </nav>` : "";
  const furtherReading = related.length
    ? `<h2 class="sec">Further reading</h2><ul class="related-list">${related.map(r =>
        `<li><a href="/writing/${esc(r.post.slug)}">${esc(r.post.title)}</a><span class="via">tagged ${esc(r.shared[0])}</span></li>`).join("")}</ul>`
    : "";

  return {
    title: w.title,
    html: `<h1 class="page-title">${esc(w.title)}</h1>
      <p class="meta">${D(w.date)}, ${readingTime(w.body)} min read${proj ? `. Part of <a href="/projects/${esc(proj.slug)}">${esc(proj.title)}</a>` : ""}</p>
      ${tagLine(w.tags)}
      ${marginNotes(w.disclaimer, sources)}
      ${w.cover ? `<figure class="hero-img"><img src="${esc(w.cover)}" alt=""></figure>` : ""}
      <div class="prose" data-md>${md(w.body)}</div>
      ${postNav}
      ${furtherReading}`
  };
}

async function awards() {
  const A = (await data.timeline()).filter(t => t.kind === "award").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const years = {};
  A.forEach(a => (years[(a.date || "").slice(0, 4) || "Undated"] ||= []).push(a));
  const body = Object.keys(years).sort().reverse().map(y => `
    <section class="yr"><h3 class="yr-n">${esc(y)}</h3>
      <ul class="yr-items">${years[y].map(a => `
        <li><time datetime="${esc(a.date)}">${D(a.date, { day: "numeric", month: "short" })}</time>
          <div><span class="t">${a.link ? `<a href="${esc(a.link)}">${esc(a.award || a.title)}</a>` : esc(a.award || a.title)}</span>${a.event ? `<span class="kind">${esc(a.event)}</span>` : ""}
          ${[a.committee, a.portfolio].filter(Boolean).length ? `<p>${esc([a.committee, a.portfolio].filter(Boolean).join(", "))}</p>` : ""}
          ${a.description ? `<p>${esc(a.description)}</p>` : ""}</div></li>`).join("")}
      </ul></section>`).join("");
  return {
    title: "Awards",
    html: `<h1 class="page-title">Awards</h1><p class="page-sub">Model UN conferences and other competitions.</p>
      ${body ? `<div class="timeline">${body}</div>` : `<p class="empty">Nothing here yet.</p>`}`
  };
}

const bookStars = n => n ? "&#9733;".repeat(n) + "&#9734;".repeat(5 - n) : "";
const bookRow = b => `<li><span class="t">${esc(b.title)}</span>${b.author ? `<span class="by">by ${esc(b.author)}</span>` : ""}${bookStars(b.rating) ? `<span class="stars">${bookStars(b.rating)}</span>` : ""}${b.status !== "Read" ? `<span class="kind">${esc(b.status)}</span>` : ""}${b.review ? `<div class="prose review">${md(b.review)}</div>` : ""}${(b.disclaimer || "").trim() ? `<div class="inline-note"><p class="label">Note</p><p>${inline(b.disclaimer)}</p></div>` : ""}</li>`;

async function books() {
  const B = await data.books();
  const dated = B.filter(b => b.date).sort((a, b) => b.date.localeCompare(a.date));
  const undated = B.filter(b => !b.date);
  const years = {};
  dated.forEach(b => (years[b.date.slice(0, 4)] ||= []).push(b));
  const yearKeys = Object.keys(years).sort().reverse();
  const body = yearKeys.map(y => {
    const n = years[y].length;
    return `<section class="yr"><h3 class="yr-n">${esc(y)}<span class="yr-count">${n} ${n === 1 ? "book" : "books"}</span></h3><ul class="book-list">${years[y].map(bookRow).join("")}</ul></section>`;
  }).join("");
  return {
    title: "Books",
    html: `<h1 class="page-title">Books</h1><p class="page-sub">What I've been reading, and what I thought of it.</p>
      ${undated.length ? `<h2 class="sec">Currently reading</h2><ul class="book-list">${undated.map(bookRow).join("")}</ul>` : ""}
      ${body ? `<div class="timeline">${body}</div>` : (!undated.length ? `<p class="empty">Nothing here yet.</p>` : "")}`
  };
}

async function contact() {
  return {
    title: "Contact",
    html: `<h1 class="page-title">Contact</h1>
      <p class="page-sub">Questions, corrections and critiques of the drafts are all welcome.</p>
      ${S.email ? `<p>Or write directly to <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>.</p>` : ""}
      <form class="contact" id="cf">
        <label>Your name<input name="name" required maxlength="120" autocomplete="name"></label>
        <label>Your email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
        <label>Message<textarea name="message" required maxlength="4000"></textarea></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Send message</button>
        <p class="note" id="cn" role="status"></p>
      </form>`,
    after() {
      const f = $("#cf"), n = $("#cn");
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        if (v.website) return; // honeypot
        const btn = f.querySelector("button"); btn.disabled = true; n.className = "note"; n.textContent = "";
        try {
          await data.sendMessage({ name: v.name.trim(), email: v.email.trim(), message: v.message.trim() });
          f.reset(); n.textContent = "Thank you. Your message has been sent.";
        } catch (err) {
          console.error(err); n.className = "note bad"; n.textContent = "The message was not sent. Check your connection and try again.";
        }
        btn.disabled = false;
      });
    }
  };
}

const notFound = () => ({ title: "Not found", html: `<h1 class="page-title">Not found</h1><p>That page doesn't exist. <a href="/">Go to the home page</a>.</p>` });

/* ---------- link previews ---------- */

// External links show a preview saved in advance from Desk (title, source, date, description, picture).
// Nothing is fetched from third parties when a visitor hovers, except Wikipedia's own free API for Wikipedia links
// that have no saved preview. Links with neither fall back to a plain card.
async function wikiLive(u) {
  try {
    const title = decodeURIComponent(u.pathname.slice(6));
    const r = await fetch(`https://${u.hostname}/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { kind: "wikipedia", title: j.title, site: "Wikipedia", description: j.extract || j.description || "", image: j.thumbnail?.source || "" };
  } catch { return null; }
}

async function externalPreview(u) {
  const host = u.hostname.replace(/^www\./, "");
  const plain = { external: true, title: host, heading: "External link", text: "This opens another website in a new tab.", url: u.href };
  let p = null;
  try { p = await data.preview(u.href); } catch { /* fall back */ }
  if (!p && /(^|\.)wikipedia\.org$/.test(u.hostname) && u.pathname.startsWith("/wiki/")) p = await wikiLive(u);
  if (!p) return plain;
  const ok = v => /^(https:\/\/|data:image\/)/.test(v || "") ? v : "";
  return {
    ...plain, title: p.site || host, heading: p.title || host,
    meta: [p.author, p.date, p.kind === "wikipedia" ? "Wikipedia, CC BY-SA" : host].filter(Boolean).join(", "),
    text: p.description || plain.text, image: ok(p.image), shot: ok(p.shot) || ok(p.shotUrl)
  };
}

async function resolvePreview(url) {
  const u = new URL(url);
  const internal = u.origin === location.origin && u.pathname === location.pathname && u.hash.startsWith("#/");
  if (!internal) return externalPreview(u);
  const path = u.hash.slice(1).split("?")[0].replace(/\/+$/, "") || "/";
  let m;
  if ((m = path.match(/^\/projects\/([^/]+)$/))) {
    const p = (await data.projects()).find(x => x.slug === m[1]);
    if (p) return { title: "Project", image: p.cover, heading: p.title, meta: statusLine(p), text: p.summary || excerpt(p.body, 260), href: "#" + path };
  }
  if ((m = path.match(/^\/writing\/([^/]+)$/))) {
    const w = (await data.posts()).find(x => x.slug === m[1]);
    if (w) return { title: "Writing", image: w.cover, heading: w.title, meta: `${D(w.date)}, ${readingTime(w.body)} min read`, text: w.excerpt || excerpt(w.body, 300), href: "#" + path };
  }
  const plain = { "/": ["Home", S.siteTitle, S.tagline], "/about": ["About", "About", excerpt(S.about, 260)], "/projects": ["Projects", "Projects", "Long-running work, each with its own record."], "/writing": ["Writing", "Writing", "Everything written lately, newest first."], "/awards": ["Awards", "Awards", "Model UN conferences and other competitions."], "/contact": ["Contact", "Contact", "Questions, corrections and critiques are welcome."] }[path];
  if (plain) return { title: plain[0], heading: plain[1], text: plain[2], href: "#" + path };
  return { title: "Page", heading: path, text: "", href: "#" + path };
}

/* ---------- router ---------- */

const routes = [
  [/^\/$/, home], [/^\/about$/, about], [/^\/projects$/, projects], [/^\/projects\/([^/]+)$/, project],
  [/^\/awards$/, awards], [/^\/books$/, books], [/^\/writing$/, writing], [/^\/writing\/([^/]+)$/, post], [/^\/contact$/, contact]
];

// Small-caps the article's actual first rendered line (not a fixed word count, and not a
// ::first-line rule -- ::first-line doesn't combine reliably with the floated drop-cap letter
// across browsers). Measures where the browser really wraps the line with getClientRects(),
// under the small-caps style already applied (its glyphs are wider than lowercase, so measuring
// the plain text and transforming it afterwards would shift the wrap point). Re-run on resize
// and once web fonts finish loading, since both can shift where the line actually wraps.
function unwrapLede(p) {
  const span = p.querySelector(":scope > .lede-caps");
  if (!span) return;
  while (span.firstChild) span.before(span.firstChild);
  span.remove();
  p.normalize();
}

function capLede(root) {
  root.querySelectorAll(".prose[data-md] > p:first-of-type").forEach(p => {
    unwrapLede(p);
    const first = p.firstChild;
    // Bail if the paragraph doesn't start with plain text: wrapping would otherwise have to
    // reach into a link/emphasis/footnote and strip it out of its inline element.
    if (!first || first.nodeType !== Node.TEXT_NODE) return;
    const directNodes = [];
    let n = first, text = "";
    while (n && n.nodeType === Node.TEXT_NODE) { directNodes.push(n); text += n.textContent; n = n.nextSibling; }
    if (text.length < 2) return;

    const span = document.createElement("span");
    span.className = "lede-caps";
    directNodes[0].before(span);
    directNodes.forEach(dn => span.appendChild(dn));

    const rectAt = (startLen, endLen) => {
      const locate = len => {
        let remaining = len, target = null, offset = 0;
        for (const dn of directNodes) {
          if (remaining <= dn.textContent.length) { target = dn; offset = remaining; break; }
          remaining -= dn.textContent.length;
        }
        return [target, offset];
      };
      const [sN, sO] = locate(startLen), [eN, eO] = locate(endLen);
      if (!sN || !eN) return null;
      const r = document.createRange();
      r.setStart(sN, sO); r.setEnd(eN, eO);
      const rects = r.getClientRects();
      return rects.length ? rects[0].top : null;
    };
    // Reference the 2nd character, not the 1st: the 1st is the floated drop-cap letter,
    // whose box sits in a different position than the surrounding first line of text.
    const lineTop = rectAt(1, 2);
    let best = text.length;
    if (lineTop != null) {
      let lo = 2, hi = text.length;
      best = 2;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const top = rectAt(mid - 1, mid);
        if (top != null && Math.abs(top - lineTop) < 1) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      // Don't split a word: if the character just before the cut is mid-word, push forward
      // to the next space.
      while (best > 0 && best < text.length && !/\s/.test(text[best - 1])) best++;
    }
    if (best >= text.length) return; // the whole run fits on the line; span already covers it

    let remaining = best, splitNode = null, splitOffset = 0;
    for (const dn of directNodes) {
      if (remaining <= dn.textContent.length) { splitNode = dn; splitOffset = remaining; break; }
      remaining -= dn.textContent.length;
    }
    const after = splitNode.splitText(splitOffset);
    let moveNode = after, insertAfter = span;
    while (moveNode) {
      const next = moveNode.nextSibling;
      insertAfter.after(moveNode);
      insertAfter = moveNode;
      moveNode = next;
    }
  });
}

let ledeResizeTimer;
window.addEventListener("resize", () => { clearTimeout(ledeResizeTimer); ledeResizeTimer = setTimeout(() => capLede(view), 150); });
document.fonts?.ready?.then(() => capLede(view));

function decorate(root) {
  capLede(root);
  root.querySelectorAll("a[href]").forEach(a => {
    let href = a.getAttribute("href");
    // Authors can write /projects/my-project in markdown; on this site that means #/projects/my-project.
    if (/^\/(?!\/)/.test(href)) { href = "#" + href; a.setAttribute("href", href); }
    if (/^(mailto:|tel:)/.test(href) || a.dataset.fn) return;
    const route = href.startsWith("#/");
    if (href.startsWith("#") && !route) return;
    if (!route) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    if (a.closest(".filters")) return;
    // Image-only links (linked images, project covers) just turn to colour on hover. No preview window.
    if (a.querySelector("img, figure") && !a.textContent.trim()) return;
    a.classList.add("peek");
  });
}

async function renderPage(keepScroll = false) {
  const y = window.scrollY;
  closeAll();
  const raw = location.hash.startsWith("#/") ? location.hash.slice(1) : "/";
  const [pathPart, qs = ""] = raw.split("?");
  const path = pathPart.replace(/\/+$/, "") || "/";
  let out = notFound();
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      try { out = await fn(m, new URLSearchParams(qs)); }
      catch (err) { console.error(err); out = { title: "Error", html: `<h1 class="page-title">Something went wrong</h1><p>The page could not be loaded. Try again in a moment.</p>` }; }
      break;
    }
  }
  view.innerHTML = out.html;
  document.title = out.title ? `${out.title} | ${S.siteTitle}` : S.siteTitle;
  decorate(view);
  out.after?.();
  document.querySelectorAll("#nav a").forEach(a => {
    const p = a.getAttribute("href").slice(1);
    a.toggleAttribute("aria-current", path === p || path.startsWith(p + "/"));
    if (a.hasAttribute("aria-current")) a.setAttribute("aria-current", "page");
  });
  window.scrollTo(0, keepScroll === true ? y : 0);
}

// Footnote links scroll within the page and never change the page address.
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-fn]");
  if (!a) return;
  e.preventDefault();
  document.getElementById(a.dataset.fn)?.scrollIntoView({ block: "center" });
});
window.addEventListener("hashchange", () => renderPage());

function chrome() {
  $("#wordmark").textContent = S.siteTitle;
  $("#foot").innerHTML = `<p>${esc(S.footerNote)}</p><p>&copy; ${new Date().getFullYear()} ${esc(S.siteTitle)}${data.demoMode ? ". Demo content." : ""} &middot; Design inspired by <a href="https://gwern.net">gwern.net</a></p>`;
}

(async function start() {
  initPopups(resolvePreview);
  view.innerHTML = `<p class="empty" style="margin-top:3rem">Loading…</p>`;
  try { S = await data.settings(); } catch (err) { console.error(err); S = { siteTitle: "Aryamann Reet", footerNote: "" }; }
  chrome();
  renderPage();
  // When fresh data from Firebase differs from the saved copy shown first, quietly update the page.
  let t;
  window.addEventListener("data:updated", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (location.hash.startsWith("#/contact")) return; // don't wipe a half-written message
      try { S = await data.settings(); } catch { /* keep current */ }
      chrome(); renderPage(true);
    }, 150);
  });
})();
