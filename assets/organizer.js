(function () {
  var url = window.ZEN_FORM_CONFIG && window.ZEN_FORM_CONFIG.webAppUrl;
  var root = document.getElementById("org-root"), msg = document.getElementById("org-msg");
  var rev = 0, tokenInput = document.getElementById("org-token");
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function call(op, args) {
    var token = sessionStorage.getItem("zbOrgToken") || "";
    msg.textContent = "Working…";
    return fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "ladderAdmin", token: token, rev: rev, op: op, args: args || {} }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.admin) { rev = d.admin.rev; draw(d.admin); }
        if (!d.ok) { msg.textContent = "Not saved: " + (d.error || "error"); return; }
        msg.textContent = op === "view" ? "Loaded." : "Saved.";
      })
      .catch(function () { msg.textContent = "Network error. Nothing was saved."; });
  }
  function name(v, pid) { var p = v.players.filter(function (x) { return x.pid === pid; })[0]; return p ? p.name : pid; }
  function draw(v) {
    var h = '<section class="card"><h2>Matches to score</h2>';
    h += v.open.length ? v.open.map(function (m) {
      return '<form class="org-match" data-id="' + esc(m.id) + '"><strong>' + esc(m.id) + "</strong> " +
        '<label><input type="radio" name="w" value="a" required> ' + esc(name(v, m.a)) + "</label> " +
        '<label><input type="radio" name="w" value="b"> ' + esc(name(v, m.b)) + "</label> " +
        'winner score <input name="ws" type="number" min="' + m.to + '" value="' + m.to + '" style="width:4em"> ' +
        'loser score <input name="ls" type="number" min="0" max="' + (m.to - 1) + '" value="0" style="width:4em"> ' +
        "<button>Save result</button></form>";
    }).join("") : '<p class="tbd">No open matches.</p>';
    h += "</section>";
    h += '<section class="card"><h2>Round controls</h2><p class="note">Suggested: ' + esc(v.suggest.swissRounds) +
      " Swiss rounds, top " + esc(v.suggest.topCut) + " (" + esc(v.suggest.note) + ").</p>" +
      '<button data-op="sync">Refresh names from sheet</button> <button data-op="newRound">Create next Swiss round</button> ' +
      '<button data-op="supplemental">Add extra qualifying bouts</button> ' +
      'Top cut <input id="org-cut" type="number" min="2" value="' + esc(v.suggest.topCut) + '" style="width:4em"> ' +
      '<button data-op="seedFinals">Seed finals (locks Swiss)</button></section>';
    if (v.pending.length) h += '<section class="card"><h2>Needs identity check</h2>' + v.pending.map(function (p) {
      return "<p>" + esc(p.nickname) + ' <button data-op="link" data-key="' + esc(p.key) + '">Map…</button></p>';
    }).join("") + "</section>";
    h += '<section class="card"><h2>Players</h2><table class="ladder-table">' + v.players.map(function (p) {
      return "<tr><td>" + esc(p.pid) + "</td><td>" + esc(p.name) + (p.nameLock ? " 🔒" : "") + "</td><td>" + esc(p.team) +
        "</td><td>" + esc(p.status) + '</td><td><button data-op="rename" data-pid="' + esc(p.pid) + '">Rename</button> ' +
        '<button data-op="' + (p.status === "withdrawn" ? "reinstate" : "withdraw") + '" data-pid="' + esc(p.pid) + '">' +
        (p.status === "withdrawn" ? "Reinstate" : "Withdraw") + "</button></td></tr>";
    }).join("") + "</table></section>";
    root.innerHTML = h;
  }
  if (!url) { msg.textContent = "Endpoint not configured."; return; }
  document.getElementById("org-login").addEventListener("submit", function (e) {
    e.preventDefault(); sessionStorage.setItem("zbOrgToken", tokenInput.value); tokenInput.value = ""; call("view");
  });
  root.addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, aWon = f.w.value === "a";
    var ws = Number(f.ws.value), ls = Number(f.ls.value);
    call("report", { id: f.getAttribute("data-id"), sa: aWon ? ws : ls, sb: aWon ? ls : ws });
  });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-op]"); if (!b) return;
    var op = b.getAttribute("data-op"), pid = b.getAttribute("data-pid");
    if (op === "seedFinals") {
      var ov = window.prompt("Override reason (leave blank unless skipping the minimum-bouts check):", "") || null;
      if (!window.confirm("Seeding finals locks Swiss results. Continue?")) return;
      return call(op, { topCut: document.getElementById("org-cut").value, override: ov });
    }
    if (op === "rename") { var n = window.prompt("Display name (locks against sheet refresh):"); if (n) call(op, { pid: pid, name: n }); return; }
    if (op === "link") { var t = window.prompt("Existing player ID (e.g. P003) or 'new':"); if (t) call(op, { key: b.getAttribute("data-key"), pid: t }); return; }
    if (op === "withdraw" && !window.confirm("Withdraw " + pid + "? Results stay.")) return;
    call(op, pid ? { pid: pid } : {});
  });
})();
