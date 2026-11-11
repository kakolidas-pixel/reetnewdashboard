
import { listPublished } from "./_lib/firestore.js";

const SITE = "https://aryamannreet.in";
const STATIC_PATHS = ["/", "/about", "/projects", "/writing", "/awards", "/books", "/contact", "/privacy", "/copyright"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestGet(context) {
  try {
    const [posts, projects] = await Promise.all([listPublished("posts"), listPublished("projects")]);
    const paths = [
      ...STATIC_PATHS,
      ...projects.map(p => `/projects/${p.slug}`),
      ...posts.map(p => `/writing/${p.slug}`)
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      paths.map(p => `  <url><loc>${esc(SITE + p)}</loc></url>`).join("\n")
    }\n</urlset>\n`;
    return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
  } catch (err) {
    return context.next();
  }
}
