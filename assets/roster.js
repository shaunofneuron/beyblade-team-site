(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(webAppUrl) {
    var body = document.getElementById("roster-body");
    var countEl = document.getElementById("roster-count");
    if (!body) return;
    if (!webAppUrl) {
      body.innerHTML = '<tr><td colspan="4" class="tbd">Roster endpoint not configured.</td></tr>';
      if (countEl) countEl.textContent = "";
      return;
    }
    fetch(webAppUrl + "?action=roster", { method: "GET", redirect: "follow" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) {
          body.innerHTML = '<tr><td colspan="4" class="tbd">Could not load roster.</td></tr>';
          return;
        }
        var entries = data.entries || [];
        if (countEl) {
          countEl.textContent = entries.length
            ? entries.length + " on the public roster (" + (data.registrations || entries.length) + " registration rows)."
            : "No public nicknames yet. Register with a player nickname to appear here.";
        }
        if (!entries.length) {
          body.innerHTML = '<tr><td colspan="4" class="tbd">No nicknames published yet.</td></tr>';
          return;
        }
        body.innerHTML = entries.map(function (e, i) {
          return "<tr><td>" + (i + 1) + "</td><td>" + esc(e.nickname) + "</td><td>" +
            esc(e.team || "Zen Blitz") + "</td><td>" + esc(e.ageBracket || "TBD") + "</td></tr>";
        }).join("");
      })
      .catch(function () {
        body.innerHTML = '<tr><td colspan="4" class="tbd">Network error loading roster.</td></tr>';
      });
  }

  window.ZenRoster = { render: render };

  var cfg = window.ZEN_FORM_CONFIG || {};
  if (document.getElementById("roster-body") && !(document.getElementById("zen-reg"))) {
    render((cfg.webAppUrl || "").trim());
  }
})();
