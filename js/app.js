import * as data from "./db.js";
import { render as mdRender, inline as mdInline } from "./md.js";
import { initPopups, closeAll } from "./popup.js";
import { createRenderer, matchRoute, footerHtml, statusLine, D, excerpt, readingTime } from "./render.js";

const $ = (s, r = document) => r.querySelector(s);

// The site's own address below the domain root -- "" when hosted at the root (as on
// Cloudflare Pages at aryamannreet.in), or e.g. "/reponame" if ever hosted under a
// subpath. Derived from where this module itself was loaded from, so it's correct
// wherever the site is hosted without any build step or manual configuration.
const BASE = new URL("../", import.meta.url).pathname.replace(/\/+$/, "");

// Page templates live in render.js, shared with the Pages Function that server-renders them.
const { renderRoute } = createRenderer({ render: mdRender, inline: mdInline });

let S = {};
const view = $("#view");

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
  const internal = u.origin === location.origin && (u.pathname === BASE || u.pathname.startsWith(BASE + "/"));
  if (!internal) return externalPreview(u);
  const path = (u.pathname.slice(BASE.length) || "/").replace(/\/+$/, "") || "/";
  let m;
  if ((m = path.match(/^\/projects\/([^/]+)$/))) {
    const p = (await data.projects()).find(x => x.slug === m[1]);
    if (p) return { title: "Project", image: p.cover, heading: p.title, meta: statusLine(p), text: p.summary || excerpt(p.body, 260), href: BASE + path };
  }
  if ((m = path.match(/^\/writing\/([^/]+)$/))) {
    const w = (await data.posts()).find(x => x.slug === m[1]);
    if (w) return { title: "Writing", image: w.cover, heading: w.title, meta: `${D(w.date)}, ${readingTime(w.body)} min read`, text: w.excerpt || excerpt(w.body, 300), href: BASE + path };
  }
  const plain = { "/": ["Home", S.siteTitle, S.tagline], "/about": ["About", "About", excerpt(S.about, 260)], "/projects": ["Projects", "Projects", "Long-running work, each with its own record."], "/writing": ["Writing", "Writing", "Everything written lately, newest first."], "/awards": ["Awards", "Awards", "Model UN conferences and other competitions."], "/contact": ["Contact", "Contact", "Questions, corrections and critiques are welcome."] }[path];
  if (plain) return { title: plain[0], heading: plain[1], text: plain[2], href: BASE + path };
  return { title: "Page", heading: path, text: "", href: BASE + path };
}

/* ---------- router ---------- */


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

// Clamp a writing-list excerpt to a few lines with a "Read more" toggle, instead of a hard
// character cutoff. Removes the button entirely when the text already fits unclamped.
function wireReadMore(root) {
  root.querySelectorAll(".excerpt-wrap").forEach(wrap => {
    const p = wrap.querySelector(".excerpt");
    const btn = wrap.querySelector(".read-more");
    if (!p || !btn) return;
    if (p.scrollHeight <= p.clientHeight + 1) { btn.remove(); return; }
    btn.addEventListener("click", () => {
      const clamped = p.classList.toggle("clamped");
      btn.textContent = clamped ? "Read more" : "Show less";
    });
  });
}

function decorate(root) {
  capLede(root);
  wireReadMore(root);
  root.querySelectorAll("a[href]").forEach(a => {
    const raw = a.getAttribute("href");
    if (/^(mailto:|tel:)/.test(raw) || a.dataset.fn || raw.startsWith("#")) return;
    // Authors can write /projects/my-project in markdown; resolve it to this site's real address.
    const route = /^\/(?!\/)/.test(raw);
    if (route) a.setAttribute("href", BASE + raw);
    else { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    if (a.closest(".filters")) return;
    // Image-only links (linked images, project covers) just turn to colour on hover. No preview window.
    if (a.querySelector("img, figure") && !a.textContent.trim()) return;
    a.classList.add("peek");
  });
}

function currentPath() {
  let p = location.pathname;
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/+$/, "") || "/";
}

const renderCtx = () => ({ data, S, BASE, origin: location.origin, year: new Date().getFullYear(), demoMode: data.demoMode });

function wireContact() {
  const f = $("#cf"), n = $("#cn");
  if (!f || !n) return;
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

// Behaviour a page needs once its markup is in the document, whoever rendered the markup.
const afterRender = kind => { if (kind === "contact") wireContact(); };

async function renderPage(keepScroll = false) {
  const y = window.scrollY;
  closeAll();
  const path = currentPath();
  let out;
  try { out = await renderRoute(path, new URLSearchParams(location.search), renderCtx()); }
  catch (err) { console.error(err); out = { kind: "error", title: "Error", html: `<h1 class="page-title">Something went wrong</h1><p>The page could not be loaded. Try again in a moment.</p>` }; }
  view.innerHTML = out.html;
  document.title = out.title ? `${out.title} | ${S.siteTitle}` : S.siteTitle;
  $('meta[name="description"]')?.setAttribute("content", out.description || S.tagline || "");
  $('link[rel="canonical"]')?.setAttribute("href", location.origin + BASE + path);
  $("#ldRoute").textContent = out.structured ? JSON.stringify(out.structured) : "";
  decorate(view);
  afterRender(out.kind);
  document.querySelectorAll("#nav a").forEach(a => {
    const p = a.getAttribute("href").slice(BASE.length) || "/";
    a.toggleAttribute("aria-current", path === p || path.startsWith(p + "/"));
    if (a.hasAttribute("aria-current")) a.setAttribute("aria-current", "page");
  });
  window.scrollTo(0, keepScroll === true ? y : 0);
}

// The Pages Function marks a page it already rendered (data-ssr). Keep that markup -- no
// "Loading..." flash and no second render -- and attach only what the browser adds on top.
function hydrate() {
  view.removeAttribute("data-ssr");
  decorate(view);
  afterRender(matchRoute(currentPath())?.kind);
}

// Footnote links scroll within the page and never change the page address.
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-fn]");
  if (!a) return;
  e.preventDefault();
  document.getElementById(a.dataset.fn)?.scrollIntoView({ block: "center" });
});

// Any same-origin, in-scope link -- in the nav, in rendered content, or in a preview
// window's "Open page" button -- is a soft navigation (pushState + re-render), not a
// full page load. Real paths outside this site's BASE, external links, and links the
// browser is being asked to open some other way (new tab, modifier key) fall through
// to normal browser handling.
document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]");
  if (!a || a.target === "_blank" || a.dataset.fn) return;
  let u;
  try { u = new URL(a.href); } catch { return; }
  if (u.origin !== location.origin || !(u.pathname === BASE || u.pathname.startsWith(BASE + "/"))) return;
  e.preventDefault();
  if (u.href !== location.href) history.pushState(null, "", u.href);
  renderPage();
});
window.addEventListener("popstate", () => renderPage());

// Theme toggle. js/init-theme.js already applied the saved/OS choice before first paint;
// this just keeps the button's label in sync and persists the visitor's choice.
function initThemeToggle() {
  const btn = $("#themeToggle");
  if (!btn) return;
  const sync = () => {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    const label = light ? "Switch to dark mode" : "Switch to light mode";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    $('meta[name="theme-color"]')?.setAttribute("content", light ? "#ffffff" : "#2b2b2c");
  };
  sync();
  btn.addEventListener("click", () => {
    const light = document.documentElement.getAttribute("data-theme") !== "light";
    if (light) document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("ar:theme", light ? "light" : "dark"); } catch { /* storage blocked */ }
    sync();
  });
}

// Paper-layout toggle. js/init-theme.js already applied the saved choice before first paint;
// this just keeps the button's label in sync and persists the visitor's choice, same pattern
// as initThemeToggle above.
function initLayoutToggle() {
  const btn = $("#layoutToggle");
  if (!btn) return;
  const sync = () => {
    const paper = document.documentElement.getAttribute("data-layout") === "paper";
    const label = paper ? "Switch to normal layout" : "Switch to newspaper layout";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.classList.toggle("is-on", paper);
  };
  sync();
  btn.addEventListener("click", () => {
    const paper = document.documentElement.getAttribute("data-layout") !== "paper";
    if (paper) document.documentElement.setAttribute("data-layout", "paper");
    else document.documentElement.removeAttribute("data-layout");
    try { localStorage.setItem("ar:layout", paper ? "paper" : "normal"); } catch { /* storage blocked */ }
    sync();
  });
}

// Function in app.js that renders article views (e.g. /writing/[slug] or /projects/[slug])
function renderArticlePage(articleData) {
  const viewContainer = document.getElementById("view");

  // Render article content + append manifesto block at the end
  viewContainer.innerHTML = `
    <article class="article-body">
      <h1>${articleData.title}</h1>
      <div class="article-content">${articleData.content}</div>
    </article>

    <section class="manifesto-wrapper">
      <h3 class="manifesto-heading">Principles & Perspectives</h3>
      <div class="manifesto" id="manifesto">
        <div class="manifesto-box">
          <div class="manifesto-head">
            <h2 class="manifesto-title" id="mTitle"></h2>
          </div>
          <p class="manifesto-text" id="mText"></p>
        </div>
      </div>
    </section>
  `;

  // Initialize the random selection logic after rendering DOM
  if (typeof initManifesto === "function") {
    initManifesto();
  }
}
function chrome() {
  $("#wordmark").textContent = S.siteTitle;
  $("#foot").innerHTML = footerHtml({ S, BASE, demoMode: data.demoMode, year: new Date().getFullYear() });
}

(async function start() {
  initPopups(resolvePreview);
  initThemeToggle();
  initLayoutToggle();
  // The nav and wordmark are static markup in index.html, written as root-relative links
  // ("/projects"); they only need the BASE prefix once, not on every render like `view` does.
  document.querySelectorAll('header.top a[href^="/"]').forEach(a => a.setAttribute("href", BASE + a.getAttribute("href")));
const ssr = view.hasAttribute("data-ssr");
  if (ssr) hydrate();
  else view.innerHTML = `<p class="empty" data-nosnippet style="margin-top:3rem">Loading…</p>`;
  let loaded = true;
  try { S = await data.settings(); } catch (err) { loaded = false; console.error(err); S = { siteTitle: "Aryamann Reet", footerNote: "" }; }
  // If settings can't load, don't replace a server-rendered footer with the bare fallback.
  if (loaded || !ssr) chrome();
  if (!ssr) renderPage();
  // When fresh data from Firebase differs from the saved copy shown first, quietly update the page.
  let t;
  window.addEventListener("data:updated", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (currentPath() === "/contact") return; // don't wipe a half-written message
      try { S = await data.settings(); } catch { /* keep current */ }
      chrome(); renderPage(true);
    }, 150);
  });
})();
