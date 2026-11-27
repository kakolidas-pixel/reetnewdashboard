// Markdown rendering for the browser: the shared pipeline in mdcore.js, sanitized with DOMPurify.
import DOMPurify from "./vendor/dompurify.esm.js";
import { createMarkdown } from "./mdcore.js";

const md = createMarkdown(html => DOMPurify.sanitize(html));

export const render = md.render;
export const inline = md.inline;
export { excerpt, readingTime } from "./mdcore.js";
