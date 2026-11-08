// Same idea as functions/writing/[slug].js -- see that file for the full explanation.
// Always falls back to the plain static response on any failure.
import { listPublished } from "../_lib/firestore.js";

const SITE = "https://aryamannreet.in";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestGet(context) {
  let res;
  try {
    res = await context.next();
    const slug = context.params.slug;
    const projects = await listPublished("projects");
    const project = projects.find(p => p.slug === slug);
    if (!project) return res;

    const title = project.title || "Aryamann Reet";
    const desc = project.excerpt || "";
    const url = `${SITE}/projects/${slug}`;

    const rewriter = new HTMLRewriter()
      .on("title", { element(el) { el.setInnerContent(`${title} | Aryamann Reet`); } })
      .on('meta[name="description"]', { element(el) { if (desc) el.setAttribute("content", desc); } })
      .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", url); } })
      .on('meta[property="og:title"]', { element(el) { el.setAttribute("content", title); } })
      .on('meta[property="og:description"]', { element(el) { if (desc) el.setAttribute("content", desc); } })
      .on('meta[property="og:url"]', { element(el) { el.setAttribute("content", url); } })
      .on('meta[name="twitter:title"]', { element(el) { el.setAttribute("content", title); } })
      .on('meta[name="twitter:description"]', { element(el) { if (desc) el.setAttribute("content", desc); } });

    if (project.cover) {
      rewriter.on('meta[name="twitter:card"]', { element(el) { el.setAttribute("content", "summary_large_image"); } });
      rewriter.on("head", { element(el) {
        el.append(`<meta property="og:image" content="${esc(project.cover)}"><meta name="twitter:image" content="${esc(project.cover)}">`, { html: true });
      } });
    }

    return rewriter.transform(res);
  } catch (err) {
    if (res) return res;
    try { return await context.next(); } catch { return new Response("Error", { status: 500 }); }
  }
}
