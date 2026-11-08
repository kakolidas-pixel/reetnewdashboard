# Aryamann Reet: website and Desk dashboard

## READ THIS FIRST: fill in two files

This is a complete, fresh-start package. Two files still hold placeholders and MUST be filled in before the site works:

- `js/firebase-config.js`
- `admin/js/firebase-config.js`

In each, replace every `PASTE_...` value with the matching value from your Firebase project (Firebase console > Project settings >
Your apps > your web app). Both files take the same six values. Keep the quote marks and commas.

IMPORTANT: if you are adding this to a site that already works, do NOT upload these two files, or you will overwrite your real
settings with placeholders. Upload everything else and leave your existing two config files alone.


One site, hosted on Cloudflare Pages, with two parts:

- **The website** is `index.html` in this folder (home with timeline, projects, writing, about, contact).
- **Desk**, the private dashboard, lives in the `admin/` folder. It is a page of the same site, at `.../admin/`.

All content is stored in Firebase and edited from Desk. Nothing is hard-coded. Cloudflare only hosts the files.

## Addresses

- Website: `https://aryamannreet.in/`
- Dashboard: `https://aryamannreet.in/admin/`

Pages inside the website look like `.../writing/my-post` -- real addresses, not `#/...` fragments, so individual pages can actually be found by search engines. Cloudflare Pages makes this work with no server of your own, via two files at the root of the project: `_redirects` (sends any address that isn't a real file to `index.html`, which then renders the right page) and `_headers` (security headers, including the Content-Security-Policy). Don't delete either file.

## Preview the design on your computer (no Firebase needed)

Until `js/firebase-config.js` is filled in, the website shows **demo content**. Open a terminal in this folder and run either:

    python3 -m http.server 8000        (Python)
    npx serve .                        (Node.js)

then open http://localhost:8000. Opening index.html by double-clicking will not work.
Desk needs Firebase, so it only runs after the setup below.

## Setup

Firebase and GitHub change their screens and pricing over time, so check each step against their current documentation.

### 1. Firebase (console.firebase.google.com)
1. Create a project. Add a **Web app** (the `</>` icon) and copy its config block.
2. Paste that config into BOTH `js/firebase-config.js` and `admin/js/firebase-config.js`.
   (These values are not secrets. The security rules below are what protect the site.)
3. **Authentication:** turn on the Email/Password method and add ONE user, the owner, with a long unique password.
   Copy that user's **User UID**. Under Authentication > Settings > Authorized domains, add `aryamannreet.in`
   (and `*.pages.dev` too, if you still use Cloudflare's own preview address for testing).
   If the console offers it, turn off new sign-ups and consider multi-factor sign-in.
4. **Firestore Database:** create one (production mode, region near you, such as Mumbai).
5. **Storage:** enable it for images. Firebase may require its pay-as-you-go plan for Storage. Check current pricing
   and set a budget alert. Personal-site usage is very small.
6. **Rules:** open `firebase-rules/firestore.rules`, replace `REPLACE_WITH_OWNER_UID` with the UID, and paste the whole file into
   Firestore > Rules, then Publish. Do the same with `firebase-rules/storage.rules` in Storage > Rules.

### 2. Cloudflare Pages
1. In the Cloudflare dashboard, create a Pages project connected to this repository (or upload the folder directly).
   No build command or framework preset is needed -- this is a plain static site; leave the build output directory as the project root.
2. Under the project's **Custom domains**, add `aryamannreet.in` and point its DNS at Cloudflare as instructed there.
3. Wait for the first deploy to finish, then open the domain to confirm the site loads.

### 3. First sign-in
Open the dashboard address, sign in with the owner account, and go to **Pages** to write the intro, about text and tagline.

## Using Desk

- **Overview:** drafts in progress and a year-long writing grid.
- **Writing and Projects:** a markdown editor with live preview. Drag or paste images in, add footnotes, attach a post to a project.
  Drafts autosave. Published items save with Ctrl/Cmd+S so edits never go live by accident.
- **Sources and Updates (inside each project):** a citation list, and dated notes that appear under the project on the site and in the home timeline.
- **Links:** finds every outside link in your writing, projects, sources and Pages text, and captures a preview for each (title, source, date, description, picture). Visitors see these saved previews when they hover a link, so nothing depends on the other site. Edit any preview by hand. Previews are stored in your database under settings, so the rules need no change.
- **Awards:** MUN results and other recognition, shown on the Awards page and optionally on the home timeline.
- **Timeline:** add milestones. Published writing and project start dates join the home-page timeline automatically.
- **Pages:** name, tagline, intro, About text, portrait, links, footer note, featured project, and whether the school is shown.
- **Media:** every uploaded image, with copy-markdown and delete.
- **Messages:** what visitors send through the Contact page.

Markdown extras:
- `![alt](url "caption")` makes a captioned figure.
- `[^1]` with a line `[^1]: text` makes a footnote.
- `[![alt](image-url)](link)` makes an image that is also a link. It turns colour on hover and shows no preview window.
- A link written as `/projects/my-project` points to that page of the site and opens a preview window on hover.

## Design notes

- Charcoal ground, yellow highlight, Garamond text. Selected text and hovered links turn yellow.
- Images are grey until you point at them (always colour on touch screens).
- Hover a link (or tap it on a phone) for a draggable preview window. Links to your own pages show a real preview.
  External sites show a summary card (title, description, image) fetched from a free link-preview service (Microlink), with a "Visit site" button.
  Most websites refuse to be shown inside another page, so a card is the dependable option. The address of a hovered link is sent to that service.
  A picture of the page (a screenshot) comes from the same service, and a Live view button shows the real page inside the window for sites that allow being embedded.
  To turn the service off, set PREVIEW_SERVICE and SHOT_SERVICE to "" near the top of js/app.js. The free service has daily limits, so check its current terms.

## Things to know

- The dashboard page is reachable by anyone who knows the address, as on any website. What keeps people out is the login and the
  security rules. The page asks search engines not to index it.
- Have someone experienced review `firebase-rules/` before going live, and test sign-in, publishing, image upload and the contact form
  on the live address.
- The contact form is open to the public by design (size-limited). If spam appears, add Firebase App Check.
- You can optionally restrict the Firebase API key to your aryamannreet.in address in the Google Cloud console.
- The site shows a minor's name, and optionally school. Decide as a family what to publish; the school line is a switch in Pages.
