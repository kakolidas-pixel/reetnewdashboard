// Same Firebase project as the public site. Paste the same web-app config here.
export const firebaseConfig = {
  apiKey: "AIzaSyD9jI248e6GxicFVCBKg4MLkeNlmk4rDFU",
  authDomain: "aryamannreet-site.firebaseapp.com",
  databaseURL: "https://aryamannreet-site-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aryamannreet-site",
  storageBucket: "aryamannreet-site.firebasestorage.app",
  messagingSenderId: "780803532579",
  appId: "1:780803532579:web:f8fefcfa8e036b09f60e96"
};
export const isConfigured = !firebaseConfig.apiKey.startsWith("PASTE");
