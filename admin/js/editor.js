import { h, toast, modal } from "./ui.js";
import { render, readingTime } from "./md.js";
import { store, uploadImage } from "./core.js";

const IMG = /^image\/(jpeg|png|webp|gif)$/;

/* ---------- ask for an image link ---------- */
export function askLink() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; close(); resolve(v); };
    const input = h("input", { type: "url", placeholder: "https://example.org/picture.jpg", autocomplete: "off" });
    const note = h("p", { class: "note bad", role: "alert" });
    const body = h("form", { onsubmit: e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!/^https:\/\/\S+$/i.test(v)) { note.textContent = "The link must start with https:// and have no spaces."; return; }
      finish(v);
    } },
      h("label", { class: "field" }, h("span", { class: "lab" }, "Link to the image"), input,
        h("span", { class: "hint" }, "Right-click an image on the web and copy its address, or use a link to a file in your GitHub repository.")),
      note,
      h("div", { class: "actions" },
        h("button", { class: "btn ghost", type: "button", onclick: () => finish(null) }, "Cancel"),
        h("button", { class: "btn", type: "submit" }, "Use this image")));
    const close = modal("Image from a link", body, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    input.focus();
  });
}

/* ---------- image library picker ---------- */
export function pickMedia() {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; close(); resolve(v); };
    const grid = h("div", { class: "mgrid" }, h("p", { class: "muted" }, "Loading…"));
    const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", hidden: true });
    file.addEventListener("change", async () => {
      const f = file.files[0]; if (!f) return;
      try { toast("Uploading…"); finish((await uploadImage(f)).url); }
      catch (e) { console.error(e); toast(e.message || "Upload failed.", "bad"); }
    });
    const body = h("div", {},
      h("div", { class: "actions left" }, h("button", { class: "btn ghost", type: "button", onclick: () => file.click() }, "Upload a new image"), file),
      grid);
    const close = modal("Image library", body, { wide: true, onClose: () => { if (!done) { done = true; resolve(null); } } });
    store.list("media").then(items => {
      items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      grid.replaceChildren(...(items.length
        ? items.map(m => h("button", { class: "mthumb", type: "button", title: m.name, onclick: () => finish(m.url) }, h("img", { src: m.url, alt: m.name, loading: "lazy" })))
        : [h("p", { class: "muted" }, "No images yet. Upload one to start the library.")]));
    }).catch(() => grid.replaceChildren(h("p", { class: "muted" }, "The library could not be loaded.")));
  });
}

/* ---------- single image field (covers, portrait) ---------- */
export function imageField({ value = "", onChange }) {
  const root = h("div", { class: "imgf" });
  const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", hidden: true });
  const set = v => { value = v; onChange(v); draw(); };
  file.addEventListener("change", async () => {
    const f = file.files[0]; if (!f) return;
    try { toast("Uploading…"); set((await uploadImage(f)).url); toast("Image added", "ok"); }
    catch (e) { console.error(e); toast(e.message || "Upload failed.", "bad"); }
    file.value = "";
  });
  function draw() {
    root.replaceChildren(
      value ? h("img", { src: value, alt: "" }) : h("p", { class: "muted" }, "No image yet."),
      h("div", { class: "actions left" },
        h("button", { class: "btn ghost sm", type: "button", onclick: async () => { const u = await askLink(); if (u) set(u); } }, "Use a link"),
        h("button", { class: "btn ghost sm", type: "button", onclick: () => file.click() }, "Upload"),
        h("button", { class: "btn ghost sm", type: "button", onclick: async () => { const u = await pickMedia(); if (u) set(u); } }, "Library"),
        value && h("button", { class: "btn ghost sm", type: "button", onclick: () => set("") }, "Remove")),
      file);
  }
  draw();
  return root;
}

/* ---------- markdown editor ---------- */
export function mdEditor({ value = "", onInput = () => {}, tall = true } = {}) {
  const ta = h("textarea", { class: "src", spellcheck: "true", placeholder: "Start writing. Markdown works here: ## heading, **bold**, > quote, [text](link), [^1] footnote." });
  ta.value = value;
  const out = h("div", { class: "out prose" });
  const stat = h("span", { class: "stat" });
  let timer;

  const paint = () => {
    out.innerHTML = render(ta.value);
    out.querySelectorAll("a").forEach(a => {
      if (a.dataset.fn) { a.addEventListener("click", e => { e.preventDefault(); out.querySelector("#" + a.dataset.fn)?.scrollIntoView({ block: "nearest" }); }); return; }
      a.target = "_blank"; a.rel = "noopener";
    });
    const w = (ta.value.match(/\S+/g) || []).length;
    stat.textContent = `${w} word${w === 1 ? "" : "s"}, ${readingTime(ta.value)} min read`;
  };
  const changed = () => { clearTimeout(timer); timer = setTimeout(paint, 140); onInput(ta.value); };
  ta.addEventListener("input", changed);

  const sel = () => [ta.selectionStart, ta.selectionEnd];
  function wrap(a, b = a, ph = "text") {
    const [s, e] = sel(), t = ta.value.slice(s, e) || ph;
    ta.setRangeText(a + t + b, s, e, "end");
    ta.setSelectionRange(s + a.length, s + a.length + t.length); ta.focus(); changed();
  }
  function prefix(p) {
    const [s, e] = sel();
    const start = ta.value.lastIndexOf("\n", s - 1) + 1;
    let end = ta.value.indexOf("\n", e); if (end < 0) end = ta.value.length;
    ta.setRangeText(ta.value.slice(start, end).split("\n").map(l => p + l).join("\n"), start, end, "end");
    ta.focus(); changed();
  }
  function link() {
    const [s, e] = sel(), t = ta.value.slice(s, e) || "link text";
    ta.setRangeText(`[${t}](https://)`, s, e, "end");
    const p = s + t.length + 3; ta.setSelectionRange(p, p + 8); ta.focus(); changed();
  }
  function footnote() {
    const n = (ta.value.match(/^\[\^[^\]]+\]:/gm) || []).length + 1;
    const [s, e] = sel();
    ta.setRangeText(`[^${n}]`, s, e, "end");
    ta.value = ta.value.replace(/\s*$/, "") + `\n\n[^${n}]: `;
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollTop = ta.scrollHeight; changed();
  }
  function insertImage(url) {
    const alt = "describe the image", [s, e] = sel();
    ta.setRangeText(`\n\n![${alt}](${url})\n\n`, s, e, "end");
    ta.setSelectionRange(s + 4, s + 4 + alt.length); ta.focus(); changed();
  }
  async function addFiles(files) {
    for (const f of [...files].filter(f => IMG.test(f.type))) {
      try { toast("Uploading " + f.name + "…"); insertImage((await uploadImage(f)).url); toast("Image added", "ok"); }
      catch (e) { console.error(e); toast(e.message || "Upload failed. Check that Storage is enabled.", "bad"); }
    }
  }

  const picker = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", multiple: true, hidden: true });
  picker.addEventListener("change", () => { addFiles(picker.files); picker.value = ""; });

  ta.addEventListener("dragover", e => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); ta.classList.add("drop"); } });
  ta.addEventListener("dragleave", () => ta.classList.remove("drop"));
  ta.addEventListener("drop", e => { ta.classList.remove("drop"); if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
  ta.addEventListener("paste", e => { if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files); } });
  ta.addEventListener("keydown", e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); wrap("**"); }
    else if (k === "i") { e.preventDefault(); wrap("*"); }
    else if (k === "k") { e.preventDefault(); link(); }
  });

  const tools = [
    ["Bold", "Bold (Ctrl+B)", () => wrap("**"), "b"], ["Italic", "Italic (Ctrl+I)", () => wrap("*"), "i"],
    ["Heading", "Heading", () => prefix("## ")], ["Quote", "Quote", () => prefix("> ")], ["List", "Bulleted list", () => prefix("- ")],
    ["Link", "Link (Ctrl+K)", link], ["Footnote", "Add a footnote", footnote],
    ["Image link", "Insert an image from a web address", async () => { const u = await askLink(); if (u) insertImage(u); }],
    ["Upload", "Upload and insert an image (or drop one in)", () => picker.click()],
    ["Library", "Insert from the image library", async () => { const u = await pickMedia(); if (u) insertImage(u); }]
  ];
  const mode = btn => { root.className = "mde " + btn; modes.forEach(m => m.setAttribute("aria-pressed", String(m.dataset.m === btn))); };
  const modes = ["write", "split", "read"].map(m => h("button", { type: "button", "data-m": m, class: "mode", onclick: () => mode(m) }, m[0].toUpperCase() + m.slice(1)));

  const bar = h("div", { class: "mde-bar" },
    h("div", { class: "tools" }, tools.map(([label, title, fn, f]) => h("button", { type: "button", class: "tool " + (f === "b" ? "b" : f === "i" ? "i" : ""), title, onclick: fn }, label))),
    h("div", { class: "modes" }, modes), picker);
  const root = h("div", { class: "mde" + (tall ? " tall" : "") }, bar, h("div", { class: "panes" }, ta, out), h("div", { class: "mde-foot" }, stat));
  mode(matchMedia("(min-width:1100px)").matches && tall ? "split" : "write");
  paint();
  return { el: root, get: () => ta.value, set: v => { ta.value = v; paint(); }, focus: () => ta.focus() };
}
