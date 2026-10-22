import { h, panel, toast, confirmBox, iso, fmtDate, slugify } from "./ui.js";
import { store } from "./core.js";
import { mdEditor, imageField } from "./editor.js";
import { sourcesPanel, updatesPanel } from "./extras.js";
// The dashboard lives in /admin/ inside the site, so the public site is one level up.
const siteRoot = new URL("../", location.href).href;

export const field = (label, control, hint) =>
  h("label", { class: "field" }, h("span", { class: "lab" }, label), control, hint && h("span", { class: "hint" }, hint));

/* ---------- overview ---------- */
function heatmap(counts) {
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - (52 * 7 + end.getDay()));
  const grid = h("div", { class: "heat", role: "img", "aria-label": "Writing activity over the past year" });
  let weeksActive = new Set();
  for (let i = 0; i < 53 * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > end) { grid.append(h("i", { class: "future" })); continue; }
    const k = iso(d), n = counts[k] || 0;
    if (n) weeksActive.add(Math.floor(i / 7));
    grid.append(h("i", { class: "l" + Math.min(n, 4), title: `${fmtDate(k)}: ${n ? n + (n > 1 ? " posts" : " post") : "nothing"}` }));
  }
  return { grid, weeks: weeksActive.size };
}

export async function overview(stage) {
  const [allPosts, projects, messages, cfg] = await Promise.all([store.list("posts"), store.list("projects"), store.list("messages"), store.get("settings", "site")]);
  const posts = allPosts.filter(p => p.type !== "update");
  const counts = {};
  allPosts.forEach(p => new Set([p.date, (p.updatedAt || "").slice(0, 10)].filter(Boolean)).forEach(d => counts[d] = (counts[d] || 0) + 1));
  const { grid, weeks } = heatmap(counts);
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const first = (cfg?.siteTitle || "").split(" ")[0];
  const live = posts.filter(p => p.published).length, drafts = posts.filter(p => !p.published);
  const unread = messages.filter(m => !m.read).length;
  const sentence = [
    `${live} ${live === 1 ? "post" : "posts"} published`, `${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"}`,
    `${projects.length} ${projects.length === 1 ? "project" : "projects"}`, unread ? `${unread} unread ${unread === 1 ? "message" : "messages"}` : "no unread messages"
  ].join(", ") + ".";
  drafts.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  stage.replaceChildren(
    h("h1", { class: "hello" }, `${greet}${first ? ", " + first : ""}.`),
    h("p", { class: "lead" }, sentence),
    h("div", { class: "actions left big" },
      h("a", { class: "btn", href: "#/writing/new" }, "New post"),
      h("a", { class: "btn ghost", href: "#/projects/new" }, "New project"),
      h("a", { class: "btn ghost", href: "#/timeline" }, "Add a milestone")),
    panel("The past year", grid,
      h("p", { class: "muted tiny" }, weeks ? `You wrote in ${weeks} of the last 52 weeks. Each square is a day.` : "Each square is a day. Publish or edit a post to light one up.")),
    panel("Drafts in progress",
      drafts.length ? h("ul", { class: "plain" }, drafts.slice(0, 5).map(d => h("li", {}, h("a", { href: `#/writing/${d.id}` }, d.title || "Untitled"), h("span", { class: "muted" }, ` edited ${fmtDate((d.updatedAt || "").slice(0, 10))}`))))
        : h("p", { class: "muted" }, "No drafts. A blank page is a fine place to start.")));
  requestAnimationFrame(() => { grid.scrollLeft = grid.scrollWidth; });
}

/* ---------- writing / projects lists ---------- */
export async function writing(stage) {
  const [allPosts, projects] = await Promise.all([store.list("posts"), store.list("projects")]);
  const posts = allPosts;
  posts.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  let filter = "all", q = "";
  const list = h("div", { class: "rows" });
  const tabs = ["all", "published", "draft"].map(f => h("button", { type: "button", class: "mode", "aria-pressed": String(f === "all"), onclick: () => { filter = f; tabs.forEach(t => t.setAttribute("aria-pressed", String(t.dataset.f === f))); draw(); }, "data-f": f }, f === "all" ? "All" : f === "published" ? "Published" : "Drafts"));
  const search = h("input", { type: "search", placeholder: "Search titles", class: "search", oninput: e => { q = e.target.value.toLowerCase(); draw(); } });
  function draw() {
    const rows = posts.filter(p => (filter === "all" || (filter === "published") === !!p.published) && (p.title || "").toLowerCase().includes(q));
    list.replaceChildren(...(rows.length ? rows.map(p => {
      const proj = projects.find(x => x.id === p.projectId);
      const isUpd = p.type === "update";
      // An update's real editor is the Updates panel on its project page, not the generic post editor.
      const href = isUpd && proj ? `#/projects/${proj.id}` : `#/writing/${p.id}`;
      return h("a", { class: "row", href },
        h("span", { class: "r-title" }, p.title || (isUpd ? "Update" : "Untitled")),
        h("span", { class: "r-meta" }, [isUpd ? "Update" : null, proj?.title, fmtDate(p.date)].filter(Boolean).join(", ")),
        h("span", { class: "tag " + (p.published ? "live" : "") }, p.published ? "Published" : "Draft"));
    }) : [h("p", { class: "muted" }, posts.length ? "Nothing matches." : "No writing yet. Start your first post.")]));
  }
  draw();
  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Writing"), h("a", { class: "btn", href: "#/writing/new" }, "New post")),
    h("div", { class: "filterbar" }, h("div", { class: "modes" }, tabs), search), list);
}

export async function projects(stage) {
  const items = await store.list("projects");
  items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Projects"), h("a", { class: "btn", href: "#/projects/new" }, "New project")),
    h("div", { class: "rows" }, items.length ? items.map(p => h("a", { class: "row", href: `#/projects/${p.id}` },
      h("span", { class: "r-title" }, p.title || "Untitled"),
      h("span", { class: "r-meta" }, `${p.status || "Ongoing"}, from ${fmtDate(p.startDate)}${p.featured ? ", featured" : ""}`),
      h("span", { class: "tag " + (p.published ? "live" : "") }, p.published ? "Published" : "Draft")))
      : [h("p", { class: "muted" }, "No projects yet. Each project gets its own page and thread of writing.")]));
}

/* ---------- document editor (posts and projects) ---------- */
const CFG = {
  posts: { col: "posts", noun: "post", route: "writing", site: "writing", blank: () => ({ title: "", slug: "", body: "", excerpt: "", date: iso(new Date()), projectId: "", tags: [], cover: "", sources: [], disclaimer: "", published: false }) },
  projects: { col: "projects", noun: "project", route: "projects", site: "projects", blank: () => ({ title: "", slug: "", body: "", summary: "", status: "Ongoing", startDate: iso(new Date()), endDate: "", cover: "", tags: [], featured: false, order: 10, sources: [], disclaimer: "", published: false }) }
};

export const editor = kind => async (stage, id) => {
  const cfg = CFG[kind];
  const isNew = id === "new";
  const [existing, all, projectList] = await Promise.all([isNew ? null : store.get(cfg.col, id), store.list(cfg.col), kind === "posts" ? store.list("projects") : []]);
  if (!isNew && !existing) { stage.replaceChildren(h("p", { class: "muted" }, `That ${cfg.noun} no longer exists.`), h("a", { href: `#/${cfg.route}` }, `Back to ${cfg.route}`)); return; }

  const doc = { ...cfg.blank(), ...(existing || {}) }; delete doc.id;
  let docId = isNew ? null : id, dirty = false, saving = false, again = false, ver = 0, timer;
  let slugTouched = !!doc.slug;

  const state = h("p", { class: "state" }, isNew ? "Not saved yet" : "Saved");
  const setState = t => { state.textContent = t; };
  window.__deskDirty = () => dirty && doc.published;
  window.onbeforeunload = e => { if (dirty && doc.published) { e.preventDefault(); e.returnValue = ""; return ""; } };

  const uniqueSlug = base => { let s = base || "untitled", n = 2; while (all.some(x => x.slug === s && x.id !== docId)) s = `${base}-${n++}`; return s; };

  async function save({ quiet = false, publish = null } = {}) {
    clearTimeout(timer);
    if (saving) { again = true; return false; }
    if (!doc.title.trim() && !doc.body.trim()) { if (!quiet) toast("Add a title or some text first.", "bad"); return false; }
    if (publish === true && !doc.title.trim()) { toast("Add a title before publishing.", "bad"); return false; }
    saving = true; setState("Saving…");
    const my = ver;
    try {
      if (publish !== null) doc.published = publish;
      if (!slugTouched && !doc.published) doc.slug = slugify(doc.title);
      doc.slug = uniqueSlug(slugify(doc.slug) || slugify(doc.title));
      slugEl.value = doc.slug;
      const now = new Date().toISOString();
      const data = { ...doc, title: doc.title.trim(), updatedAt: now, createdAt: doc.createdAt || now };
      docId = await store.save(cfg.col, docId, data);
      doc.createdAt = data.createdAt;
      const i = all.findIndex(x => x.id === docId); const rec = { ...data, id: docId };
      if (i >= 0) all[i] = rec; else all.push(rec);
      if (isNewUrl()) history.replaceState(null, "", `#/${cfg.route}/${docId}`);
      if (my === ver) dirty = false;
      setState(`Saved at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      if (!quiet) toast(publish === true ? "Published" : publish === false ? "Moved back to drafts" : "Saved", "ok");
      draw();
      return true;
    } catch (err) {
      console.error(err); setState("Not saved"); toast("Couldn't save. Check your connection and sign-in, then try again.", "bad"); return false;
    } finally {
      saving = false; if (again) { again = false; save({ quiet: true }); }
    }
  }
  const isNewUrl = () => location.hash.endsWith("/new");
  const changed = () => { dirty = true; ver++; setState("Unsaved changes"); if (!doc.published) { clearTimeout(timer); timer = setTimeout(() => save({ quiet: true }), 2500); } };

  /* controls */
  const bindInput = (key, opts = {}) => {
    const el = h(opts.area ? "textarea" : "input", { type: opts.type || "text", placeholder: opts.ph || "", value: doc[key] ?? "", rows: opts.area ? 3 : null });
    el.addEventListener("input", () => { doc[key] = opts.type === "number" ? Number(el.value) : el.value; changed(); });
    return el;
  };
  const titleEl = h("input", { class: "title-in", placeholder: `Untitled ${cfg.noun}`, value: doc.title, "aria-label": "Title" });
  const slugEl = h("input", { value: doc.slug, placeholder: "auto-from-title" });
  titleEl.addEventListener("input", () => { doc.title = titleEl.value; if (!slugTouched && !doc.published) { doc.slug = slugify(doc.title); slugEl.value = doc.slug; } changed(); });
  slugEl.addEventListener("input", () => { slugTouched = true; doc.slug = slugEl.value; changed(); });

  const md = mdEditor({ value: doc.body, onInput: v => { doc.body = v; changed(); } });
  const ensureSaved = async () => docId || ((await save()) ? docId : null);
  const extras = kind === "projects" ? [sourcesPanel(doc, changed), updatesPanel({ getId: () => docId, ensureSaved }).el] : [sourcesPanel(doc, changed)];
  const tagsEl = h("input", { value: (doc.tags || []).join(", "), placeholder: "law, water, policy" });
  tagsEl.addEventListener("input", () => { doc.tags = tagsEl.value.split(",").map(t => t.trim()).filter(Boolean); changed(); });

  const select = (key, opts) => { const el = h("select", {}, opts.map(([v, l]) => h("option", { value: v }, l))); el.value = doc[key] ?? ""; el.addEventListener("change", () => { doc[key] = el.value; changed(); }); return el; };
  const check = (key, label) => { const el = h("input", { type: "checkbox", checked: !!doc[key] }); el.addEventListener("change", () => { doc[key] = el.checked; changed(); }); return h("label", { class: "check" }, el, label); };

  const publishing = h("div", { class: "pub" });
  function draw() {
    const live = doc.published;
    publishing.replaceChildren(
      h("p", { class: "status-line" }, live ? "This is live on the site." : "This is a draft. Only you can see it."),
      state,
      h("div", { class: "actions left" },
        live ? h("button", { class: "btn", type: "button", onclick: () => save() }, "Save changes") : h("button", { class: "btn ghost", type: "button", onclick: () => save() }, "Save draft"),
        live ? h("button", { class: "btn ghost", type: "button", onclick: () => save({ publish: false }) }, "Unpublish") : h("button", { class: "btn", type: "button", onclick: () => save({ publish: true }) }, "Publish")),
      live && docId && h("a", { class: "linkish", href: `${siteRoot}#/${cfg.site}/${doc.slug}`, target: "_blank", rel: "noopener" }, "View on the site"));
  }
  draw();

  const dateOrStart = kind === "posts"
    ? field("Date", bindInput("date", { type: "date" }))
    : h("div", { class: "two" }, field("Started", bindInput("startDate", { type: "date" })), field("Ended", bindInput("endDate", { type: "date" })));

  const side = [
    panel("Publishing", publishing),
    panel("Details",
      field("Web address", slugEl, "Appears after /" + cfg.site + "/"),
      dateOrStart,
      ...(kind === "posts"
        ? [field("Part of project", select("projectId", [["", "None (standalone)"], ...projectList.map(p => [p.id, p.title || "Untitled"])])),
           field("Summary for lists", bindInput("excerpt", { area: true, ph: "Optional. Leave empty to use the opening text." }))]
        : [field("Status", select("status", [["Ongoing", "Ongoing"], ["Complete", "Complete"], ["Paused", "Paused"]])),
           field("Summary", bindInput("summary", { area: true, ph: "One or two sentences shown on cards and previews." })),
           field("Order on the Projects page", bindInput("order", { type: "number" }), "Lower numbers come first."),
           check("featured", "Feature this project on the home page")]),
      field("Tags", tagsEl),
      field("Disclaimer", bindInput("disclaimer", { area: true, ph: "Optional, e.g. an AI-use note or other disclosure." }), "Shown in a small note on the public page, above the sources.")),
    panel("Cover image", imageField({ value: doc.cover, onChange: v => { doc.cover = v; changed(); } })),
    !isNew && panel("Remove", h("button", { class: "btn danger", type: "button", onclick: async () => {
      if (!(await confirmBox(`Delete this ${cfg.noun}? This can't be undone.`, "Delete"))) return;
      clearTimeout(timer); dirty = false;
      try { await store.remove(cfg.col, docId); toast("Deleted", "ok"); location.hash = `#/${cfg.route}`; } catch (e) { console.error(e); toast("Couldn't delete.", "bad"); }
    } }, `Delete this ${cfg.noun}`))
  ];

  stage.replaceChildren(
    h("a", { class: "back-link", href: `#/${cfg.route}` }, kind === "posts" ? "All writing" : "All projects"),
    h("div", { class: "ed" }, h("div", { class: "main" }, titleEl, md.el, extras), h("aside", { class: "side" }, side)));

  const onKey = e => {
    if (!stage.isConnected || !document.body.contains(titleEl)) { document.removeEventListener("keydown", onKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  };
  document.addEventListener("keydown", onKey);
  if (isNew) titleEl.focus();
};
