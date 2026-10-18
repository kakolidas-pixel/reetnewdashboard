import { h, panel, toast, confirmBox } from "./ui.js";
import { isConfigured } from "./firebase-config.js";

const root = document.getElementById("root");

if (!isConfigured) {
  root.replaceChildren(h("div", { class: "login" }, panel("Almost there",
    h("p", {}, "This dashboard isn't connected to Firebase yet."),
    h("p", { class: "muted" }, "Open admin/js/firebase-config.js, paste in your Firebase web-app config, and reload. The README walks through every step."))));
} else boot();

async function boot() {
  const core = await import("./core.js");
  const V = await import("./views.js");
  const P = await import("./pages.js");
  const { authApi, store } = core;

  const NAV = [["", "Overview"], ["writing", "Writing"], ["projects", "Projects"], ["timeline", "Timeline"], ["pages", "Pages"], ["media", "Media"], ["messages", "Messages"]];
  const stage = h("main", { class: "stage", id: "stage", tabindex: "-1" });
  const badge = h("span", { class: "badge", hidden: true });
  let shell = false;

  function login(msg = "") {
    shell = false;
    const email = h("input", { type: "email", autocomplete: "username", required: true });
    const pass = h("input", { type: "password", autocomplete: "current-password", required: true });
    const note = h("p", { class: "note bad", role: "alert" }, msg);
    const go = h("button", { class: "btn", type: "submit" }, "Sign in");
    const form = h("form", {},
      h("label", { class: "field" }, h("span", { class: "lab" }, "Email"), email),
      h("label", { class: "field" }, h("span", { class: "lab" }, "Password"), pass),
      note, h("div", { class: "actions left" }, go,
        h("button", { class: "linkish", type: "button", onclick: async () => {
          if (!email.value) { note.className = "note bad"; note.textContent = "Enter your email first, then choose this again."; return; }
          try { await authApi.reset(email.value); note.className = "note"; note.textContent = "If that account exists, a reset link is on its way."; } catch { note.className = "note bad"; note.textContent = "Couldn't send a reset link."; }
        } }, "Forgot password")));
    form.addEventListener("submit", async e => {
      e.preventDefault(); go.disabled = true; note.textContent = "";
      try { await authApi.signIn(email.value.trim(), pass.value); }
      catch (err) {
        note.className = "note bad";
        note.textContent = err.code === "auth/too-many-requests" ? "Too many attempts. Wait a few minutes, or reset your password." : "That email and password don't match.";
        go.disabled = false;
      }
    });
    root.replaceChildren(h("div", { class: "login" }, h("h1", { class: "brand big" }, "Desk"), h("p", { class: "lead" }, "Sign in to write, publish and tidy up."), panel("Sign in", form)));
    email.focus();
  }

  async function refreshBadge() {
    try { const n = (await store.list("messages")).filter(m => !m.read).length; badge.textContent = n; badge.hidden = !n; } catch { /* ignore */ }
  }

  function buildShell() {
    shell = true;
    const nav = h("nav", { class: "tabs", "aria-label": "Sections" }, NAV.map(([seg, label]) =>
      h("a", { href: "#/" + seg, "data-seg": seg }, label, seg === "messages" && badge)));
    root.replaceChildren(
      h("header", { class: "bar" }, h("a", { class: "brand", href: "#/" }, "Desk"), nav,
        h("div", { class: "who" }, h("button", { class: "linkish", type: "button", onclick: async () => { if (window.__deskDirty?.() && !(await confirmBox("You have unsaved changes. Sign out anyway?", "Sign out"))) return; window.onbeforeunload = null; authApi.signOut(); } }, "Sign out"))),
      stage);
    // Guard in-app navigation when a published item has unsaved changes.
    document.addEventListener("click", async e => {
      const a = e.target.closest('a[href^="#/"]');
      if (!a || !window.__deskDirty?.()) return;
      e.preventDefault();
      if (await confirmBox("You have unsaved changes to something that's live. Leave without saving?", "Leave")) { window.__deskDirty = null; window.onbeforeunload = null; location.hash = a.getAttribute("href"); }
    }, true);
    refreshBadge();
  }

  async function route() {
    if (!shell) return;
    window.__deskDirty = null; window.onbeforeunload = null;
    const [seg = "", arg] = location.hash.replace(/^#\/?/, "").split("/");
    document.querySelectorAll(".tabs a").forEach(a => a.toggleAttribute("aria-current", a.dataset.seg === seg));
    stage.replaceChildren(h("p", { class: "muted" }, "Opening…"));
    try {
      if (seg === "writing" && arg) await V.editor("posts")(stage, arg);
      else if (seg === "projects" && arg) await V.editor("projects")(stage, arg);
      else await ({ "": V.overview, writing: V.writing, projects: V.projects, timeline: P.timeline, pages: P.pages, media: P.media, messages: P.messages }[seg] || V.overview)(stage);
    } catch (err) {
      console.error(err);
      stage.replaceChildren(h("p", {}, "This screen couldn't load. Check your connection and sign-in, then reload."));
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("desk:messages", refreshBadge);
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && shell && !document.querySelector(".mde")) e.preventDefault(); });

  authApi.onChange(async user => {
    if (!user) return login();
    try { await store.probe(); }
    catch (e) {
      if (e.code === "permission-denied") { await authApi.signOut(); return login("This account doesn't have access to this dashboard."); }
      console.error(e);
    }
    if (!shell) buildShell();
    route();
  });
}
