import { h, panel, modal, toast, confirmBox, fmtDate } from "./ui.js";
import { store, uploadImage, deleteMedia } from "./core.js";
import { mdEditor, imageField } from "./editor.js";
import { field } from "./views.js";

/* ---------- timeline ---------- */
function entryForm(entry, done) {
  const e = { date: "", title: "", description: "", link: "", ...entry };
  const bind = (key, o = {}) => { const el = h(o.area ? "textarea" : "input", { type: o.type || "text", value: e[key] || "", rows: o.area ? 3 : null, placeholder: o.ph || "" }); el.addEventListener("input", () => e[key] = el.value); return el; };
  const body = h("div", {},
    field("Date", bind("date", { type: "date" })),
    field("What happened", bind("title", { ph: "Presented the draft to a panel" })),
    field("A line of detail", bind("description", { area: true }), "Optional."),
    field("Link", bind("link", { ph: "/writing/my-post or https://…" }), "Optional. Opens as a preview on the site."),
    h("div", { class: "actions" },
      h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Cancel"),
      h("button", { class: "btn", type: "button", onclick: async () => {
        if (!e.date || !e.title.trim()) { toast("A date and a title are needed.", "bad"); return; }
        const { id, ...data } = e; data.title = data.title.trim();
        try { await store.save("timeline", id || null, data); toast("Saved", "ok"); close(); done(); } catch (err) { console.error(err); toast("Couldn't save.", "bad"); }
      } }, "Save milestone")));
  const close = modal(entry?.id ? "Edit milestone" : "New milestone", body);
}

export async function timeline(stage) {
  const [custom, posts, projects] = await Promise.all([store.list("timeline"), store.list("posts"), store.list("projects")]);
  const items = [
    ...custom.filter(c => c.kind !== "award").map(c => ({ ...c, own: true })),
    ...custom.filter(c => c.kind === "award").map(a => ({ date: a.date, title: a.award || a.title, kind: "award" })),
    ...posts.filter(p => p.published).map(p => ({ date: p.date, title: p.title || (p.type === "update" ? "Project update" : "Untitled"), kind: p.type === "update" ? "update" : "writing" })),
    ...projects.filter(p => p.published).map(p => ({ date: p.startDate, title: p.title, kind: "project begins" }))
  ].filter(i => i.date).sort((a, b) => b.date.localeCompare(a.date));
  const years = {}; items.forEach(i => (years[i.date.slice(0, 4)] ||= []).push(i));
  const refresh = () => timeline(stage);

  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Timeline"), h("button", { class: "btn", type: "button", onclick: () => entryForm(null, refresh) }, "Add a milestone")),
    h("p", { class: "lead" }, "This is how the record on your home page reads. Published writing and project start dates appear automatically. Milestones are the things you add yourself."),
    ...(items.length ? Object.keys(years).sort().reverse().map(y => h("section", { class: "yr" }, h("h2", {}, y),
      h("ul", { class: "plain wide" }, years[y].map(i => h("li", { class: i.own ? "own" : "auto" },
        h("span", { class: "d" }, fmtDate(i.date)), h("span", { class: "t" }, i.title, h("em", { class: "muted" }, " " + (i.own ? "milestone" : i.kind))),
        i.own && h("span", { class: "acts" },
          h("button", { class: "linkish", type: "button", onclick: () => entryForm(i, refresh) }, "Edit"),
          h("button", { class: "linkish", type: "button", onclick: async () => { if (await confirmBox("Delete this milestone?", "Delete")) { await store.remove("timeline", i.id); toast("Deleted", "ok"); refresh(); } } }, "Delete")))))))
      : [h("p", { class: "muted" }, "Nothing on the timeline yet.")]));
}

/* ---------- pages / site settings ---------- */
export async function pages(stage) {
  const [cur, projects] = await Promise.all([store.get("settings", "site"), store.list("projects")]);
  const s = {
    siteTitle: "Aryamann Reet", tagline: "", intro: "", about: "", portrait: "", school: "Legacy School, Bangalore", showSchool: false,
    email: "", links: [], footerNote: "Independent student work. Nothing here is legal advice.", featuredProject: "", ...(cur || {})
  };
  delete s.id;
  let dirty = false;
  const state = h("span", { class: "state" }, "All changes saved");
  const touch = () => { dirty = true; state.textContent = "Unsaved changes"; };
  window.__deskDirty = () => dirty;
  window.onbeforeunload = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; return ""; } };

  const text = (key, o = {}) => { const el = h(o.area ? "textarea" : "input", { type: o.type || "text", value: s[key] ?? "", rows: o.area ? 3 : null, placeholder: o.ph || "" }); el.addEventListener("input", () => { s[key] = el.value; touch(); }); return el; };
  const check = (key, label) => { const el = h("input", { type: "checkbox", checked: !!s[key] }); el.addEventListener("change", () => { s[key] = el.checked; touch(); }); return h("label", { class: "check" }, el, label); };

  const linkRows = h("div", { class: "linkrows" });
  const drawLinks = () => linkRows.replaceChildren(...s.links.map((l, i) => {
    const a = h("input", { value: l.label, placeholder: "Label" }), b = h("input", { value: l.url, placeholder: "https://…" });
    a.addEventListener("input", () => { l.label = a.value; touch(); }); b.addEventListener("input", () => { l.url = b.value; touch(); });
    return h("div", { class: "two" }, a, b, h("button", { class: "linkish", type: "button", onclick: () => { s.links.splice(i, 1); drawLinks(); touch(); } }, "Remove"));
  }), h("button", { class: "btn ghost sm", type: "button", onclick: () => { s.links.push({ label: "", url: "" }); drawLinks(); touch(); } }, "Add a link"));
  drawLinks();

  const intro = mdEditor({ value: s.intro, tall: false, onInput: v => { s.intro = v; touch(); } });
  const about = mdEditor({ value: s.about, tall: false, onInput: v => { s.about = v; touch(); } });
  const featured = h("select", {}, [h("option", { value: "" }, "Choose automatically"), ...projects.map(p => h("option", { value: p.id }, p.title || "Untitled"))]);
  featured.value = s.featuredProject || ""; featured.addEventListener("change", () => { s.featuredProject = featured.value; touch(); });

  const save = async () => {
    try { await store.save("settings", "site", s); dirty = false; state.textContent = "All changes saved"; toast("Saved", "ok"); }
    catch (e) { console.error(e); toast("Couldn't save. Check your connection and sign-in.", "bad"); }
  };

  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Pages")),
    h("p", { class: "lead" }, "The words and details that appear across the site."),
    h("div", { class: "cols" },
      panel("Name and contact",
        field("Site name", text("siteTitle")), field("Tagline", text("tagline", { ph: "A line under your name on the home page" })),
        check("showSchool", "Show school on the home and About pages"), field("School", text("school")),
        field("Public email", text("email", { type: "email" }), "Shown on the Contact page. Leave empty to use only the form."),
        field("Featured project", featured, "The project shown under “Currently working on”.")),
      panel("Portrait", imageField({ value: s.portrait, onChange: v => { s.portrait = v; touch(); } }),
        h("p", { class: "muted tiny" }, "Optional. Shown beside the About text."))),
    panel("Home introduction", intro.el),
    panel("About page", about.el),
    h("div", { class: "cols" },
      panel("Elsewhere", h("p", { class: "muted tiny" }, "Links shown on the About page."), linkRows),
      panel("Footer", field("Footer note", text("footerNote", { area: true }), "Shown at the bottom of every page."))),
    h("div", { class: "savebar" }, state, h("button", { class: "btn", type: "button", onclick: save }, "Save changes")));

  const onKey = e => { if (!document.body.contains(state)) { document.removeEventListener("keydown", onKey); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
  document.addEventListener("keydown", onKey);
}

/* ---------- media ---------- */
export async function media(stage) {
  const grid = h("div", { class: "mgrid big" });
  const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", multiple: true, hidden: true });
  const drop = h("div", { class: "drop-zone" }, "Drop images here, or ", h("button", { class: "linkish", type: "button", onclick: () => file.click() }, "choose files"), ".");
  let items = [];

  async function upload(files) {
    for (const f of [...files]) {
      try { toast("Uploading " + f.name + "…"); await uploadImage(f); toast("Uploaded", "ok"); }
      catch (e) { console.error(e); toast(e.message || "Upload failed. Check that Storage is enabled.", "bad"); }
    }
    load();
  }
  file.addEventListener("change", () => { upload(file.files); file.value = ""; });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); upload(e.dataTransfer.files); });

  const copy = async (t, msg) => { try { await navigator.clipboard.writeText(t); toast(msg, "ok"); } catch { toast("Couldn't copy. Select and copy it manually.", "bad"); } };
  function draw() {
    grid.replaceChildren(...(items.length ? items.map(m => h("figure", { class: "mcard" },
      h("img", { src: m.url, alt: m.name, loading: "lazy" }),
      h("figcaption", {}, h("span", { class: "n" }, m.name),
        h("span", { class: "acts" },
          h("button", { class: "linkish", type: "button", onclick: () => copy(`![describe the image](${m.url})`, "Markdown copied") }, "Copy markdown"),
          h("button", { class: "linkish", type: "button", onclick: () => copy(m.url, "Address copied") }, "Copy address"),
          h("button", { class: "linkish", type: "button", onclick: async () => { if (await confirmBox("Delete this image? Pages that use it will show a broken image.", "Delete")) { try { await deleteMedia(m); toast("Deleted", "ok"); load(); } catch (e) { console.error(e); toast("Couldn't delete.", "bad"); } } } }, "Delete"))))) : [h("p", { class: "muted" }, "No images yet.")]));
  }
  async function load() { items = (await store.list("media")).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")); draw(); }
  stage.replaceChildren(h("div", { class: "head" }, h("h1", {}, "Media")), h("p", { class: "lead" }, "Every image you upload lives here. Images are resized before upload to keep pages quick."), drop, file, grid);
  await load();
}

/* ---------- messages ---------- */
export async function messages(stage) {
  let items = (await store.list("messages")).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const list = h("div", { class: "rows" });
  const when = m => { const d = m.createdAt?.toDate?.(); return d ? d.toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""; };
  function draw() {
    list.replaceChildren(...(items.length ? items.map(m => {
      const det = h("details", { class: "msg" + (m.read ? "" : " unread") },
        h("summary", {}, h("span", { class: "r-title" }, m.name || "Someone"), h("span", { class: "r-meta" }, when(m)), !m.read && h("span", { class: "tag live" }, "New")),
        h("div", { class: "msg-body" },
          h("p", { class: "muted" }, m.email),
          h("p", { class: "pre" }, m.message),
          h("div", { class: "actions left" },
            h("a", { class: "btn ghost sm", href: `mailto:${m.email}?subject=Re: your message` }, "Reply by email"),
            h("button", { class: "btn ghost sm", type: "button", onclick: async () => { if (await confirmBox("Delete this message?", "Delete")) { await store.remove("messages", m.id); items = items.filter(x => x.id !== m.id); draw(); window.dispatchEvent(new Event("desk:messages")); } } }, "Delete"))));
      det.addEventListener("toggle", async () => { if (det.open && !m.read) { m.read = true; det.classList.remove("unread"); det.querySelector(".tag")?.remove(); try { await store.save("messages", m.id, { read: true }); window.dispatchEvent(new Event("desk:messages")); } catch (e) { console.error(e); } } });
      return det;
    }) : [h("p", { class: "muted" }, "No messages yet. Messages from the Contact page arrive here.")]));
  }
  draw();
  stage.replaceChildren(h("div", { class: "head" }, h("h1", {}, "Messages")), list);
}
