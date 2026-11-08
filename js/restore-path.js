// Restores the real address after GitHub Pages' 404.html redirect sent it here as a query
// string (see 404.html). Must run before anything else looks at the URL -- and must be an
// external file, not inline, so it can run under a CSP with no 'unsafe-inline' in script-src.
(function () {
  var p = new URLSearchParams(location.search);
  if (!p.has("p")) return;
  var path = p.get("p") || "/";
  var query = p.get("q") ? "?" + p.get("q") : "";
  history.replaceState(null, "", location.pathname.replace(/\/$/, "") + path + query + location.hash);
})();
