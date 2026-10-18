// Paste your Firebase web-app config here (Firebase console > Project settings > Your apps).
// Until you do, the site runs in DEMO MODE with sample content so you can preview the design.
export const firebaseConfig = {
  apiKey: "AIzaSyD9jI248e6GxicFVCBKg4MLkeNlmk4rDFU",
  authDomain: "aryamannreet-site.firebaseapp.com",
  projectId: "aryamannreet-site",
  storageBucket: "aryamannreet-site.firebasestorage.app",
  messagingSenderId: "780803532579",
  appId: "1:780803532579:web:f8fefcfa8e036b09f60e96"
};
export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");
