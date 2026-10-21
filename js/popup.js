// Retro link-preview windows. Hover a link (desktop) or tap it (touch) to open one.
// Windows can be dragged, pinned by clicking inside them, and closed with the box, Esc, or a click elsewhere.
const fine = matchMedia("(hover:hover) and (pointer:fine)");
const wins = new Map();
let zTop = 60, resolver = null, hoverTimer;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const keyOf = a => new URL(a.href, location.href).href;

export function closeAll() { clearTimeout(hoverTimer); [...wins.values()].forEach(w => w.close()); }

export function initPopups(resolve) {
  resolver = resolve;
  document.addEventListener("mouseover", e => {
    if (!fine.matches) return;
    const a = e.target.closest?.("a.peek"); if (!a) return;
    const w = wins.get(keyOf(a));
    if (w) { w.enter(); return; }
    clearTimeout(hoverTimer);
    // Never open for a link that has already been removed by a page change.
    hoverTimer = setTimeout(() => { if (a.isConnected) open(a, false); }, 380);
  });
  document.addEventListener("mouseout", e => {
    const a = e.target.closest?.("a.peek"); if (!a) return;
    clearTimeout(hoverTimer);
    wins.get(keyOf(a))?.leave();
  });
  // On touch screens the first tap opens the preview; "Open page" inside it follows the link.
  document.addEventListener("click", e => {
    const a = e.target.closest?.("a.peek");
    if (!a || fine.matches || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); e.stopPropagation();
    open(a, true);
  }, true);
  document.addEventListener("pointerdown", e => { if (e.target.closest?.("a")) clearTimeout(hoverTimer); }, true);
  window.addEventListener("hashchange", closeAll);
  document.addEventListener("keydown", e => { if (e.key === "Escape") [...wins.values()].pop()?.close(); });
  document.addEventListener("pointerdown", e => {
    if (!e.target.closest?.(".win,a.peek")) [...wins.values()].forEach(w => { if (!w.pinned) w.close(); });
  });
}

function position(el, a) {
  if (matchMedia("(max-width:640px)").matches || el.dataset.moved) return;
  const r = a.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  const x = Math.max(8, Math.min(r.left, innerWidth - w - 8));
  let y = r.bottom + 10;
  if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 10);
  el.style.left = x + "px"; el.style.top = y + "px";
}

function drag(el, bar) {
  bar.addEventListener("pointerdown", e => {
    if (e.target.closest(".win-close")) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = ev => { el.dataset.moved = "1"; el.style.left = Math.max(0, ev.clientX - sx) + "px"; el.style.top = Math.max(0, ev.clientY - sy) + "px"; };
    const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up);
  });
}

function open(a, pin) {
  if (!a.isConnected) return;
  const k = keyOf(a);
  const have = wins.get(k);
  if (have) { have.enter(); have.front(); if (pin) have.pinned = true; return; }
  if (wins.size >= 3) [...wins.values()][0].close();

  const el = document.createElement("div");
  el.className = "win";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Link preview");
  el.innerHTML = `<div class="win-bar"><button class="win-close" type="button" aria-label="Close preview"></button><span class="stripes"></span><span class="win-title">Opening</span><span class="stripes"></span></div><div class="win-body"><p>Reading…</p></div><div class="win-foot"></div>`;
  document.body.append(el);

  let closeTimer;
  const o = {
    pinned: pin, el,
    enter() { clearTimeout(closeTimer); },
    leave() { if (o.pinned) return; clearTimeout(closeTimer); closeTimer = setTimeout(o.close, 450); },
    front() { el.style.zIndex = ++zTop; },
    close() { clearTimeout(closeTimer); el.classList.remove("on"); setTimeout(() => el.remove(), 160); wins.delete(k); }
  };
  wins.set(k, o); o.front(); position(el, a);
  requestAnimationFrame(() => el.classList.add("on"));
  el.addEventListener("mouseenter", o.enter);
  el.addEventListener("mouseleave", o.leave);
  el.addEventListener("pointerdown", () => { o.pinned = true; o.front(); });
  el.querySelector(".win-close").addEventListener("click", o.close);
  drag(el, el.querySelector(".win-bar"));

  const fill = info => {
    const body = el.querySelector(".win-body"), foot = el.querySelector(".win-foot");
    el.querySelector(".win-title").textContent = info.title || "Preview";
    const og = info.image ? `<img src="${esc(info.image)}" alt="">` : "";
    body.innerHTML =
      (info.shot ? `<div class="shot-wrap" hidden><img class="shot" alt=""></div>` : og) +
      (info.heading ? `<h4>${esc(info.heading)}</h4>` : "") +
      (info.meta ? `<p class="m">${esc(info.meta)}</p>` : "") +
      (info.text ? `<p>${esc(info.text)}</p>` : "") +
      (info.url ? `<p class="url">${esc(info.url)}</p>` : "");
    // A picture of the page. It appears when it has loaded; if it can't, fall back to the site's own image.
    if (info.shot) {
      const img = body.querySelector(".shot"), wrap = img.parentElement;
      img.addEventListener("load", () => { wrap.hidden = false; position(el, a); });
      img.addEventListener("error", () => { wrap.remove(); if (og) body.insertAdjacentHTML("afterbegin", og); position(el, a); });
      img.src = info.shot;
    }
    foot.innerHTML = info.external
      ? `${/^https:\/\//.test(info.url) ? `<button class="win-go alt" type="button">Live view</button>` : ""}<a class="win-go" href="${esc(info.url)}" target="_blank" rel="noopener noreferrer">Visit site</a>`
      : `<a class="win-go" href="${esc(info.href)}">Open page</a>`;
    // Live view: load the real page inside the window. Only on request, and only for sites that allow being embedded.
    foot.querySelector(".alt")?.addEventListener("click", e => {
      o.pinned = true; el.classList.add("wide");
      body.innerHTML = `<iframe class="live" src="${esc(info.url)}" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" title="Live preview of ${esc(info.title)}"></iframe><p class="m" style="margin:.5rem 0 0">If nothing appears, this site doesn't allow previews. Use Visit site.</p>`;
      e.target.remove(); position(el, a);
    });
    position(el, a);
  };
  Promise.resolve(resolver(k)).then(fill).catch(() => fill({ title: "Unavailable", text: "A preview could not be loaded.", href: k }));
}
