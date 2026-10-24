(function () {
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function displayAge(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s || s === "TBD") return "TBD";
    var m = s.match(/^(\d{1,2})\s*[-–/]\s*(\d{1,2})$/);
    if (m) return m[1] + " to " + m[2];
    return s;
  }

  function groupByTeam(entries) {
    var map = {};
    (entries || []).forEach(function (e) {
      var team = String(e.team || "Zen Blitz").trim() || "Zen Blitz";
      if (!map[team]) map[team] = [];
      map[team].push(e);
    });
    return Object.keys(map).sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    }).map(function (team) {
      var players = map[team].slice().sort(function (a, b) {
        return String(a.nickname || "").toLowerCase()
          .localeCompare(String(b.nickname || "").toLowerCase());
      });
      return { team: team, players: players };
    });
  }

  function render(webAppUrl) {
    var root = document.getElementById("roster-root") || document.getElementById("roster-body");
    if (!root) return;
    if (!webAppUrl) {
      root.innerHTML = '<p class="tbd">Roster endpoint not configured.</p>';
      return;
    }
    fetch(webAppUrl + "?action=roster", { method: "GET", redirect: "follow" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) {
          root.innerHTML = '<p class="tbd">Could not load roster.</p>';
          return;
        }
        var groups = groupByTeam(data.entries || []);
        if (!groups.length) {
          root.innerHTML = '<p class="tbd">No nicknames published yet.</p>';
          return;
        }
        root.innerHTML = groups.map(function (g) {
          var rows = g.players.map(function (e, i) {
            return "<tr><td>" + (i + 1) + "</td><td>" + esc(e.nickname) +
              "</td><td>" + esc(displayAge(e.ageBracket)) + "</td></tr>";
          }).join("");
          return '<section class="card roster-team">' +
            "<h2>" + esc(g.team) + "</h2>" +
            "<table><thead><tr><th>#</th><th>Nickname</th><th>Age Bracket</th></tr></thead>" +
            "<tbody>" + rows + "</tbody></table></section>";
        }).join("");
      })
      .catch(function () {
        root.innerHTML = '<p class="tbd">Network error loading roster.</p>';
      });
  }

  window.ZenRoster = { render: render };

  var cfg = window.ZEN_FORM_CONFIG || {};
  if ((document.getElementById("roster-root") || document.getElementById("roster-body")) &&
      !document.getElementById("zen-reg")) {
    render((cfg.webAppUrl || "").trim());
  }
})();
