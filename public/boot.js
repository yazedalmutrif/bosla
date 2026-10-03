// Runs before first paint: set language, direction and theme so there is no flash.
(function () {
  var d = document.documentElement;
  var get = function (k) {
    try {
      return localStorage.getItem("bosla." + k);
    } catch {
      return null;
    }
  };
  var q = new URLSearchParams(location.search).get("lang");
  var lang = q === "ar" || q === "en" ? q : get("lang") || "ar";
  d.lang = lang;
  d.dir = lang === "ar" ? "rtl" : "ltr";
  var theme = get("theme");
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  d.dataset.theme = theme;
  d.style.colorScheme = theme;
  // The prerendered HTML is the Arabic landing page: hide it on other pages or in English until React renders.
  if (location.pathname !== "/" || lang !== "ar") d.classList.add("no-prerender");
})();
