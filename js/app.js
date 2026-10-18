import * as data from "./db.js";
import { render as md, excerpt, readingTime } from "./md.js";
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

  const items = [
    ...T.map(t => ({ date: t.date, title: t.title, desc: t.description, href: t.link || "", kind: "milestone" })),
    ...W.map(p => ({ date: p.date, title: p.title, desc: p.excerpt || excerpt(p.body, 130), href: `/writing/${p.slug}`, kind: "writing" })),
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

async function project([, slug]) {
  const [P, W] = await Promise.all([data.projects(), data.posts()]);
  const p = P.find(x => x.slug === slug);
  if (!p) return notFound();
  const related = W.filter(w => w.projectId === p.id);
  return {
    title: p.title,
    html: `<h1 class="page-title">${esc(p.title)}</h1><p class="meta">${esc(statusLine(p))}</p>
      ${p.cover ? `<figure class="hero-img"><img src="${esc(p.cover)}" alt=""></figure>` : ""}
      <div class="prose" data-md>${md(p.body)}</div>
      ${related.length ? `<h2 class="sec related">Writing on this project</h2>${related.map(w => postRow(w, [])).join("")}` : ""}`
  };
}

const postRow = (w, P) => {
  const proj = P.find(p => p.id === w.projectId);
  return `<article class="post"><time datetime="${w.date}">${D(w.date, { day: "numeric", month: "short", year: "numeric" })}</time>
    <div><h3><a href="/writing/${esc(w.slug)}">${esc(w.title)}</a></h3>
    ${proj ? `<p class="from">${esc(proj.title)}</p>` : ""}
    <p>${esc(w.excerpt || excerpt(w.body, 170))}</p></div></article>`;
};

async function writing(_, q) {
  const [W, P] = await Promise.all([data.posts(), data.projects()]);
  const f = q.get("project") || "all";
  const list = W.filter(w => f === "all" || (f === "none" ? !w.projectId : w.projectId === f));
  const cur = k => f === k ? ' aria-current="true"' : "";
  const used = P.filter(p => W.some(w => w.projectId === p.id));
  return {
    title: "Writing",
    html: `<h1 class="page-title">Writing</h1><p class="page-sub">Everything I've written lately, newest first.</p>
      <nav class="filters" aria-label="Filter writing">
        <a href="#/writing"${cur("all")}>All</a><a href="#/writing?project=none"${cur("none")}>Standalone</a>
        ${used.map(p => `<a href="#/writing?project=${esc(p.id)}"${cur(p.id)}>${esc(p.title)}</a>`).join("")}
      </nav>
      ${list.length ? list.map(w => postRow(w, P)).join("") : `<p class="empty">Nothing here yet.</p>`}`
  };
}

async function post([, slug]) {
  const [W, P] = await Promise.all([data.posts(), data.projects()]);
  const w = W.find(x => x.slug === slug);
  if (!w) return notFound();
  const proj = P.find(p => p.id === w.projectId);
  return {
    title: w.title,
    html: `<h1 class="page-title">${esc(w.title)}</h1>
      <p class="meta">${D(w.date)}, ${readingTime(w.body)} min read${proj ? `. Part of <a href="/projects/${esc(proj.slug)}">${esc(proj.title)}</a>` : ""}</p>
      ${w.cover ? `<figure class="hero-img"><img src="${esc(w.cover)}" alt=""></figure>` : ""}
      <div class="prose" data-md>${md(w.body)}</div>`
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

async function resolvePreview(url) {
  const u = new URL(url);
  const internal = u.origin === location.origin && u.pathname === location.pathname && u.hash.startsWith("#/");
  if (!internal) return { external: true, title: u.hostname.replace(/^www\./, ""), heading: "External link", text: "This opens another website in a new tab.", url: u.href };
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
  const plain = { "/": ["Home", S.siteTitle, S.tagline], "/about": ["About", "About", excerpt(S.about, 260)], "/projects": ["Projects", "Projects", "Long-running work, each with its own record."], "/writing": ["Writing", "Writing", "Everything written lately, newest first."], "/contact": ["Contact", "Contact", "Questions, corrections and critiques are welcome."] }[path];
  if (plain) return { title: plain[0], heading: plain[1], text: plain[2], href: "#" + path };
  return { title: "Page", heading: path, text: "", href: "#" + path };
}

/* ---------- router ---------- */

const routes = [
  [/^\/$/, home], [/^\/about$/, about], [/^\/projects$/, projects], [/^\/projects\/([^/]+)$/, project],
  [/^\/writing$/, writing], [/^\/writing\/([^/]+)$/, post], [/^\/contact$/, contact]
];

function decorate(root) {
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
  $("#foot").innerHTML = `<p>${esc(S.footerNote)}</p><p>&copy; ${new Date().getFullYear()} ${esc(S.siteTitle)}${data.demoMode ? ". Demo content." : ""}</p>`;
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
