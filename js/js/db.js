// Data layer. Reads published content from Firestore, or from demo-data.js when unconfigured.
//
// Speed: Firebase starts downloading the moment this file loads (in parallel, once). The last
// copy of every collection is kept in the browser, so repeat visits paint instantly while fresh
// data is fetched behind the scenes. If the fresh data differs, the page quietly updates.
import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { demo } from "./demo-data.js";
import { previewId } from "./prevkey.js";

const BASE = "https://www.gstatic.com/firebasejs/10.12.2/";
export const demoMode = !isConfigured;

let ready;
function boot() {
  return ready ??= Promise.all([import(BASE + "firebase-app.js"), import(BASE + "firebase-firestore.js")]).then(([A, F]) => {
    const app = A.initializeApp(firebaseConfig);
    // Falls back to long-polling on networks that block Firestore's default connection, which otherwise stalls for ~10s.
    const db = F.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    return { F, db };
  });
}
if (isConfigured) boot().catch(() => {}); // start now; errors surface when data is requested

/* ---------- saved copy + background refresh ---------- */
const LS = "ar:v1:";
const read = k => { try { return JSON.parse(localStorage.getItem(LS + k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
const mem = {};

function cached(key, fetcher) {
  if (mem[key]) return mem[key];
  const stored = read(key);
  const t0 = performance.now();
  const fresh = fetcher().then(v => {
    console.info(`[site] ${key} loaded from Firebase in ${Math.round(performance.now() - t0)} ms`);
    const changed = JSON.stringify(v) !== JSON.stringify(stored);
    mem[key] = Promise.resolve(v);
    if (changed) { write(key, v); if (stored) window.dispatchEvent(new Event("data:updated")); }
    return v;
  });
  fresh.catch(err => { console.error(`[site] ${key} failed`, err); if (!stored) delete mem[key]; });
  mem[key] = stored ? Promise.resolve(stored) : fresh; // saved copy first, if there is one
  return mem[key];
}

async function fetchCol(name, onlyPublished) {
  const { F, db } = await boot();
  const ref = F.collection(db, name);
  const snap = await F.getDocs(onlyPublished ? F.query(ref, F.where("published", "==", true)) : ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const DEFAULTS = {
  siteTitle: "Aryamann Reet", tagline: "", intro: "", about: "", portrait: "",
  school: "Legacy School, Bangalore", showSchool: false, email: "", links: [],
  footerNote: "Independent student work. Nothing here is legal advice.", featuredProject: ""
};

const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99) || (b.startDate || "").localeCompare(a.startDate || "");
const list = (name, published) => isConfigured ? cached(name, () => fetchCol(name, published)) : Promise.resolve(structuredClone(demo[name] || []));

export const settings = () => isConfigured
  ? cached("settings", async () => { const { F, db } = await boot(); const d = await F.getDoc(F.doc(db, "settings", "site")); return d.exists() ? d.data() : {}; }).then(s => ({ ...DEFAULTS, ...s }))
  : Promise.resolve({ ...DEFAULTS, ...demo.settings[0] });
export const projects = async () => [...await list("projects", true)].sort(byOrder);
export const posts = async () => [...await list("posts", true)].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
export const timeline = () => list("timeline", false);

// A link's saved preview (captured in Desk). Returns null if none has been saved.
const prevMem = new Map();
export async function preview(url) {
  if (prevMem.has(url)) return prevMem.get(url);
  let rec = null;
  if (!isConfigured) rec = demo.previews?.[url] || null;
  else {
    const { F, db } = await boot();
    const d = await F.getDoc(F.doc(db, "settings", await previewId(url)));
    rec = d.exists() ? d.data() : null;
  }
  prevMem.set(url, rec);
  return rec;
}

export async function sendMessage({ name, email, message }) {
  if (!isConfigured) return;
  const { F, db } = await boot();
  await F.addDoc(F.collection(db, "messages"), { name, email, message, read: false, createdAt: F.serverTimestamp() });
}
