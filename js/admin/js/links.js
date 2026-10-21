import { h, modal, toast, confirmBox } from "./ui.js";
import { store } from "./core.js";
import { previewId } from "./prevkey.js";

const siteRoot = new URL("../", location.href).href;
const field = (label, control, hint) =>
  h("label", { class: "field" }, h("span", { class: "lab" }, label), control, hint && h("span", { class: "hint" }, hint));

/* ---------- find every outside link in the site's content ---------- */
function urlsIn(text) {
  const t = String(text || "").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/^\[\^[^\]]+\]:/gm, " ");
  const out = new Set();
  for (const m of t.matchAll(/https?:\/\/(?:[^\s()<>\]"']|\([^\s()<>]*\))+/g)) {
    const raw = m[0].replace(/[.,;:!?]+$/, "");
    try {
      const u = new URL(raw);
      if (u.href.startsWith(siteRoot)) continue;
      u.hash = "";
      out.add(u.href);
    } catch { /* not a link */ }
  }
  return [...out];
}

async function scan() {
  const [posts, projects, settingsDocs] = await Promise.all([store.list("posts"), store.list("projects"), store.list("settings")]);
  const found = new Map();
  const add = (url, where) => { if (!found.has(url)) found.set(url, new Set()); found.get(url).add(where); };
  posts.forEach(p => urlsIn(p.body).forEach(u => add(u, p.type === "update" ? "Project update" : `Writing: ${p.title || "Untitled"}`)));
  projects.forEach(p => {
    const w = `Project: ${p.title || "Untitled"}`;
    urlsIn(p.body).forEach(u => add(u, w));
    (p.sources || []).forEach(s => { urlsIn(s.url).forEach(u => add(u, w + " (sources)")); urlsIn(s.citation).forEach(u => add(u, w + " (sources)")); });
  });
  const site = settingsDocs.find(d => d.id === "site") || {};
  [site.intro, site.about].forEach(t => urlsIn(t).forEach(u => add(u, "Pages")));
  (site.links || []).forEach(l => urlsIn(l.url).forEach(u => add(u, "Pages (elsewhere)")));
  const saved = new Map(settingsDocs.filter(d => d.id.startsWith("prev-")).map(d => [d.id, d]));
  const rows = [];
  for (const [url, where] of found) rows.push({ url, where: [...where], id: await previewId(url) });
  rows.forEach(r => { r.rec = saved.get(r.id) || null; });
  rows.sort((a, b) => (a.rec ? 1 : 0) - (b.rec ? 1 : 0) || a.url.localeCompare(b.url));
  return rows;
}

/* ---------- capture a preview ---------- */
async function shrink(src) {
  const blob = await (await fetch(src)).blob();
  const bmp = await createImageBitmap(blob);
  const w = Math.min(640, bmp.width), sc = w / bmp.width;
  const h2 = Math.min(Math.round(bmp.height * sc), Math.round(w * 0.625));
  const c = document.createElement("canvas"); c.width = w; c.height = h2;
  c.getContext("2d").drawImage(bmp, 0, 0, w, Math.round(h2 / sc), 0, 0, w, h2);
  let q = 0.72, out = c.toDataURL("image/jpeg", q);
  while (out.length > 180000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
  return out;
}

async function capture(url) {
  const u = new URL(url);
  if (/(^|\.)wikipedia\.org$/.test(u.hostname) && u.pathname.startsWith("/wiki/")) {
    const r = await fetch(`https://${u.hostname}/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(u.pathname.slice(6)))}`);
    if (!r.ok) throw new Error(`Wikipedia answered ${r.status}`);
    const j = await r.json();
    return { kind: "wikipedia", title: j.title || "", site: "Wikipedia", author: "", date: "", description: j.extract || j.description || "", image: j.thumbnail?.source || "", shot: "", shotUrl: "" };
  }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
  let r;
  try { r = await fetch("https://api.microlink.io/?screenshot=true&url=" + encodeURIComponent(url), { signal: ctl.signal }); }
  finally { clearTimeout(timer); }
  if (r.status === 429) { const e = new Error("The preview service's free limit has been reached."); e.rate = true; throw e; }
  const j = await r.json().catch(() => ({}));
  if (j.status !== "success" || !j.data) throw new Error(j.message || "The service couldn't read this page.");
  const d = j.data, https = v => /^https:\/\//.test(v || "") ? v : "";
  const rec = {
    kind: "web", title: d.title || u.hostname, site: d.publisher || u.hostname.replace(/^www\./, ""),
    author: d.author || "", date: (d.date || "").slice(0, 10), description: d.description || "",
    image: https(d.image?.url) || https(d.logo?.url), shot: "", shotUrl: ""
  };
  const su = https(d.screenshot?.url);
  if (su) { try { rec.shot = await shrink(su); } catch { rec.shotUrl = su; } }
  return rec;
}

async function savePreview(row, rec, manual = false) {
  const now = new Date().toISOString();
  await store.save("settings", row.id, { ...rec, url: row.url, manual, createdAt: row.rec?.createdAt || now, updatedAt: now });
}

/* ---------- edit by hand ---------- */
function editForm(row, done) {
  const e = { kind: "web", title: "", site: "", author: "", date: "", description: "", image: "", shot: "", shotUrl: "", ...(row.rec || {}) };
  delete e.id;
  const text = (key, o = {}) => { const el = h(o.area ? "textarea" : "input", { type: o.type || "text", value: e[key] || "", rows: o.area ? 5 : null, placeholder: o.ph || "" }); el.addEventListener("input", () => e[key] = el.value); return el; };
  const keep = h("input", { type: "checkbox", checked: true });
  const body = h("div", {},
    h("p", { class: "muted tiny", style: "margin:0 0 1rem;word-break:break-all" }, row.url),
    field("Title", text("title")),
    h("div", { class: "two" }, field("Source", text("site", { ph: "United Nations, BBC, a journal…" })), field("Author", text("author"))),
    field("Date", text("date", { type: "date" })),
    field("Description", text("description", { area: true }), "A sentence or two on what the page is and why it is cited."),
    field("Picture link", text("image", { ph: "https://…" }), "Optional. Must start with https://."),
    e.shot || e.shotUrl ? h("label", { class: "check" }, keep, "Keep the saved picture of the page") : null,
    h("div", { class: "actions" },
      h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Cancel"),
      h("button", { class: "btn", type: "button", onclick: async () => {
        if (e.image && !/^https:\/\//.test(e.image)) { toast("The picture link must start with https://", "bad"); return; }
        if (!keep.checked) { e.shot = ""; e.shotUrl = ""; }
        try { await savePreview(row, e, true); toast("Saved", "ok"); close(); done(); } catch (err) { console.error(err); toast("Couldn't save.", "bad"); }
      } }, "Save preview")));
  const close = modal("Link preview", body, { wide: true });
}

/* ---------- the screen ---------- */
export async function links(stage) {
  let rows = await scan();
  const status = h("p", { class: "muted", role: "status" }, "");
  const list = h("div", { class: "rows" });
  const allBtn = h("button", { class: "btn", type: "button" }, "Capture all missing");
  let busy = false;

  const label = r => !r.rec ? ["Missing", ""] : r.rec.shot ? ["Ready, with picture", "ok"] : r.rec.shotUrl ? ["Ready, picture linked (may expire)", "ok"] : r.rec.image ? ["Ready, with image", "ok"] : ["Ready, text only", "ok"];

  async function captureOne(r) {
    const rec = await capture(r.url);
    await savePreview(r, rec, false);
    r.rec = { ...rec, url: r.url };
  }

  function draw() {
    const missing = rows.filter(r => !r.rec).length;
    allBtn.textContent = missing ? `Capture all missing (${missing})` : "Capture all missing";
    allBtn.disabled = busy || !missing;
    list.replaceChildren(...(rows.length ? rows.map(r => {
      const [txt, cls] = label(r);
      return h("div", { class: "lk-row" },
        h("div", {},
          h("div", { class: "lk-title" }, r.rec?.title || new URL(r.url).hostname.replace(/^www\./, "")),
          h("div", { class: "lk-url" }, r.url),
          h("div", { class: "muted tiny", style: "margin:.2rem 0 0" }, "Used in: " + r.where.slice(0, 3).join("; ") + (r.where.length > 3 ? ` and ${r.where.length - 3} more` : ""))),
        h("span", { class: "lk-status " + cls }, txt),
        h("span", { class: "acts" },
          h("button", { class: "linkish", type: "button", disabled: busy, onclick: async () => {
            busy = true; draw(); status.textContent = "Capturing…";
            try { await captureOne(r); toast("Preview saved", "ok"); status.textContent = ""; }
            catch (e) { console.error(e); status.textContent = ""; toast(e.rate ? e.message + " Try again tomorrow, or use Edit." : "Couldn't capture this one. Use Edit to fill it in by hand.", "bad"); }
            busy = false; draw();
          } }, r.rec ? "Refresh" : "Capture"),
          h("button", { class: "linkish", type: "button", onclick: () => editForm(r, async () => { rows = await scan(); draw(); }) }, "Edit"),
          r.rec && h("button", { class: "linkish", type: "button", onclick: async () => { if (await confirmBox("Delete this saved preview? The link will fall back to a plain card.", "Delete")) { await store.remove("settings", r.id); r.rec = null; draw(); } } }, "Delete")));
    }) : [h("p", { class: "muted" }, "No outside links found yet. Links in your writing, project pages, sources and Pages text appear here.")]));
  }

  allBtn.addEventListener("click", async () => {
    busy = true; draw();
    const todo = rows.filter(r => !r.rec); let done = 0, failed = 0;
    for (const r of todo) {
      status.textContent = `Capturing ${done + failed + 1} of ${todo.length}…`;
      try { await captureOne(r); done++; draw(); }
      catch (e) {
        console.error(e);
        if (e.rate) { status.textContent = ""; toast(`${e.message} Saved ${done}. Try again tomorrow, or use Edit for the rest.`, "bad"); busy = false; draw(); return; }
        failed++;
      }
    }
    status.textContent = "";
    toast(failed ? `Saved ${done}. ${failed} couldn't be read. Use Edit to fill those in by hand.` : `Saved ${done} ${done === 1 ? "preview" : "previews"}.`, failed ? "bad" : "ok");
    busy = false; draw();
  });

  draw();
  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Links"), h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", onclick: async () => { rows = await scan(); draw(); } }, "Rescan"), allBtn)),
    h("p", { class: "lead" }, "When someone hovers a link on your site, they see a preview. It's captured once, here, and saved in your own database. Visitors never depend on the other site, and nothing is fetched from anyone else while they read. Wikipedia links use Wikipedia's own free summaries."),
    status, list);
}
