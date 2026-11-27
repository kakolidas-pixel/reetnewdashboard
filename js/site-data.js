// Defaults and sort rules for site content, shared by js/db.js (browser) and the Pages Function
// so both build the same page from the same documents.
export const DEFAULTS = {
  siteTitle: "Aryamann Reet", tagline: "", intro: "", about: "", portrait: "",
  school: "Legacy School, Bangalore", showSchool: false, email: "", links: [],
  footerNote: "Independent student work. Nothing here is legal advice.", featuredProject: ""
};

const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99) || (b.startDate || "").localeCompare(a.startDate || "");

export const sortProjects = list => [...list].sort(byOrder);
export const sortPosts = list => [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
