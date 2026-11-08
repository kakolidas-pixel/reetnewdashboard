// Social crawlers (Facebook/Twitter/WhatsApp/Slack/etc.) read <meta> tags WITHOUT running
// JS, so without this, every shared /writing/:slug link would unfurl showing the homepage's
// title and description -- app.js's per-route updates never run for them. This rewrites the
// handful of meta tags that matter, in place, on top of the normal static response.
//
// Deliberately conservative: context.next() (the real page) is always fetched first and
// returned as-is on any failure below, so a Firestore hiccup or a missing post just means a
// visitor sees the default site preview instead of the post's -- never a broken page.
import { listPublished } from "../_lib/firestore.js";

const SITE = "https://aryamannreet.in";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestGet(context) {
  let res;
  try {
    res = await context.next();
    const slug = context.params.slug;
    const posts = await listPublished("posts");
    const post = posts.find(p => p.slug === slug);
    if (!post) return res;

    const title = post.title || "Aryamann Reet";
    const desc = post.excerpt || "";
    const url = `${SITE}/writing/${slug}`;

    const rewriter = new HTMLRewriter()
      .on("title", { element(el) { el.setInnerContent(`${title} | Aryamann Reet`); } })
      .on('meta[name="description"]', { element(el) { if (desc) el.setAttribute("content", desc); } })
      .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", url); } })
      .on('meta[property="og:type"]', { element(el) { el.setAttribute("content", "article"); } })
      .on('meta[property="og:title"]', { element(el) { el.setAttribute("content", title); } })
      .on('meta[property="og:description"]', { element(el) { if (desc) el.setAttribute("content", desc); } })
      .on('meta[property="og:url"]', { element(el) { el.setAttribute("content", url); } })
      .on('meta[name="twitter:title"]', { element(el) { el.setAttribute("content", title); } })
      .on('meta[name="twitter:description"]', { element(el) { if (desc) el.setAttribute("content", desc); } });

    if (post.cover) {
      rewriter.on('meta[name="twitter:card"]', { element(el) { el.setAttribute("content", "summary_large_image"); } });
      rewriter.on("head", { element(el) {
        el.append(`<meta property="og:image" content="${esc(post.cover)}"><meta name="twitter:image" content="${esc(post.cover)}">`, { html: true });
      } });
    }

    return rewriter.transform(res);
  } catch (err) {
    if (res) return res;
    try { return await context.next(); } catch { return new Response("Error", { status: 500 }); }
  }
}
