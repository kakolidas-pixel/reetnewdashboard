// Data layer. Reads published content from Firestore, or from demo-data.js when unconfigured.
import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { demo } from "./demo-data.js";

const base = "https://www.gstatic.com/firebasejs/10.12.2/";
let fs, db;
const cache = {};

async function boot() {
  if (db || !isConfigured) return;
  const { initializeApp } = await import(base + "firebase-app.js");
  fs = await import(base + "firebase-firestore.js");
  db = fs.getFirestore(initializeApp(firebaseConfig));
}

async function col(name, onlyPublished) {
  if (!isConfigured) return structuredClone(demo[name] || []);
  await boot();
  const ref = fs.collection(db, name);
  const snap = await fs.getDocs(onlyPublished ? fs.query(ref, fs.where("published", "==", true)) : ref);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const memo = (k, f) => cache[k] ??= f().catch(e => { delete cache[k]; throw e; });

const DEFAULTS = {
  siteTitle: "Aryamann Reet", tagline: "", intro: "", about: "", portrait: "",
  school: "Legacy School, Bangalore", showSchool: false, email: "", links: [],
  footerNote: "Independent student work. Nothing here is legal advice.", featuredProject: ""
};

export const demoMode = !isConfigured;

export const settings = () => memo("settings", async () => {
  if (!isConfigured) return { ...DEFAULTS, ...demo.settings[0] };
  await boot();
  const d = await fs.getDoc(fs.doc(db, "settings", "site"));
  return { ...DEFAULTS, ...(d.exists() ? d.data() : {}) };
});

const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99) || (b.startDate || "").localeCompare(a.startDate || "");
export const projects = () => memo("projects", async () => (await col("projects", true)).sort(byOrder));
export const posts = () => memo("posts", async () => (await col("posts", true)).sort((a, b) => (b.date || "").localeCompare(a.date || "")));
export const timeline = () => memo("timeline", () => col("timeline", false));

export async function sendMessage({ name, email, message }) {
  if (!isConfigured) return;
  await boot();
  await fs.addDoc(fs.collection(db, "messages"), { name, email, message, read: false, createdAt: fs.serverTimestamp() });
}
