import { h, panel, modal, toast, confirmBox, iso, fmtDate } from "./ui.js";
import { store } from "./core.js";
import { mdEditor } from "./editor.js";

const field = (label, control, hint) =>
  h("label", { class: "field" }, h("span", { class: "lab" }, label), control, hint && h("span", { class: "hint" }, hint));

const STATUSES = ["Want to read", "Reading", "Read"];
const stars = n => "★".repeat(n) + "☆".repeat(5 - n);

function bookForm(entry, done) {
  const e = { title: "", author: "", status: "Reading", rating: 0, date: "", review: "", disclaimer: "", published: true, ...entry };
  const text = (key, o = {}) => { const el = h("input", { type: o.type || "text", value: e[key] || "", placeholder: o.ph || "" }); el.addEventListener("input", () => e[key] = el.value); return el; };
  const statusSel = h("select", {}, STATUSES.map(v => h("option", { value: v }, v)));
  statusSel.value = e.status; statusSel.addEventListener("change", () => e.status = statusSel.value);
  const ratingSel = h("select", {}, [0, 1, 2, 3, 4, 5].map(n => h("option", { value: n }, n ? stars(n) : "No rating yet")));
  ratingSel.value = String(e.rating || 0); ratingSel.addEventListener("change", () => e.rating = Number(ratingSel.value));
  const review = mdEditor({ value: e.review, tall: false });
  const body = h("div", {},
    field("Title", text("title", { ph: "Book title" })),
    field("Author", text("author")),
    h("div", { class: "two" }, field("Status", statusSel), field("Rating", ratingSel)),
    field("Date finished", text("date", { type: "date" }), "Leave empty if you haven't finished it yet. Used to group the list by year."),
    field("Review", review.el, "Optional. Markdown works here, same as writing."),
    field("Disclaimer", text("disclaimer", { ph: "Optional, e.g. an AI-use note or other disclosure." })),
    h("div", { class: "actions" },
      h("button", { class: "btn ghost", type: "button", onclick: () => close() }, "Cancel"),
      h("button", { class: "btn", type: "button", onclick: async () => {
        if (!e.title.trim()) { toast("A title is needed.", "bad"); return; }
        const { id, ...data } = e;
        data.title = data.title.trim(); data.author = data.author.trim(); data.review = review.get();
        try { await store.save("books", id || null, data); toast("Saved", "ok"); close(); done(); } catch (err) { console.error(err); toast("Couldn't save.", "bad"); }
      } }, "Save")));
  const close = modal(entry?.id ? "Edit book" : "New book", body, { wide: true });
}

export async function books(stage) {
  const items = (await store.list("books")).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const refresh = () => books(stage);
  stage.replaceChildren(
    h("div", { class: "head" }, h("h1", {}, "Books"), h("button", { class: "btn", type: "button", onclick: () => bookForm(null, refresh) }, "Add a book")),
    h("p", { class: "lead" }, "Title, author, status, rating and an optional review. Shown on the Books page, grouped by the year you finished each one."),
    h("div", { class: "rows" }, items.length ? items.map(b => h("div", { class: "row" },
      h("span", { class: "r-title" }, b.title, h("em", { class: "muted" }, b.author ? `, ${b.author}` : "")),
      h("span", { class: "r-meta" }, [b.status, b.rating ? stars(b.rating) : "", fmtDate(b.date)].filter(Boolean).join(", ")),
      h("span", { class: "acts" },
        h("button", { class: "linkish", type: "button", onclick: () => bookForm(b, refresh) }, "Edit"),
        h("button", { class: "linkish", type: "button", onclick: async () => { if (await confirmBox("Delete this book?", "Delete")) { try { await store.remove("books", b.id); toast("Deleted", "ok"); refresh(); } catch (e) { console.error(e); toast("Couldn't delete.", "bad"); } } } }, "Delete"))))
      : [h("p", { class: "muted" }, "No books yet. Add the first one.")]));
}
