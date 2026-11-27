// Server-renders every page of the site. The static index.html shell comes back from
// context.next() (the _redirects rule serves it for any non-file path), and this fills in what
// js/app.js would otherwise build in the browser: the page content, title, meta tags, canonical
// URL, structured data, header/footer text and the active nav link. js/render.js holds the
// templates for both, so the two can't drift.
//
// Fails open: on any error the untouched shell is returned and the browser renders as before.
// Switch it off without a deploy by setting an environment variable SSR_DISABLED=1 on the
// Pages project. Rendered pages and the Firestore data are cached for TTL seconds.
import { createMarkdown } from "../js/mdcore.js";
import { sanitizeHtml } from "../js/sanitize.js";
import { createRenderer, footerHtml, esc } from "../js/render.js";
import { fetchBundle, dataFrom } from "./_lib/data.js";

const SITE = "https://aryamannreet.in";
const TTL = 120;
// Real files and the admin app are never pages; everything else extension-less is a route.
const NOT_A_PAGE = /^\/(admin|css|js|firebase-rules)(\/|$)|\.[a-z0-9]+$/i;
// The only query parameters a page reads (writing filters), so arbitrary ones can't fan out the cache.
const QUERY_KEYS = ["project", "tag"];

const { renderRoute } = createRenderer(createMarkdown(sanitizeHtml));

const safely = async fn => { try { return await fn(); } catch { return null; } };

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if ((request.method !== "GET" && request.method !== "HEAD") || env.SSR_DISABLED || NOT_A_PAGE.test(path)) return context.next();

  const query = new URLSearchParams();
  for (const k of QUERY_KEYS) if (url.searchParams.has(k)) query.set(k, url.searchParams.get(k).slice(0, 100));
  const pageKey = new Request(`${url.origin}/__ssr${path === "/" ? "" : path}?${query}`);

  const hit = await safely(() => caches.default.match(pageKey));
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("cache-control", "no-cache");
    return new Response(hit.body, { status: hit.status, headers });
  }

  // Without the validators the shell's 304 would come back for a page whose content has changed.
  const headers = new Headers(request.headers);
  headers.delete("if-none-match");
  headers.delete("if-modified-since");
  const shell = await context.next(new Request(request, { headers }));
  if (shell.status !== 200 || !(shell.headers.get("content-type") || "").includes("text/html")) return shell;

  try {
    const bundle = await getBundle(context, url.origin);
    const ctx = { data: dataFrom(bundle), S: bundle.S, BASE: "", origin: SITE, year: new Date().getUTCFullYear() };
    const out = await renderRoute(path, query, ctx);
    const page = rewrite(shell, out, ctx, path);
    if (out.status === 200) context.waitUntil(safely(() => store(pageKey, page.clone())));
    return page;
  } catch (err) {
    console.error("ssr failed:", path, err && err.stack || err);
    return shell;
  }
}

async function getBundle(context, origin) {
  const key = new Request(`${origin}/__ssr-data`);
  const hit = await safely(() => caches.default.match(key));
  if (hit) return hit.json();
  const bundle = await fetchBundle();
  context.waitUntil(safely(() => caches.default.put(key, new Response(JSON.stringify(bundle), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${TTL}` }
  }))));
  return bundle;
}

function store(key, page) {
  const headers = new Headers(page.headers);
  headers.set("cache-control", `public, max-age=${TTL}`);
  return caches.default.put(key, new Response(page.body, { status: page.status, headers }));
}

const set = (name, value) => ({ element(el) { el.setAttribute(name, value); } });

function rewrite(shell, out, ctx, path) {
  const { S } = ctx;
  const rw = new HTMLRewriter();

  // The home page's title, description and social tags are written by hand in index.html; leave them.
  if (out.kind !== "home") {
    const title = out.title ? `${out.title} | ${S.siteTitle}` : S.siteTitle;
    const ogTitle = out.title || S.siteTitle;
    const desc = out.description || S.tagline || "";
    const canonical = SITE + path;
    rw.on("title", { element(el) { el.setInnerContent(title); } })
      .on('meta[name="description"]', set("content", desc))
      .on('link[rel="canonical"]', set("href", canonical))
      .on('meta[property="og:url"]', set("content", canonical))
      .on('meta[property="og:title"]', set("content", ogTitle))
      .on('meta[property="og:description"]', set("content", desc))
      .on('meta[name="twitter:title"]', set("content", ogTitle))
      .on('meta[name="twitter:description"]', set("content", desc));
    if (out.ogType) rw.on('meta[property="og:type"]', set("content", out.ogType));
    if (out.image) rw.on('meta[name="twitter:card"]', set("content", "summary_large_image"));
  }

  // The read-more toggle and the clamped excerpts are JavaScript behaviour; without it, show the text.
  let head = `<noscript><style>.read-more{display:none}.excerpt.clamped{display:block;-webkit-line-clamp:unset;overflow:visible}</style></noscript>`;
  if (out.image && out.kind !== "home") head += `<meta property="og:image" content="${esc(out.image)}"><meta name="twitter:image" content="${esc(out.image)}">`;
  if (out.status === 404) head += `<meta name="robots" content="noindex">`;
  rw.on("head", { element(el) { el.append(head, { html: true }); } });

  if (out.structured) {
    // "<" is escaped so the JSON can never close the script element early.
    const json = JSON.stringify(out.structured).replace(/</g, "\\u003c");
    rw.on("script#ldRoute", { element(el) { el.setInnerContent(json, { html: true }); } });
  }

  const footer = footerHtml({ S, BASE: ctx.BASE, demoMode: false, year: ctx.year });
  rw.on("main#view", { element(el) { el.setAttribute("data-ssr", "1"); el.setInnerContent(out.html, { html: true }); } })
    .on("a#wordmark", { element(el) { el.setInnerContent(S.siteTitle); } })
    .on("footer#foot", { element(el) { el.setInnerContent(footer, { html: true }); } })
    .on("#nav a", { element(el) {
      const href = el.getAttribute("href") || "";
      if (href && (path === href || path.startsWith(href + "/"))) el.setAttribute("aria-current", "page");
    } })
    .on("body > noscript", { element(el) { el.remove(); } }); // "needs JavaScript" no longer true

  const page = rw.transform(shell);
  const headers = new Headers(page.headers);
  for (const h of ["etag", "last-modified", "content-length"]) headers.delete(h);
  headers.set("x-ssr", "1");
  return new Response(page.body, { status: out.status, headers });
}
