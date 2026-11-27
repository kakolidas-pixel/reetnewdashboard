// Page rendering shared by the browser (js/app.js) and the Cloudflare Pages Function
// (functions/[[path]].js), so a server-rendered page and a client-rendered one come from the
// same templates. Pure: no DOM, no globals. Everything environment-specific arrives in `ctx`:
//   data   { settings, projects, posts, timeline, books } -> promises of site content
//   S      the settings document
//   BASE   the site's own path prefix ("" at the domain root)
//   origin e.g. "https://aryamannreet.in" (for absolute URLs in structured data)
//   year   current year (copyright page)
import { excerpt, readingTime } from "./mdcore.js";

export { excerpt, readingTime };

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const D = (iso, o = { day: "numeric", month: "long", year: "numeric" }) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", o) : "";
const MY = { month: "long", year: "numeric" };

export function statusLine(p) {
  const st = p.status || "Ongoing";
  if (st === "Ongoing") return `Ongoing, since ${D(p.startDate, MY)}`;
  if (st === "Complete") return `Completed ${D(p.endDate || p.startDate, MY)}`;
  return st;
}

export const footerHtml = ({ S, BASE, demoMode, year }) =>
  `<p>${esc(S.footerNote)}</p><p>&copy; ${year} ${esc(S.siteTitle)}${demoMode ? ". Demo content." : ""} &middot; Design inspired by <a href="https://gwern.net">gwern.net</a> &middot; <a href="${BASE}/privacy">Privacy</a> &middot; <a href="${BASE}/copyright">Copyright</a></p>`;

const ROUTES = [
  ["home", /^\/$/], ["about", /^\/about$/], ["projects", /^\/projects$/], ["project", /^\/projects\/([^/]+)$/],
  ["awards", /^\/awards$/], ["books", /^\/books$/], ["writing", /^\/writing$/], ["post", /^\/writing\/([^/]+)$/],
  ["contact", /^\/contact$/], ["privacy", /^\/privacy$/], ["copyright", /^\/copyright$/]
];

// Which page a path (already stripped of BASE and any trailing slash) belongs to, or null.
export function matchRoute(path) {
  for (const [kind, re] of ROUTES) {
    const m = path.match(re);
    if (m) return { kind, params: m.slice(1) };
  }
  return null;
}

const notFound = () => ({
  kind: "notfound", status: 404, title: "Not found",
  html: `<h1 class="page-title">Not found</h1><p>That page doesn't exist. <a href="/">Go to the home page</a>.</p>`
});

// `md` is { render, inline }: markdown to sanitized HTML, supplied by the host (DOMPurify in the
// browser, js/sanitize.js on the server).
export function createRenderer({ render: md, inline }) {
  const projectEntry = p => `
  <article class="entry ${p.cover ? "" : "no-cover"}">
    <div>
      <h3><a href="/projects/${esc(p.slug)}">${esc(p.title)}</a></h3>
      <p class="status">${esc(statusLine(p))}</p>
      <p>${esc(p.summary || excerpt(p.body, 200))}</p>
    </div>
    ${p.cover ? `<a class="cover" href="/projects/${esc(p.slug)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.cover)}" alt="" loading="lazy"></a>` : ""}
  </article>`;

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

  const tagLine = tags => (tags || []).length
    ? `<p class="tags">${tags.map(t => `<a href="/writing?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join(", ")}</p>` : "";

  const postRow = (w, P) => {
    const proj = P.find(p => p.id === w.projectId);
    const isUpd = w.type === "update";
    const title = esc(w.title || (proj ? `Update on ${proj.title}` : "Project update"));
    const href = isUpd ? `/projects/${esc(proj?.slug || "")}` : `/writing/${esc(w.slug)}`;
    return `<article class="post"><time datetime="${w.date}">${D(w.date, { day: "numeric", month: "short", year: "numeric" })}</time>
    <div><h3><a href="${href}">${title}</a></h3>
    ${proj ? `<p class="from">${isUpd ? "Update &middot; " : ""}<a href="/projects/${esc(proj.slug)}">${esc(proj.title)}</a></p>` : ""}
    <div class="excerpt-wrap"><p class="excerpt clamped">${esc(w.excerpt || excerpt(w.body, 500))}</p><button type="button" class="read-more">Read more</button></div>${tagLine(w.tags)}</div></article>`;
  };

  const bookStars = n => n ? "&#9733;".repeat(n) + "&#9734;".repeat(5 - n) : "";
  const bookRow = b => `<li><span class="t">${esc(b.title)}</span>${b.author ? `<span class="by">by ${esc(b.author)}</span>` : ""}${bookStars(b.rating) ? `<span class="stars">${bookStars(b.rating)}</span>` : ""}${b.status !== "Read" ? `<span class="kind">${esc(b.status)}</span>` : ""}${b.review ? `<div class="prose review">${md(b.review)}</div>` : ""}${(b.disclaimer || "").trim() ? `<div class="inline-note"><p class="label">Note</p><p>${inline(b.disclaimer)}</p></div>` : ""}</li>`;

  const views = {
    async home(_, __, { data, S }) {
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
        description: S.tagline || excerpt(S.intro, 160),
        html: `
      <h1 class="name">${esc(S.siteTitle)}</h1>
      ${S.tagline ? `<p class="tagline">${esc(S.tagline)}</p>` : ""}
      ${S.showSchool && S.school ? `<p class="where">${esc(S.school)}</p>` : ""}
      <div class="prose lede">${md(S.intro)}</div>
      ${feat ? `<h2 class="sec">Currently working on</h2>${projectEntry(feat)}` : ""}
      <h2 class="sec">Timeline</h2>
      ${tl ? `<div class="timeline">${tl}</div>` : `<p class="empty">Nothing here yet. Entries appear as work is published.</p>`}`
      };
    },

    async about(_, __, { S }) {
      const portrait = S.portrait ? `<div class="portrait"><img src="${esc(S.portrait)}" alt="Portrait of ${esc(S.siteTitle)}" loading="lazy"></div>` : "";
      const links = (S.links || []).length ? `<ul class="links">${S.links.map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join("")}</ul>` : "";
      return {
        title: "About",
        description: excerpt(S.about, 160) || `About ${S.siteTitle}.`,
        html: `<h1 class="page-title">About</h1>
      ${S.showSchool && S.school ? `<p class="page-sub">${esc(S.school)}</p>` : ""}
      <div class="${portrait ? "about-grid" : ""}"><div><div class="prose">${md(S.about) || `<p class="empty">Nothing written yet.</p>`}</div>${links}</div>${portrait}</div>`
      };
    },

    async projects(_, __, { data }) {
      const P = await data.projects();
      return {
        title: "Projects",
        description: "Long-running work, each with its own record.",
        html: `<h1 class="page-title">Projects</h1><p class="page-sub">Long-running work, each with its own record.</p>
      ${P.length ? P.map(projectEntry).join("") : `<p class="empty">No projects published yet.</p>`}`
      };
    },

    async project([slug], _, { data, S, BASE, origin }) {
      const [P, W] = await Promise.all([data.projects(), data.posts()]);
      const p = P.find(x => x.slug === slug);
      if (!p) return notFound();
      const related = W.filter(w => w.projectId === p.id && w.type !== "update");
      const updates = W.filter(w => w.projectId === p.id && w.type === "update");
      const sources = (p.sources || []).filter(s => (s.citation || "").trim());
      return {
        title: p.title,
        description: p.summary || excerpt(p.body, 160),
        image: p.cover || "",
        structured: {
          "@context": "https://schema.org", "@type": "CreativeWork",
          name: p.title, description: p.summary || excerpt(p.body, 260),
          url: origin + BASE + "/projects/" + p.slug,
          ...(p.startDate ? { dateCreated: p.startDate } : {}),
          ...(p.cover ? { image: p.cover } : {}),
          author: { "@type": "Person", name: S.siteTitle }
        },
        html: `<h1 class="page-title">${esc(p.title)}</h1><p class="meta">${esc(statusLine(p))}</p>
      ${tagLine(p.tags)}
      ${marginNotes(p.disclaimer, sources)}
      ${p.cover ? `<figure class="hero-img"><img src="${esc(p.cover)}" alt=""></figure>` : ""}
      <div class="prose" data-md>${md(p.body)}</div>
      ${updates.length ? `<h2 class="sec">Updates</h2>${updates.map(u => `<article class="upd"><time datetime="${u.date}">${D(u.date, { day: "numeric", month: "short", year: "numeric" })}</time><div><h3><a href="/writing/${esc(u.slug)}">${esc(u.title || "Update")}</a></h3><div class="prose">${md(u.body)}</div>${(u.disclaimer || "").trim() ? `<div class="inline-note"><p class="label">Note</p><p>${inline(u.disclaimer)}</p></div>` : ""}${(u.sources || []).length ? `<div class="upd-sources"><p class="label">Sources</p>${sourcesList(u.sources)}</div>` : ""}</div></article>`).join("")}` : ""}
      ${related.length ? `<h2 class="sec related">Writing on this project</h2>${related.map(w => postRow(w, [])).join("")}` : ""}`
      };
    },

    async writing(_, q, { data }) {
      const [W, P] = await Promise.all([data.posts(), data.projects()]);
      const f = q.get("project") || "all";
      const tag = q.get("tag") || "";
      let list = W.filter(w => f === "all" ? true : f === "none" ? !w.projectId : f === "updates" ? w.type === "update" : w.projectId === f);
      if (tag) list = list.filter(w => (w.tags || []).includes(tag));
      const cur = k => f === k ? ' aria-current="true"' : "";
      const used = P.filter(p => W.some(w => w.projectId === p.id));
      return {
        title: "Writing",
        description: "Everything I've written lately, newest first.",
        html: `<h1 class="page-title">Writing</h1><p class="page-sub">Everything I've written lately, newest first.</p>
      <nav class="filters" aria-label="Filter writing">
        <a href="/writing"${cur("all")}>All</a><a href="/writing?project=none"${cur("none")}>Standalone</a>
        <a href="/writing?project=updates"${cur("updates")}>Updates</a>
        ${used.map(p => `<a href="/writing?project=${esc(p.id)}"${cur(p.id)}>${esc(p.title)}</a>`).join("")}
      </nav>
      ${tag ? `<p class="page-sub">Tagged &ldquo;${esc(tag)}&rdquo;. <a href="/writing${f === "all" ? "" : `?project=${esc(f)}`}">Clear tag</a></p>` : ""}
      ${list.length ? list.map(w => postRow(w, P)).join("") : `<p class="empty">Nothing here yet.</p>`}`
      };
    },

    async post([slug], _, { data, S, BASE, origin }) {
      const [W, P] = await Promise.all([data.posts(), data.projects()]);
      const w = W.find(x => x.slug === slug);
      if (!w) return notFound();
      const proj = P.find(p => p.id === w.projectId);
      const sources = (w.sources || []).filter(s => (s.citation || "").trim());
      // An update may not have its own title -- fall back the same way the Writing list already does.
      const title = w.title || (w.type === "update" ? (proj ? `Update on ${proj.title}` : "Project update") : "Untitled");

      // Articles only (no updates), already newest-first from data.posts(). Tag overlap surfaces
      // genuinely related reading when there is any, rather than a generic "recommended" grid
      // with nothing to recommend.
      const articles = W.filter(x => x.type !== "update");
      const tags = w.tags || [];
      const related = tags.length ? articles
        .filter(x => x.slug !== slug)
        .map(x => ({ post: x, shared: (x.tags || []).filter(t => tags.includes(t)) }))
        .filter(x => x.shared.length)
        .sort((a, b) => b.shared.length - a.shared.length || (b.post.date || "").localeCompare(a.post.date || ""))
        .slice(0, 6) : [];
      const furtherReading = related.length
        ? `<h2 class="similar-title">Similar writing</h2><ul class="related-list">${related.map(r =>
            `<li><a href="/writing/${esc(r.post.slug)}">${esc(r.post.title)}</a><span class="via">${esc(r.shared[0])}</span></li>`).join("")}</ul>`
        : "";

      return {
        title,
        description: w.excerpt || excerpt(w.body, 160),
        ogType: "article",
        image: w.cover || "",
        structured: {
          "@context": "https://schema.org", "@type": "BlogPosting",
          headline: title, description: w.excerpt || excerpt(w.body, 260),
          url: origin + BASE + "/writing/" + w.slug,
          ...(w.date ? { datePublished: w.date } : {}),
          ...(w.cover ? { image: w.cover } : {}),
          author: { "@type": "Person", name: S.siteTitle }
        },
        html: `<h1 class="page-title">${esc(title)}</h1>
      <p class="meta">${D(w.date)}, ${readingTime(w.body)} min read${proj ? `. Part of <a href="/projects/${esc(proj.slug)}">${esc(proj.title)}</a>` : ""}</p>
      ${tagLine(w.tags)}
      ${marginNotes(w.disclaimer, sources)}
      ${w.cover ? `<figure class="hero-img"><img src="${esc(w.cover)}" alt=""></figure>` : ""}
      <div class="prose" data-md>${md(w.body)}</div>
      ${furtherReading}`
      };
    },

    async awards(_, __, { data }) {
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
        description: "Model UN conferences and other competitions.",
        html: `<h1 class="page-title">Awards</h1><p class="page-sub">Model UN conferences and other competitions.</p>
      ${body ? `<div class="timeline">${body}</div>` : `<p class="empty">Nothing here yet.</p>`}`
      };
    },

    async books(_, __, { data }) {
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
        description: "What I've been reading, and what I thought of it.",
        html: `<h1 class="page-title">Books</h1><p class="page-sub">What I've been reading, and what I thought of it.</p>
      ${undated.length ? `<h2 class="sec">Currently reading</h2><ul class="book-list">${undated.map(bookRow).join("")}</ul>` : ""}
      ${body ? `<div class="timeline">${body}</div>` : (!undated.length ? `<p class="empty">Nothing here yet.</p>` : "")}`
      };
    },

    async contact(_, __, { S }) {
      return {
        title: "Contact",
        description: "Questions, corrections and critiques of the drafts are all welcome.",
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
        <noscript><p class="note bad">Sending a message needs JavaScript.${S.email ? " Please email instead." : ""}</p></noscript>
      </form>`
      };
    },

    // Static pages (privacy, copyright): fixed text, not edited from Desk, since they describe
    // how the site itself works rather than its content.
    async privacy() {
      return {
        title: "Privacy",
        description: "What this site collects, why, and who can see it.",
        html: `<h1 class="page-title">Privacy</h1><p class="page-sub">What this site collects, and what it doesn't.</p>
      <div class="prose">
      <h2>Short version</h2>
      <p>This site doesn't use cookies, analytics, or advertising, and it doesn't track visitors. The only personal
      information it collects is what's typed into the <a href="/contact">Contact</a> form, sent because someone chose to send it.</p>
      <h2>The contact form</h2>
      <p>Submitting it stores your name, email address and message in this site's database (Google's Firebase/Firestore,
      hosted on infrastructure in the region the project was created in). Only the site's owner can read these messages.
      They're kept until the owner deletes them. To ask for a message to be deleted, use the email address on the
      <a href="/contact">Contact</a> page.</p>
      <h2>What stays on your device</h2>
      <p>A light/dark theme choice, and a cached copy of the public pages (so they load instantly on a repeat visit), are
      saved in your browser's own local storage. Neither ever leaves your device or is sent anywhere.</p>
      <h2>Outside services this site talks to</h2>
      <p>Loading a page fetches content from Google's Firebase. Hovering a link to a Wikipedia article that doesn't
      already have a saved preview fetches a short summary directly from Wikipedia's own public API -- the page address
      you're hovering is sent to Wikipedia for that one request. Every other link preview is captured in advance by the
      owner and stored on this site, so nothing is sent anywhere just by hovering it. Fonts, scripts and libraries are all
      served from this site itself, not a third party.</p>
      <h2>Hosting</h2>
      <p>Like any website, the hosting provider (Cloudflare) and database provider (Google) keep their own standard
      server logs (such as IP address and request time) as part of normal operation. This site doesn't access or use
      those logs itself.</p>
      <h2>Changes</h2>
      <p>If how this site handles data changes meaningfully, this page will be updated.</p>
      </div>`
      };
    },

    async copyright(_, __, { S, year }) {
      return {
        title: "Copyright",
        description: "Rights reserved in the writing, projects and images on this site.",
        html: `<h1 class="page-title">Copyright</h1><p class="page-sub">Rights reserved in what's published here.</p>
      <div class="prose">
      <p>Writing, projects, and photos on this site are &copy; ${year} ${esc(S.siteTitle)}, unless credited otherwise where
      they appear. All rights reserved.</p>
      <h2>Quoting and sharing</h2>
      <p>Quoting a short passage with attribution and a link back is welcome. Republishing a piece in full, or a
      substantial part of one, needs permission first -- use the <a href="/contact">Contact</a> page to ask.</p>
      <h2>Text and data mining / AI training</h2>
      <p>No permission is given for this site's writing, projects or images to be used to train, fine-tune, or
      build a dataset for a machine-learning or AI system, or to be collected in bulk for that purpose. This is a
      deliberate, machine-readable reservation of rights: see the <code>tdm-reservation</code> header and meta tag this
      site sends, and the <a href="/robots.txt">robots.txt</a> entries for known AI and data-mining crawlers.</p>
      <h2>Questions</h2>
      <p>For permission requests, or to report a use of this content you think is out of bounds, use the
      <a href="/contact">Contact</a> page.</p>
      </div>`
      };
    }
  };

  // -> { kind, status, title, description, html, structured?, ogType?, image? }. Throws if the
  // data can't be loaded; the caller decides what to show instead.
  async function renderRoute(path, query, ctx) {
    const hit = matchRoute(path);
    if (!hit) return notFound();
    const out = await views[hit.kind](hit.params, query, ctx);
    return { kind: hit.kind, status: 200, ...out };
  }

  return { renderRoute };
}
