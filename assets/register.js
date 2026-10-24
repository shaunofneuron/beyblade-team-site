(function () {
  var cfg = window.ZEN_FORM_CONFIG || {};
  var url = (cfg.webAppUrl || "").trim();
  var form = document.getElementById("zen-reg");
  var statusEl = document.getElementById("zen-reg-status");
  var missing = document.getElementById("reg-config-missing");
  var teamSelect = document.getElementById("team-select");
  var ageSelect = document.getElementById("age-select");
  var newTeamInput = document.getElementById("new-team");
  var addTeamBtn = document.getElementById("add-team-btn");
  var maxPerTeam = 3;

  function loadRoster() {
    if (window.ZenRoster) window.ZenRoster.render(url);
  }

  function fillSelect(select, values, placeholder) {
    var cur = select.value;
    select.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder || "Select…";
    select.appendChild(ph);
    (values || []).forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    if (cur && values.indexOf(cur) !== -1) select.value = cur;
    else if (values.length === 1) select.value = values[0];
  }

  function addTeamToSelect(name) {
    name = String(name || "").trim();
    if (!name) return;
    var exists = Array.prototype.some.call(teamSelect.options, function (o) {
      return o.value.toLowerCase() === name.toLowerCase();
    });
    if (!exists) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      teamSelect.appendChild(opt);
    }
    teamSelect.value = name;
    newTeamInput.value = "";
  }

  function loadOptions() {
    return fetch(url + "?action=options", { method: "GET", redirect: "follow" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) throw new Error("options_failed");
        maxPerTeam = data.maxPerTeam || 3;
        fillSelect(ageSelect, data.ageBrackets || ["7 to 10"], "Select age bracket");
        fillSelect(teamSelect, data.teams || ["Zen Blitz"], "Select team");
      })
      .catch(function () {
        fillSelect(ageSelect, ["7 to 10"], "Select age bracket");
        fillSelect(teamSelect, ["Zen Blitz"], "Select team");
      });
  }

  if (!url) {
    if (missing) missing.hidden = false;
    if (form) form.querySelectorAll("input,textarea,button,select").forEach(function (el) { el.disabled = true; });
    loadRoster();
    return;
  }

  if (addTeamBtn) {
    addTeamBtn.addEventListener("click", function () {
      addTeamToSelect(newTeamInput.value);
      statusEl.textContent = teamSelect.value
        ? "Team selected. It will be saved on submit (or add it on the Teams sheet anytime)."
        : "Enter a team name first.";
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    statusEl.textContent = "Sending…";
    var fd = new FormData(form);
    var team = String(fd.get("team") || "").trim();
    if (!team && newTeamInput && newTeamInput.value.trim()) {
      addTeamToSelect(newTeamInput.value);
      team = teamSelect.value;
    }
    var payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      nickname: String(fd.get("nickname") || "").trim(),
      team: team,
      ageBracket: String(fd.get("ageBracket") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      website: String(fd.get("website") || "")
    };
    if (!payload.ageBracket) {
      statusEl.textContent = "Pick an age bracket.";
      return;
    }
    if (!payload.team) {
      statusEl.textContent = "Pick or add a team.";
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok) {
          statusEl.textContent = "Thanks — you’re registered.";
          form.reset();
          loadOptions().then(loadRoster);
          return;
        }
        var err = (data && data.error) || "unknown_error";
        if (err === "duplicate_email") statusEl.textContent = "That email is already registered.";
        else if (err === "team_full")
          statusEl.textContent = "That team already has " + (data.max || maxPerTeam) + " players. Pick or add another team.";
        else if (err === "invalid_age_bracket")
          statusEl.textContent = "That age bracket isn’t available. Pick one from the list.";
        else if (err.indexOf("missing_") === 0 || err === "invalid_email" || err === "invalid_nickname" || err === "invalid_team")
          statusEl.textContent = "Please check the required fields.";
        else if (err === "honeypot_triggered" || err === "spam_pattern" || err === "too_many_urls")
          statusEl.textContent = "Submission blocked. Try again with a normal message.";
        else statusEl.textContent = "Could not submit (" + err + ").";
      })
      .catch(function () {
        statusEl.textContent = "Network error — try again.";
      });
  });

  loadOptions().then(loadRoster);
})();
