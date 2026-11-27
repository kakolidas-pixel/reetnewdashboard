// DOM-free HTML sanitizer for the Pages Function, where DOMPurify can't run (no DOM). Input is
// marked's output plus any raw HTML the author wrote. Allowlist only: unknown tags are dropped but
// their text kept, script-like elements are dropped with their contents, URLs must be http(s),
// mailto, tel, relative, or an image data: URI, and the result is always balanced so an unclosed
// tag in a post can't reach into the footer. The browser still uses DOMPurify (js/md.js).

const ALLOWED = new Set(("a abbr b blockquote br caption cite code col colgroup dd del details div dl dt em figcaption figure " +
  "h1 h2 h3 h4 h5 h6 hr i img ins kbd li mark ol p pre q s samp section small span strong sub summary sup table tbody td tfoot " +
  "th thead time tr u ul var wbr").split(" "));
const VOID = new Set(["br", "hr", "img", "wbr", "col"]);
// Dropped together with everything inside them.
const DROP = new Set(("script style iframe object noscript template textarea select option svg math form button title head " +
  "applet frame frameset canvas audio video dialog xmp").split(" "));
// Dropped, but they have no closing tag, so there is no content to skip.
const DROP_VOID = new Set(["link", "meta", "input", "base", "source", "track", "embed", "param"]);

const GLOBAL = new Set(["class", "id", "title", "lang", "dir", "role", "style"]);
const EXTRA = {
  a: ["href", "rel"], img: ["src", "alt", "width", "height", "loading"], ol: ["start", "reversed", "type"], li: ["value"],
  td: ["colspan", "rowspan"], th: ["colspan", "rowspan", "scope"], details: ["open"], time: ["datetime"],
  blockquote: ["cite"], q: ["cite"], col: ["span"], colgroup: ["span"]
};
const URL_ATTRS = new Set(["href", "src", "cite"]);
const BOOLEAN = new Set(["open", "reversed"]);

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'<>\/=`]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>`=]+))?)*)\s*(\/?)>/y;
const ATTR = /([^\s"'<>\/=`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/g;

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", tab: "\t", newline: "\n", nbsp: " " };

function decodeEntities(s) {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]*));?/gi, (m, hex, dec, name) => {
    if (name) return NAMED[name.toLowerCase()] ?? m;
    const cp = hex ? parseInt(hex, 16) : parseInt(dec, 10);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  });
}

// Characters browsers ignore when working out a URL's scheme: controls, spaces, soft hyphen,
// zero-width and bidi marks, line/paragraph separators, BOM. Built from code points so no
// invisible character has to survive in this source file.
const INVISIBLE = new RegExp("[" + [[0, 0x20], [0x7f, 0x9f], [0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x2029], [0x2060, 0x2060], [0xfeff, 0xfeff]]
  .map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("").replace(/[\\\]^]/g, "\\$&") + "]", "g");

// Returns false when the URL's scheme isn't allowed. The check runs on the decoded, whitespace-
// stripped value, since browsers ignore both when working out the scheme ("java&#9;script:").
function urlAllowed(v, tag) {
  const s = decodeEntities(v).replace(INVISIBLE, "");
  const m = s.match(/^([a-z][a-z0-9+.\-]*):/i);
  if (!m) return true;
  const scheme = m[1].toLowerCase();
  if (scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel") return true;
  return tag === "img" && /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(s);
}

const styleAllowed = v => !/url\s*\(|expression|@import|behavior|binding|javascript:|\\/i.test(decodeEntities(v));

const attrEsc = v => v.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function attrs(tag, raw) {
  const extra = EXTRA[tag] || [];
  const seen = new Set();
  let out = "";
  for (const m of raw.matchAll(ATTR)) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    const ok = GLOBAL.has(name) || extra.includes(name) || /^data-[a-z0-9_.:-]+$/.test(name) || /^aria-[a-z-]+$/.test(name);
    if (!ok) continue;
    const v = m[2] ?? m[3] ?? m[4];
    if (v === undefined) { out += BOOLEAN.has(name) ? ` ${name}` : ` ${name}=""`; continue; }
    if (URL_ATTRS.has(name) && !urlAllowed(v, tag)) continue;
    if (name === "style" && !styleAllowed(v)) continue;
    out += ` ${name}="${attrEsc(v)}"`;
  }
  return out;
}

export function sanitizeHtml(html) {
  const src = String(html ?? "");
  const stack = [];
  let out = "", i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { out += src.slice(i); break; }
    out += src.slice(i, lt);
    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    TAG.lastIndex = lt;
    const m = TAG.exec(src);
    if (!m) { out += "&lt;"; i = lt + 1; continue; }
    i = lt + m[0].length;
    const closing = m[1] === "/", name = m[2].toLowerCase();
    if (DROP.has(name)) {
      if (!closing && !m[4]) {
        const found = new RegExp(`</${name}\\s*>`, "i").exec(src.slice(i));
        i = found ? i + found.index + found[0].length : src.length;
      }
      continue;
    }
    if (DROP_VOID.has(name) || !ALLOWED.has(name)) continue;
    if (closing) {
      if (VOID.has(name)) continue;
      const at = stack.lastIndexOf(name);
      if (at < 0) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    out += `<${name}${attrs(name, m[3])}>`;
    if (!VOID.has(name)) stack.push(name);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}
