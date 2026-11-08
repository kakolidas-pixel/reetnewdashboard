// Shared by the Cloudflare Pages Functions in this directory (sitemap.xml, writing/[slug],
// projects/[slug]). Reads published posts/projects straight from Firestore's public REST API
// -- the same security rules that let the browser read them (see firebase-rules/firestore.rules)
// apply here too, so this never needs its own credentials.
//
// This API key is the Firebase *web app* key, the same one already public in
// js/firebase-config.js -- not a secret; Firestore's security rules are what protect the data.
const PROJECT_ID = "aryamannreet-site";
const API_KEY = "AIzaSyD9jI248e6GxicFVCBKg4MLkeNlmk4rDFU";

export async function listPublished(collection) {
  // A bare "list the collection" REST call is rejected outright (403) unless the query
  // structurally matches the security rule -- Firestore won't silently filter a plain list,
  // it just refuses it. So this sends the same where(published == true) query the client
  // SDK uses (see js/db.js's fetchCol), via the :runQuery endpoint, which Firestore can
  // verify against the rule and therefore allows.
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: "published" }, op: "EQUAL", value: { booleanValue: true } } },
      limit: 300
    }
  };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Firestore ${collection} query failed: ${res.status}`);
  const rows = await res.json();
  return rows
    .filter(r => r.document)
    .map(r => {
      const f = r.document.fields || {};
      const str = k => f[k]?.stringValue ?? "";
      return {
        slug: str("slug"),
        title: str("title"),
        excerpt: str("excerpt") || str("summary"),
        cover: str("cover"),
        date: str("date") || str("startDate"),
        type: str("type")
      };
    })
    // Project updates live under "posts" too (same collection) but are only ever shown
    // inline on their project's page, not as their own standalone article -- same rule
    // app.js's own writing() list uses to tell them apart from real posts.
    .filter(p => p.slug && p.type !== "update");
}
