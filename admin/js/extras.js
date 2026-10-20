import { h, panel, modal, toast, confirmBox, iso, fmtDate } from "./ui.js";
import { store } from "./core.js";
import { mdEditor } from "./editor.js";

const field = (label, control, hint) =>
  h("label", { class: "field" }, h("span", { class: "lab" }, label), control, hint && h("span", { class: "hint" }, hint));

/* ---------- sources (citations) on a project ---------- */
export function sourcesPanel(doc, changed) {
  if (!Array.isArray(doc.sources)) doc.sources = [];
  const box = h("div", { class: "srcs" });
  const draw = () => {
    box.replaceChildren(...[
      h("p", { class: "muted tiny", style: "margin:0 0 .8rem" }, "Write each citation in whatever style you use (OSCOLA, Bluebook, APA). Italics work with *asterisks*. The link is optional."),
      ...doc.sources.map((s, i) => {
        const cite = h("textarea", { rows: 2, placeholder: "Full citation" });
        cite.value = s.citation || "";
        cite.addEventListener("input", () => { s.citation = cite.value; changed(); });
        const url = h("input", { type: "url", placeholder: "Link (optional)", value: s.url || "" });
        url.addEventListener("input", () => { s.url = url.value.trim(); changed(); });
        const move = d => { const j = i + d; if (j < 0 || j >= doc.sources.length) return; [doc.sources[i], doc.sources[j]] = [doc.sources[j], doc.sources[i]]; changed(); draw(); };
        return h("div", { class: "src-row" },
          h("span", { class: "n" }, String(i + 1)),
          h("div", { class: "f" }, cite, url),
          h("div", { class: "acts col" },
            h("button", { class: "linkish", type: "button", onclick: () => move(-1) }, "Up"),
            h("button", { class: "linkish", type: "button", onclick: () => move(1) }, "Down"),
            h("button", { class: "linkish", type: "button", onclick: () => { doc.sources.splice(i, 1); changed(); draw(); } }, "Remove")));
      }),
      !doc.sources.length && h("p", { class: "muted" }, "No sources yet."),
      h("div", { class: "actions left" }, h("button", { class: "btn ghost sm", type: "button", onclick: () => { doc.sources.push({ citation: "", url: "" }); changed(); draw(); } }, "Add a source"))
    ].flat().filter(Boolean));
  };
  draw();
  return panel("Sources", box);
}

/* ---------- dated updates under a project ---------- */
// getId() returns the project's id once it exists. ensureSaved() saves the project first if needed and returns its id.
export function updatesPanel({ getId, ensureSaved }) {
  let editing = null, editingPublished = false;
  const date = h("input", { type: "date", value: iso(new Date()) });
  const title = h("input", { placeholder: "Optional title, such as “Season data added”" });
  const body = mdEditor({ value: "", tall: false });
  const list = h("div", { class: "upd-list" });
  const actions = h("div", { class: "actions left" });

  async function submit(publish) {
    const text = body.get().trim();
    if (!text && !title.value.trim()) { toast("Write something first.", "bad"); return; }
    const pid = await ensureSaved();
    if (!pid) return;
    const now = new Date().toISOString();
    const rec = { type: "update", projectId: pid, title: title.value.trim(), body: text, date: date.value || iso(new Date()), published: publish, updatedAt: now };
    if (!editing) { rec.slug = "update-" + Date.now().toString(36); rec.excerpt = ""; rec.createdAt = now; }
    try {
      await store.save("posts", editing, rec);
      toast(publish ? "Update published" : "Draft saved", "ok");
      reset(); await load();
    } catch (e) { console.error(e); toast("Couldn't save the update. Check your connection and sign-in.", "bad"); }
  }

  function drawActions() {
    actions.replaceChildren(...[
      h("button", { class: "btn", type: "button", onclick: () => submit(true) }, editing && editingPublished ? "Save changes" : "Publish update"),
      h("button", { class: "btn ghost", type: "button", onclick: () => submit(false) }, editing && editingPublished ? "Unpublish" : "Save as draft"),
      editing && h("button", { class: "linkish", type: "button", onclick: reset }, "Cancel editing")
    ].filter(Boolean));
  }
  function reset() { editing = null; editingPublished = false; title.value = ""; body.set(""); date.value = iso(new Date()); drawActions(); }

  async function load() {
    const pid = getId();
    if (!pid) { list.replaceChildren(h("p", { class: "muted" }, "No updates yet.")); return; }
    const items = (await store.list("posts")).filter(p => p.type === "update" && p.projectId === pid)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
    list.replaceChildren(...(items.length ? items.map(u => h("div", { class: "upd-row" },
      h("span", { class: "d" }, fmtDate(u.date)),
      h("span", { class: "t" }, u.title || (u.body || "").replace(/\s+/g, " ").slice(0, 70) || "Untitled update"),
      h("span", { class: "tag " + (u.published ? "live" : "") }, u.published ? "Published" : "Draft"),
      h("span", { class: "acts" },
        h("button", { class: "linkish", type: "button", onclick: () => { editing = u.id; editingPublished = !!u.published; title.value = u.title || ""; date.value = u.date || iso(new Date()); body.set(u.body || ""); drawActions(); window.scrollTo({ top: panelEl.offsetTop - 80, behavior: "smooth" }); } }, "Edit"),
        h("button", { class: "linkish", type: "button", onclick: async () => { if (await confirmBox("Delete this update?", "Delete")) { try { await store.remove("posts", u.id); toast("Deleted", "ok"); if (editing === u.id) reset(); load(); } catch (e) { console.error(e); toast("Couldn't delete.", "bad"); } } } }, "Delete"))))
      : [h("p", { class: "muted" }, "No updates yet.")]));
  }

  drawActions();
  const panelEl = panel("Updates",
    h("p", { class: "muted tiny", style: "margin:0 0 .8rem" }, "Short dated notes that appear under this project on the site, newest first. They also join the home-page timeline."),
    h("div", { class: "two" }, field("Date", date), field("Title", title)),
    body.el, actions, h("h3", { class: "sub" }, "Posted so far"), list);
  load();
  return { el: panelEl, refresh: load };
}

/* ---------- awards ---------- */
function awardForm(entry, done) {
  const e = { kind: "award", date: iso(new Date()), award: "", event: "", committee: "", portfolio: "", description: "", link: "", onTimeline: true, ...entry };
  const text = (key, o = {}) => { const el = h(o.area ? "textarea" : "input", { type: o.type || "text", value: e[key] || "", rows: o.area ? 3 : null, placeholder: o.ph || "" }); el.addEventListener("input", () => e[key] = el.value); return el; };
  const tl = h("input", { type: "checkbox", checked: e.onTimeline !== false });
  tl.addEventListener("change", () => e.onTimeline = tl.checked);
  const body = h("div", {},
    field("Date", text("date", { type: "date" })),
    field("Award or result", text("award", { ph: "Best Delegate, Verbal Mention, Participant" })),
    field("Conference", text("event", { ph: "Name of the MUN, with year" })),
    h("div", { class: "two" }, field("Committee", text("committee", { ph: "UNSC, DISEC…" })), field("Country or portfolio", text("portfolio"))),
    field("Notes", text("description", { area: true }), "Optional. A sentence about the topic, the paper, or what stood out."),
    field("Link", text("link", { ph: "https://…" }), "Optional. A results page or certificate."),
    h("label", { class: "check" }, tl, "Show this on the home-page timeline"),
    h("div", { class: "actions" },
      h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Cancel"),
      h("button", { class: "btn", type: "button", onclick: async () => {
        if (!e.date || !e.award.trim()) { toast("A date and an award or result are needed.", "bad"); return; }
        const { id, ...data } = e;
        data.award = data.award.trim(); data.title = data.award; data.kind = "award";
        try { await store.save("timeline", id || null, data); toast("Saved", "ok"); close(); done(); } catch (err) { console.error(err); toast("Couldn't save.", "bad"); }
      } }, "Save")));
  const close = modal(entry?.id ? "Edit award" : "New award", body, { wide: true });
}

export async function awards(stage) {
  const items = (await store.list("timeline")).filter(t => t.kind === "award").sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const refresh = () => awards(stage);
  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Awards"), h("button", { class: "btn", type: "button", onclick: () => awardForm(null, refresh) }, "Add an award")),
    h("p", { class: "lead" }, "Conferences, results and recognition. Each one appears on the Awards page and, if you leave it ticked, on the home-page timeline."),
    h("div", { class: "rows" }, items.length ? items.map(a => h("div", { class: "row award" },
      h("span", { class: "r-title" }, a.award || a.title, h("em", { class: "muted" }, a.event ? `, ${a.event}` : "")),
      h("span", { class: "r-meta" }, [fmtDate(a.date), [a.committee, a.portfolio].filter(Boolean).join(", ")].filter(Boolean).join(", ")),
      h("span", { class: "acts" },
        h("button", { class: "linkish", type: "button", onclick: () => awardForm(a, refresh) }, "Edit"),
        h("button", { class: "linkish", type: "button", onclick: async () => { if (await confirmBox("Delete this award?", "Delete")) { try { await store.remove("timeline", a.id); toast("Deleted", "ok"); refresh(); } catch (e) { console.error(e); toast("Couldn't delete.", "bad"); } } } }, "Delete"))))
      : [h("p", { class: "muted" }, "No awards yet. Add the first one.")]));
}
