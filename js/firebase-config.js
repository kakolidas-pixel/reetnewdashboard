// Paste your Firebase web-app config here (Firebase console > Project settings > Your apps).
// Until you do, the site runs in DEMO MODE with sample content so you can preview the design.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");
