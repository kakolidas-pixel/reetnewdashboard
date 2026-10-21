// Sample content shown only while firebase-config.js is unconfigured (demo mode).
// Everything here is placeholder text. Real content comes from the dashboard.
const river = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e59b3a'/><stop offset='.5' stop-color='#f4d38c'/><stop offset='.51' stop-color='#2f7f8f'/><stop offset='1' stop-color='#1b4a5e'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/><circle cx='570' cy='190' r='64' fill='#c4402a'/><path d='M0 330 q100 -36 200 0 t200 0 t200 0 t200 0 V600 H0z' fill='#1b4a5e' opacity='.55'/><path d='M0 420 q100 -30 200 0 t200 0 t200 0 t200 0 V600 H0z' fill='#123a4a' opacity='.6'/></svg>`);

const savedShot = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 400'><rect width='640' height='400' fill='#f4efe6'/><rect x='36' y='40' width='330' height='26' fill='#c4402a'/><rect x='36' y='96' width='560' height='12' fill='#9a9a9a'/><rect x='36' y='122' width='500' height='12' fill='#9a9a9a'/><rect x='36' y='148' width='540' height='12' fill='#9a9a9a'/><rect x='36' y='200' width='260' height='140' fill='#2f7f8f'/></svg>`);

export const demo = {
  previews: {
    "https://example.org/": { kind: "web", title: "Example Domain", site: "Example", author: "", date: "2026-01-12", description: "A saved description of the linked page, captured once when it was published, so it appears instantly and does not depend on the other site.", image: "", shot: savedShot }
  },
  settings: [{
    siteTitle: "Aryamann Reet",
    tagline: "Law, policy and the systems underneath them.",
    intro: "This is the running record of my work: projects, drafts and notes, published as they happen and revised in public.\n\nThe main thread right now is the [Brahmaputra Project](/projects/brahmaputra-project).",
    about: "Placeholder about text. Write this in the dashboard under **Pages**.\n\nIt supports markdown, so it can hold [links](https://example.org), *emphasis* and footnotes.[^1]\n\n[^1]: Footnotes render at the bottom of the page.",
    portrait: "", school: "Legacy School, Bangalore", showSchool: true,
    email: "hello@example.org",
    links: [{ label: "Example link", url: "https://example.org" }],
    footerNote: "Independent student work. Nothing here is legal advice.",
    featuredProject: "p1"
  }],
  projects: [
    { id: "p1", slug: "brahmaputra-project", title: "The Brahmaputra Project", status: "Ongoing", startDate: "2026-10-26", endDate: "", order: 1, featured: true, cover: river,
      summary: "A long-term study of who decides what happens to a shared river, and how communities downstream can be heard.",
      sources: [{ citation: "Placeholder source. *Case name* (Court, year).", url: "" }, { citation: "Another placeholder: Author, *Title* (Publisher 2026).", url: "https://example.org" }],
      body: "## The question\n\nPlaceholder text. What legal and diplomatic framework could give downstream communities reliable data, advance notice and a voice?\n\n![A placeholder image](" + river + " \"Images carry captions like this.\")\n\n## What exists so far\n\n- A legal map of the relevant instruments\n- A first draft instrument\n- A monitoring dashboard", published: true },
    { id: "p2", slug: "second-project", title: "A second project", status: "Complete", startDate: "2026-11-02", endDate: "2027-01-20", order: 2, featured: false, cover: "",
      summary: "Every project gets its own page and its own thread of writing.", body: "Placeholder.", published: true }
  ],
  posts: [
    { id: "u1", type: "update", slug: "update-demo1", projectId: "p1", date: "2026-11-20", title: "First legal map drafted", published: true, excerpt: "",
      body: "Placeholder **update**. Short dated notes like this appear under the project, newest first." },
    { id: "u2", type: "update", slug: "update-demo2", projectId: "p1", date: "2026-11-05", title: "", published: true, excerpt: "",
      body: "An update with no title still shows its date and text." },
    { id: "w1", slug: "why-this-river", title: "Why this river", date: "2026-11-09", projectId: "p1", published: true, excerpt: "",
      body: "Placeholder essay. Posts attached to a project appear on that project's page and in the timeline.\n\nA second paragraph, with a [link to the project](/projects/brahmaputra-project) that opens a preview window when you hover it." },
    { id: "w2", slug: "notes-on-drafting", title: "Notes on drafting a convention", date: "2026-10-30", projectId: "", published: true, excerpt: "A standalone post that belongs to no project.",
      body: "Standalone posts show up on the Writing page only." }
  ],
  timeline: [
    { id: "t1", date: "2026-10-18", title: "Started the site", description: "First commit of the public record." },
    { id: "t2", kind: "award", date: "2026-11-14", award: "Best Delegate", title: "Best Delegate", event: "Example MUN 2026", committee: "Disarmament and International Security", portfolio: "Delegation of Example", description: "Placeholder entry.", onTimeline: true },
    { id: "t3", kind: "award", date: "2026-09-20", award: "Verbal Mention", title: "Verbal Mention", event: "Sample Model UN", committee: "UN Environment Assembly", portfolio: "Delegation of Sample", description: "", onTimeline: true }
  ],
  books: [
    { id: "b1", title: "Placeholder Book One", author: "An Author", status: "Read", rating: 5, date: "2026-10-05", review: "Placeholder review text.", published: true },
    { id: "b2", title: "Placeholder Book Two", author: "Another Author", status: "Read", rating: 3, date: "2026-07-22", review: "", published: true },
    { id: "b3", title: "A Book From Last Year", author: "Someone Else", status: "Read", rating: 4, date: "2025-12-01", review: "", published: true },
    { id: "b4", title: "Currently Reading This", author: "Current Author", status: "Reading", rating: 0, date: "", review: "", published: true }
  ]
};
