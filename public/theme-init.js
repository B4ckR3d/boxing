// Restores the saved theme before first paint to prevent a flash of the wrong theme.
// Loaded as a static file so it stays CSP-compliant (script-src 'self') without inline JS.
(function () {
  try {
    var saved = localStorage.getItem("tfn_theme");
    var theme = saved === "light" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
  } catch {
    // storage unavailable — default theme stays
  }
})();
