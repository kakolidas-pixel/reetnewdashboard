// A small, permanent statement of what this site refuses to do. Not an ad slot, not dismissable --
// it rotates through a fixed set of positions and stays out of the way in the right margin.
const statements = [
  "We will not sell your attention to ad brokers. Renting out a reader's focus to the highest bidder is a broken model, and it does not run here.",
  "No cross-site trackers, no third-party pixels, no quiet reports to someone else's dashboard. What you read here stays between you and the page.",
  "We do not harvest data we do not need, and we do not need much. A visit is not a dataset.",
  "This site opts out of AI training and scraping, in the markup, not just in a policy nobody reads. Writing here is not material for someone else's model.",
  "Platforms rot the day they start serving shareholders instead of readers. Staying small beats selling out the difference.",
  "Outrage engineered for clicks is not journalism. It is bait, and it is not published here.",
  "AI-generated filler is not writing. Everything on this site was written by a person who meant it.",
  "Run models on your own machine. The cloud is a rented computer logging every prompt whispered to it, and that trade is refused here.",
  "No dark patterns on this page. No fake urgency, no pre-checked box, no unsubscribe link hidden on purpose.",
  "Nothing here locks you in. Leave whenever you like. Nothing was built to make that difficult.",
  "A fast page is a form of respect. No one should wait on a tracker to read a sentence.",
  "What you read here is not rented to you. Keep it, save it, walk away without losing it.",
  "If an ad ever appears on this page, something has gone wrong. That was never supposed to be for sale.",
];

function init() {
  const textEl = document.getElementById("mText");
  const idxEl = document.getElementById("mIndex");
  const totalEl = document.getElementById("mTotal");
  const root = document.getElementById("manifesto");
  if (!textEl || !root) return;

  totalEl.textContent = String(statements.length).padStart(2, "0");
  let i = Math.floor(Math.random() * statements.length);

  function render() {
    textEl.textContent = statements[i];
    idxEl.textContent = String(i + 1).padStart(2, "0");
  }
  function next() { i = (i + 1) % statements.length; render(); }
  function prev() { i = (i - 1 + statements.length) % statements.length; render(); }
  render();

  document.getElementById("mNext").addEventListener("click", next);
  document.getElementById("mPrev").addEventListener("click", prev);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    let timer = setInterval(next, 9000);
    root.addEventListener("mouseenter", () => clearInterval(timer));
    root.addEventListener("mouseleave", () => { timer = setInterval(next, 9000); });
    root.addEventListener("focusin", () => clearInterval(timer));
    root.addEventListener("focusout", () => { timer = setInterval(next, 9000); });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
