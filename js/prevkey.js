// A stable id for a link's saved preview. The site and Desk must agree, so this file is identical in both.
export async function previewId(url) {
  const u = new URL(url);
  u.hash = "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(u.href));
  return "prev-" + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
