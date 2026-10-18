// Markdown rendering shared by the site and the dashboard preview.
// Supports GitHub-style markdown, figures with captions, and footnotes ([^1] and [^1]: text).
import { marked, Renderer } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm";

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const renderer = new Renderer();
renderer.image = (href, title, text) => {
  const img = `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy">`;
  return title ? `<figure>${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
};

function footnotes(src) {
  const defs = {};
  src = src.replace(/^\[\^([^\]]+)\]:[ \t]*(.*(?:\n(?![ \t]*\n|\[\^).*)*)/gm, (m, id, text) => { defs[id] = text.trim(); return ""; });
  const order = [];
  src = src.replace(/\[\^([^\]]+)\]/g, (m, id) => {
    if (!(id in defs)) return m;
    let n = order.indexOf(id);
    if (n < 0) { order.push(id); n = order.length - 1; }
    return `<sup class="fnref" id="fnref-${n + 1}"><a href="#fn-${n + 1}" data-fn="fn-${n + 1}">${n + 1}</a></sup>`;
  });
  if (!order.length) return src;
  const items = order.map((id, i) => `<li id="fn-${i + 1}">${marked.parseInline(defs[id])} <a class="fnback" href="#fnref-${i + 1}" data-fn="fnref-${i + 1}">&#8617;</a></li>`).join("");
  return `${src}\n\n<section class="footnotes"><ol>${items}</ol></section>`;
}

export function render(md) {
  let html = marked.parse(footnotes(md || ""), { renderer, gfm: true });
  html = html.replace(/<p>\s*((?:<a [^>]*>)?\s*<figure>[\s\S]*?<\/figure>\s*(?:<\/a>)?)\s*<\/p>/g, "$1");
  return DOMPurify.sanitize(html);
}

// Plain-text excerpt for lists and previews.
export function excerpt(md, n = 160) {
  const t = String(md || "")
    .replace(/^\[\^[^\]]+\]:.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[#>*_`~]+/g, " ")
    .replace(/^\s*[-+]\s+/gm, " ")
    .replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

export const readingTime = md => Math.max(1, Math.round(((String(md || "").match(/\S+/g) || []).length) / 220));
