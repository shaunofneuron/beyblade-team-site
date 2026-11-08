(function () {
  var L = window.ZenLadder;
  var url = window.ZEN_FORM_CONFIG && window.ZEN_FORM_CONFIG.webAppUrl;
  var root = document.getElementById("org-root"), msg = document.getElementById("org-msg");
  var banner = document.getElementById("org-practice-banner"), tokenInput = document.getElementById("org-token");
  var KEY = "zbOrgToken", PRACTICE = "zbPracticeState";
  var rev = 0, practice = false, lastOp = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function say(t) { msg.textContent = t; }

  // Practice runs the same engine entirely in this browser. Nothing is sent to the server.
  function practiceState() {
    var raw = localStorage.getItem(PRACTICE);
    if (raw) return JSON.parse(raw);
    var s = L.newState();
    L.sync(s, ["Practice Pegasus", "Practice Dran", "Practice Wizard", "Practice Knight", "Practice Shark",
      "Practice Phoenix", "Practice Leon"].map(function (n, i) { return { id: "practice-" + i, nickname: n, team: "Practice" }; }));
    return s;
  }
  var practiceOps = {
    sync: function () { return null; },
    win: function (s, a) { return L.reportWinner(s, a.id, a.pid).id; },
    undo: function (s, a) { return L.undo(s, a.id).id; },
    report: function (s, a) { return L.report(s, a.id, a.sa, a.sb).id; },
    newRound: function (s) { return L.newRound(s).n; },
    supplemental: function (s) { return L.supplemental(s).length; },
    seedFinals: function (s, a) { return L.seedFinals(s, Number(a.topCut), a.override || null).seeds.length; },
    withdraw: function (s, a) { L.withdraw(s, a.pid); }, reinstate: function (s, a) { L.reinstate(s, a.pid); },
    rename: function (s, a) { L.rename(s, a.pid, a.name); }, view: function () { return null; }
  };
  function callPractice(op, args) {
    var s = practiceState();
    try {
      practiceOps[op](s, args || {});
      s.rev = (s.rev || 0) + 1;
      localStorage.setItem(PRACTICE, JSON.stringify(s));
      say(op === "view" ? "Practice loaded." : "Saved (practice only).");
    } catch (e) { say("Not saved: " + (e.message || e)); }
    draw(L.adminView(s));
  }

  function call(op, args) {
    if (practice) return callPractice(op, args);
    lastOp = [op, args];
    say("Saving…");
    return fetch(url, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "ladderAdmin", token: localStorage.getItem(KEY) || "", rev: rev, op: op, args: args || {} }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.admin) { rev = d.admin.rev; draw(d.admin); }
        if (!d.ok && /stale/.test(d.error || "")) { say("Someone else saved first. The page is refreshed; tap again."); return; }
        if (!d.ok) { say(d.error === "unauthorized" ? "Key not accepted. Tap Forget key and enter it again." : "Not saved: " + (d.error || "error")); return; }
        say(op === "view" ? "Loaded." : "Saved.");
      })
      .catch(function () { say("Network error. Nothing was saved; tap again."); });
  }

  function draw(v) {
    var h = '<section class="card"><h2>Tap the winner</h2>';
    h += v.open.length ? v.open.map(function (m) {
      return '<div class="org-match" data-id="' + esc(m.id) + '"><p class="note">' + esc(m.id) + " · first to " + esc(m.to) + "</p>" +
        '<button class="org-win" data-op="win" data-id="' + esc(m.id) + '" data-pid="' + esc(m.a) + '">' + esc(m.aName) + "</button> " +
        '<button class="org-win" data-op="win" data-id="' + esc(m.id) + '" data-pid="' + esc(m.b) + '">' + esc(m.bName) + "</button>" +
        '<details><summary>Enter exact score (optional)</summary><form class="org-score" data-id="' + esc(m.id) + '">' +
        esc(m.aName) + ' <input name="sa" type="number" min="0" style="width:4em"> ' +
        esc(m.bName) + ' <input name="sb" type="number" min="0" style="width:4em"> <button>Save score</button></form></details></div>';
    }).join("") : '<p class="tbd">No open matches.</p>';
    h += '<p class="note">A winner tap saves right away with no score recorded. Use "Enter exact score" only if you want the points.</p></section>';
    if (v.undoable.length) h += '<section class="card"><h2>Fix a mistake</h2>' + v.undoable.map(function (u) {
      return '<p>' + esc(u.id) + ": " + esc(u.winner) + " beat " + esc(u.loser) + ' <button data-op="undo" data-id="' + esc(u.id) + '">Undo</button></p>';
    }).join("") + '<p class="note">Undo works until the next round that depends on it starts.</p></section>';
    if (v.finals && v.finals.champion) h += '<section class="card"><h2>🏆 Champion: ' + esc(v.finals.champion) + "</h2></section>";
    h += '<section class="card"><h2>Round controls</h2><p class="note">Suggested: ' + esc(v.suggest.swissRounds) +
      " Swiss rounds, top " + esc(v.suggest.topCut) + " (" + esc(v.suggest.note) + ").</p>" +
      (practice ? "" : '<button data-op="sync">Refresh names from sheet</button> ') +
      '<button data-op="newRound">Create next Swiss round</button> <button data-op="supplemental">Add extra qualifying bouts</button> ' +
      'Top cut <input id="org-cut" type="number" min="2" value="' + esc(v.suggest.topCut) + '" style="width:4em"> ' +
      '<button data-op="seedFinals">Seed finals (locks Swiss)</button></section>';
    h += '<section class="card"><h2>Standings</h2><table class="ladder-table">' + v.standings.map(function (s) {
      return "<tr><td>" + s.rank + "</td><td>" + esc(s.name) + "</td><td>" + esc(s.team) + "</td><td>" + s.wins + "W</td><td>" + s.bouts + " bouts</td></tr>";
    }).join("") + "</table></section>";
    h += '<section class="card"><h2>Players</h2><table class="ladder-table">' + v.players.map(function (p) {
      return "<tr><td>" + esc(p.name) + (p.nameLock ? " 🔒" : "") + "</td><td>" + esc(p.team) + "</td><td>" + esc(p.status) +
        '</td><td><button data-op="' + (p.status === "withdrawn" ? "reinstate" : "withdraw") + '" data-pid="' + esc(p.pid) + '">' +
        (p.status === "withdrawn" ? "Reinstate" : "Withdraw") + "</button></td></tr>";
    }).join("") + "</table></section>";
    root.innerHTML = h;
  }

  function setPractice(on) {
    practice = on;
    banner.hidden = !on;
    document.getElementById("org-practice-start").hidden = on;
    document.body.classList.toggle("practice", on);
    if (on) callPractice("view");
    else if (localStorage.getItem(KEY)) call("view");
    else { root.innerHTML = ""; say("Enter the organizer key."); }
  }

  document.getElementById("org-login").addEventListener("submit", function (e) {
    e.preventDefault(); localStorage.setItem(KEY, tokenInput.value); tokenInput.value = ""; setPractice(false);
  });
  document.getElementById("org-forget").addEventListener("click", function () {
    localStorage.removeItem(KEY); root.innerHTML = ""; say("Key forgotten on this device.");
  });
  document.getElementById("org-practice-start").addEventListener("click", function () { setPractice(true); });
  document.getElementById("org-practice-exit").addEventListener("click", function () { setPractice(false); });
  document.getElementById("org-practice-delete").addEventListener("click", function () {
    if (!window.confirm("Delete the practice run? The real tournament is not affected.")) return;
    localStorage.removeItem(PRACTICE); setPractice(false); say("Practice deleted. Back to the real tournament.");
  });
  root.addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target;
    call("report", { id: f.getAttribute("data-id"), sa: f.sa.value, sb: f.sb.value });
  });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-op]"); if (!b) return;
    var op = b.getAttribute("data-op"), pid = b.getAttribute("data-pid"), id = b.getAttribute("data-id");
    if (op === "win") return call(op, { id: id, pid: pid });
    if (op === "undo") return call(op, { id: id });
    if (op === "seedFinals") {
      var ov = window.prompt("Override reason (leave blank unless skipping the minimum-bouts check):", "") || null;
      if (!window.confirm("Seeding finals locks Swiss results. Continue?")) return;
      return call(op, { topCut: document.getElementById("org-cut").value, override: ov });
    }
    if (op === "withdraw" && !window.confirm("Withdraw this player? Their results stay.")) return;
    call(op, pid ? { pid: pid } : {});
  });

  if (!url) { say("Endpoint not configured. Practice still works."); }
  setPractice(false);
})();
