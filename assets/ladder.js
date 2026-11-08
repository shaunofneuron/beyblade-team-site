(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function matchRow(m) {
    var score = m.winner ? (m.scoreKnown === false || m.sa == null ? "won" : esc(m.sa) + "–" + esc(m.sb)) : "vs";
    var a = m.winner && m.winner === m.a ? "<strong>" + esc(m.a) + "</strong>" : esc(m.a);
    var b = m.b == null ? "<em>bye</em>" : (m.winner && m.winner === m.b ? "<strong>" + esc(m.b) + "</strong>" : esc(m.b));
    return "<tr><td>" + a + "</td><td>" + score + "</td><td>" + b + "</td></tr>";
  }
  function table(rows) { return '<table class="ladder-table"><tbody>' + rows + "</tbody></table>"; }
  function render(root, v) {
    var html = "";
    if (v.finals) {
      html += '<section class="card"><h2>Finals (first to ' + esc(v.finalsTo) + ")</h2>";
      if (v.finals.champion) html += '<p class="champion">🏆 Champion: <strong>' + esc(v.finals.champion) + "</strong></p>";
      v.finals.rounds.forEach(function (r, i) {
        html += "<h3>" + (r.length === 1 ? "Final" : "Round " + (i + 1)) + "</h3>" + table(r.map(matchRow).join(""));
      });
      html += "</section>";
    }
    html += '<section class="card"><h2>Swiss standings</h2>';
    html += v.standings.length ? table("<tr><th>#</th><th>Blader</th><th>Team</th><th>W</th><th>Bouts</th><th>+/-</th></tr>" +
      v.standings.map(function (s) {
        return "<tr><td>" + s.rank + "</td><td>" + esc(s.name) + (s.status === "withdrawn" ? " <em>(withdrawn)</em>" : "") +
          "</td><td>" + esc(s.team) + "</td><td>" + s.wins + "</td><td>" + s.bouts + "</td><td>" + s.diff + "</td></tr>";
      }).join("")) : '<p class="tbd">Bracket starts at the event.</p>';
    html += "</section>";
    v.rounds.slice().reverse().forEach(function (r) {
      html += '<section class="card"><h2>Swiss round ' + r.n + " (first to " + esc(v.swissTo) + ")</h2>" +
        table(r.matches.map(matchRow).join("")) +
        (r.byes.length ? '<p class="note">Bye: ' + r.byes.map(esc).join(", ") + " (a bye is not a bout or a win)</p>" : "") + "</section>";
    });
    if (v.supplemental.length) html += '<section class="card"><h2>Extra qualifying bouts</h2>' + table(v.supplemental.map(matchRow).join("")) + "</section>";
    root.innerHTML = html;
  }
  var root = document.getElementById("ladder-root");
  var url = window.ZEN_FORM_CONFIG && window.ZEN_FORM_CONFIG.webAppUrl;
  if (!root) return;
  if (!url) { root.innerHTML = '<p class="tbd">Ladder endpoint not configured.</p>'; return; }
  fetch(url + "?action=ladder", { method: "GET", redirect: "follow" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.ok || !d.ladder) { root.innerHTML = '<p class="tbd">Ladder not published yet.</p>'; return; }
      render(root, d.ladder);
    })
    .catch(function () { root.innerHTML = '<p class="tbd">Ladder not published yet.</p>'; });
})();
