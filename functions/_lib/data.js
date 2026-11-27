// Full site content over Firestore's public REST API, for server-rendering pages. Returns the
// same shapes js/db.js gives the browser (documents with an `id`, settings merged over the
// defaults, the same sort order). The security rules that gate the browser gate this too: it
// asks for published documents only, using the Firebase web-app key that is already public in
// js/firebase-config.js.
import { DEFAULTS, sortProjects, sortPosts } from "../../js/site-data.js";

const PROJECT_ID = "aryamannreet-site";
const API_KEY = "AIzaSyD9jI248e6GxicFVCBKg4MLkeNlmk4rDFU";
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Firestore's typed JSON ({ stringValue }, { arrayValue }, ...) to plain values.
export function decode(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields);
  return null;
}

const decodeFields = fields => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decode(v)]));

// onlyPublished matches the where() the browser sends: the rules refuse a list that doesn't.
async function list(collection, onlyPublished) {
  const structuredQuery = { from: [{ collectionId: collection }], limit: 1000 };
  if (onlyPublished) structuredQuery.where = { fieldFilter: { field: { fieldPath: "published" }, op: "EQUAL", value: { booleanValue: true } } };
  const res = await fetch(`${ROOT}:runQuery?key=${API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) throw new Error(`Firestore ${collection}: ${res.status}`);
  return (await res.json())
    .filter(r => r.document)
    .map(r => ({ id: r.document.name.split("/").pop(), ...decodeFields(r.document.fields) }));
}

async function settings() {
  const res = await fetch(`${ROOT}/settings/site?key=${API_KEY}`);
  if (res.status === 404) return { ...DEFAULTS };
  if (!res.ok) throw new Error(`Firestore settings: ${res.status}`);
  return { ...DEFAULTS, ...decodeFields((await res.json()).fields) };
}

export async function fetchBundle() {
  const [S, projects, posts, timeline, books] = await Promise.all([
    settings(), list("projects", true), list("posts", true), list("timeline", false), list("books", true)
  ]);
  return { S, projects: sortProjects(projects), posts: sortPosts(posts), timeline, books };
}

// The js/db.js interface, answered from an already-fetched bundle.
export const dataFrom = b => ({
  settings: async () => b.S,
  projects: async () => b.projects,
  posts: async () => b.posts,
  timeline: async () => b.timeline,
  books: async () => b.books
});
