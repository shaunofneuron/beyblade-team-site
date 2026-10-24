(function () {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function displayAge(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s || s === "TBD") return "";
    var m = s.match(/^(\d{1,2})\s*[-–/]\s*(\d{1,2})$/);
    if (m) return m[1] + " to " + m[2];
    return s;
  }

  function renderTeam(webAppUrl, teamName) {
    var root = document.getElementById("team-members");
    if (!root) return;
    var want = (teamName || "Zen Blitz").toLowerCase();
    fetch(webAppUrl + "?action=roster", { method: "GET", redirect: "follow" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) {
          root.innerHTML = '<p class="tbd">Could not load team roster.</p>';
          return;
        }
        var players = (data.entries || []).filter(function (e) {
          return String(e.team || "").trim().toLowerCase() === want;
        }).sort(function (a, b) {
          return String(a.nickname || "").toLowerCase()
            .localeCompare(String(b.nickname || "").toLowerCase());
        });
        if (!players.length) {
          root.innerHTML = '<p class="tbd">No registered players on this team yet.</p>';
          return;
        }
        root.innerHTML = '<div class="grid">' + players.map(function (e) {
          var age = displayAge(e.ageBracket);
          return '<article class="member"><h2>' + esc(e.nickname) + '</h2>' +
            '<p>Team ' + esc(e.team || teamName) +
            (age ? ' · ' + esc(age) : '') + '</p></article>';
        }).join("") + "</div>";
      })
      .catch(function () {
        root.innerHTML = '<p class="tbd">Network error loading team.</p>';
      });
  }

  var cfg = window.ZEN_FORM_CONFIG || {};
  var url = (cfg.webAppUrl || "").trim();
  var team = (document.body.getAttribute("data-team") || "Zen Blitz").trim();
  if (url && document.getElementById("team-members")) {
    renderTeam(url, team);
  }
})();
