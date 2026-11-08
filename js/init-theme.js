// Applies the visitor's saved theme, or the OS preference if they've never chosen one, before
// the page paints -- so there's no flash of the wrong theme. Must run as an early, blocking,
// external script (CSP here has no 'unsafe-inline' in script-src). The toggle button's click
// handler lives in app.js and writes to the same "ar:theme" key.
(function () {
  try {
    var saved = localStorage.getItem("ar:theme");
    var light = saved ? saved === "light" : matchMedia("(prefers-color-scheme: light)").matches;
    if (light) document.documentElement.setAttribute("data-theme", "light");
  } catch { /* storage blocked; the dark theme is the default anyway */ }
})();
