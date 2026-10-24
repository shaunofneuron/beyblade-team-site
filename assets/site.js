(function () {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function applySite(data) {
    if (!data || !data.ok) return;
    var facts = data.facts || {};
    var expect = data.expect || [];
    document.querySelectorAll("[data-site]").forEach(function (el) {
      var key = el.getAttribute("data-site");
      if (!key) return;
      if (key === "expect") {
        if (el.tagName === "UL" || el.tagName === "OL") {
          el.innerHTML = expect.map(function (line) {
            return "<li>" + esc(line) + "</li>";
          }).join("");
        } else {
          el.textContent = expect.join(" · ");
        }
        return;
      }
      var val = facts[key];
      if (val == null || val === "") return;
      el.innerHTML = esc(val);
    });
  }

  function load() {
    var cfg = window.ZEN_FORM_CONFIG || {};
    var url = (cfg.webAppUrl || "").trim();
    if (!url) return Promise.resolve();
    return fetch(url + "?action=site", { method: "GET", redirect: "follow" })
      .then(function (res) { return res.json(); })
      .then(applySite)
      .catch(function () { /* keep static fallbacks in HTML */ });
  }

  window.ZenSite = { load: load, apply: applySite };
  if (document.querySelector("[data-site]")) {
    load();
  }
})();
