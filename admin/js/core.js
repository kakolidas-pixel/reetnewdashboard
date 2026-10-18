// Firebase wiring: auth, Firestore helpers, image upload.
import { firebaseConfig } from "./firebase-config.js";
const base = "https://www.gstatic.com/firebasejs/10.12.2/";
const [{ initializeApp }, A, F, S] = await Promise.all([
  import(base + "firebase-app.js"), import(base + "firebase-auth.js"),
  import(base + "firebase-firestore.js"), import(base + "firebase-storage.js")
]);

const app = initializeApp(firebaseConfig);
export const auth = A.getAuth(app);
const db = F.getFirestore(app);
const storage = S.getStorage(app);

export const authApi = {
  signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
  signOut: () => A.signOut(auth),
  reset: e => A.sendPasswordResetEmail(auth, e),
  onChange: cb => A.onAuthStateChanged(auth, cb)
};

export const store = {
  async list(col) { const s = await F.getDocs(F.collection(db, col)); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
  async get(col, id) { const d = await F.getDoc(F.doc(db, col, id)); return d.exists() ? { id: d.id, ...d.data() } : null; },
  async save(col, id, data) {
    if (id) { await F.setDoc(F.doc(db, col, id), data, { merge: true }); return id; }
    return (await F.addDoc(F.collection(db, col), data)).id;
  },
  async remove(col, id) { await F.deleteDoc(F.doc(db, col, id)); },
  // Only the owner can read messages, so this doubles as an access check after sign-in.
  async probe() { await F.getDocs(F.query(F.collection(db, "messages"), F.limit(1))); }
};

const OK = /^image\/(jpeg|png|webp|gif)$/;

async function shrink(file, max = 1800) {
  if (file.type === "image/gif") return { blob: file, type: file.type, w: 0, h: 0 };
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise(r => c.toBlob(r, type, 0.86));
  return { blob, type, w, h };
}

export async function uploadImage(file) {
  if (!OK.test(file.type)) throw new Error("Only JPEG, PNG, WebP or GIF images can be uploaded.");
  const { blob, type, w, h } = await shrink(file);
  const safe = file.name.replace(/[^a-z0-9._-]+/gi, "-").slice(-60);
  const path = `media/${Date.now()}-${safe}`;
  const r = S.ref(storage, path);
  await S.uploadBytes(r, blob, { contentType: type });
  const url = await S.getDownloadURL(r);
  const rec = { url, path, name: file.name, w, h, createdAt: new Date().toISOString() };
  rec.id = await store.save("media", null, rec);
  return rec;
}

export async function deleteMedia(m) {
  try { await S.deleteObject(S.ref(storage, m.path)); } catch (e) { if (e.code !== "storage/object-not-found") throw e; }
  await store.remove("media", m.id);
}
