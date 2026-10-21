// Small UI helpers: element builder, retro window panels, modal, toast.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag), late = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "value" || k === "checked") late[k] = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  Object.assign(el, late);
  return el;
}

export const iso = d => d.toLocaleDateString("en-CA");
export const fmtDate = s => s ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "";
export const slugify = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

export function panel(title, ...kids) {
  return h("section", { class: "win" },
    h("div", { class: "win-bar" }, h("span", { class: "box" }), h("span", { class: "stripes" }), h("span", { class: "win-title" }, title), h("span", { class: "stripes" })),
    h("div", { class: "win-body" }, ...kids));
}

export function modal(title, body, { wide = false, onClose } = {}) {
  const back = h("div", { class: "back" });
  const win = panel(title, body);
  win.classList.add("modal"); if (wide) win.classList.add("wide");
  back.append(win); document.body.append(back);
  const key = e => { if (e.key === "Escape") close(); };
  function close() { back.remove(); document.removeEventListener("keydown", key); onClose?.(); }
  document.addEventListener("keydown", key);
  back.addEventListener("pointerdown", e => { if (e.target === back) close(); });
  return close;
}

export function confirmBox(message, label = "Confirm") {
  return new Promise(res => {
    let settled = false;
    const done = v => { if (settled) return; settled = true; close(); res(v); };
    const body = h("div", {}, h("p", {}, message),
      h("div", { class: "actions" },
        h("button", { class: "btn ghost", type: "button", onclick: () => done(false) }, "Cancel"),
        h("button", { class: "btn", type: "button", onclick: () => done(true) }, label)));
    const close = modal("Please confirm", body, { onClose: () => { if (!settled) { settled = true; res(false); } } });
  });
}

export function toast(msg, kind = "") {
  const t = h("div", { class: "toast " + kind }, msg);
  document.getElementById("toasts").append(t);
  setTimeout(() => t.classList.add("out"), 2800);
  setTimeout(() => t.remove(), 3200);
}
