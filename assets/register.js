(function () {
  var cfg = window.ZEN_FORM_CONFIG || {};
  var url = (cfg.webAppUrl || "").trim();
  var form = document.getElementById("zen-reg");
  var statusEl = document.getElementById("zen-reg-status");
  var missing = document.getElementById("reg-config-missing");

  function loadRoster() {
    if (window.ZenRoster) window.ZenRoster.render(url);
  }

  if (!url) {
    if (missing) missing.hidden = false;
    if (form) form.querySelectorAll("input,textarea,button").forEach(function (el) { el.disabled = true; });
    loadRoster();
    return;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    statusEl.textContent = "Sending…";
    var fd = new FormData(form);
    var payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      nickname: String(fd.get("nickname") || "").trim(),
      team: String(fd.get("team") || "Zen Blitz").trim(),
      ageBracket: String(fd.get("ageBracket") || "TBD").trim(),
      message: String(fd.get("message") || "").trim(),
      website: String(fd.get("website") || "")
    };
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
          if (form.team) form.team.value = "Zen Blitz";
          loadRoster();
          return;
        }
        var err = (data && data.error) || "unknown_error";
        if (err === "duplicate_email") statusEl.textContent = "That email is already registered.";
        else if (err.indexOf("missing_") === 0 || err === "invalid_email" || err === "invalid_nickname")
          statusEl.textContent = "Please check the required fields.";
        else if (err === "honeypot_triggered" || err === "spam_pattern" || err === "too_many_urls")
          statusEl.textContent = "Submission blocked. Try again with a normal message.";
        else statusEl.textContent = "Could not submit (" + err + ").";
      })
      .catch(function () {
        statusEl.textContent = "Network error — try again.";
      });
  });

  loadRoster();
})();
