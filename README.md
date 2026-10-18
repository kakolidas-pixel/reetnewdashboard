# Aryamann Reet: website and Desk dashboard

One GitHub Pages site with two parts:

- **The website** is `index.html` in this folder (home with timeline, projects, writing, about, contact).
- **Desk**, the private dashboard, lives in the `admin/` folder. It is a page of the same site, at `.../admin/`.

All content is stored in Firebase and edited from Desk. Nothing is hard-coded. GitHub only hosts the files.

## Addresses

If your GitHub username is `aryamann` and the repository is called `site`:

- Website: `https://aryamann.github.io/site/`
- Dashboard: `https://aryamann.github.io/site/admin/`

Pages inside the website look like `.../site/#/projects/my-project`. The `#` is deliberate: it makes every page work on GitHub Pages with no server settings.

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
   Copy that user's **User UID**. Under Authentication > Settings > Authorized domains, add `YOURNAME.github.io`.
   If the console offers it, turn off new sign-ups and consider multi-factor sign-in.
4. **Firestore Database:** create one (production mode, region near you, such as Mumbai).
5. **Storage:** enable it for images. Firebase may require its pay-as-you-go plan for Storage. Check current pricing
   and set a budget alert. Personal-site usage is very small.
6. **Rules:** open `firebase-rules/firestore.rules`, replace `REPLACE_WITH_OWNER_UID` with the UID, and paste the whole file into
   Firestore > Rules, then Publish. Do the same with `firebase-rules/storage.rules` in Storage > Rules.

### 2. GitHub
1. Create a new repository. GitHub Pages on a free account generally needs a **public** repository. Check GitHub's current rules.
   Public is fine here: the files contain no passwords, and the rules protect the data.
2. Upload everything in this folder, keeping the folders. The easiest way is GitHub Desktop (desktop.github.com).
3. In the repository, go to Settings > Pages. Under "Build and deployment" choose **Deploy from a branch**, branch **main**, folder **/ (root)**.
4. Wait a minute or two. GitHub shows the address at the top of the Pages screen.

### 3. First sign-in
Open the dashboard address, sign in with the owner account, and go to **Pages** to write the intro, about text and tagline.

## Using Desk

- **Overview:** drafts in progress and a year-long writing grid.
- **Writing and Projects:** a markdown editor with live preview. Drag or paste images in, add footnotes, attach a post to a project.
  Drafts autosave. Published items save with Ctrl/Cmd+S so edits never go live by accident.
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
  External sites show a small card with a "Visit site" button, because most websites block being embedded.

## Things to know

- The dashboard page is reachable by anyone who knows the address, as on any website. What keeps people out is the login and the
  security rules. The page asks search engines not to index it.
- Have someone experienced review `firebase-rules/` before going live, and test sign-in, publishing, image upload and the contact form
  on the live address.
- The contact form is open to the public by design (size-limited). If spam appears, add Firebase App Check.
- You can optionally restrict the Firebase API key to your github.io address in the Google Cloud console.
- The site shows a minor's name, and optionally school. Decide as a family what to publish; the school line is a switch in Pages.
