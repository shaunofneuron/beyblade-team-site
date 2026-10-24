(function () {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderRules(payload) {
    var rows = payload.rows || [];
    var order = payload.sectionOrder || [];
    var sections = {};
    rows.forEach(function (r) {
      (sections[r.section] || (sections[r.section] = [])).push(r);
    });
    var ordered = [];
    order.forEach(function (s) { if (sections[s]) ordered.push([s, sections[s]]); });
    Object.keys(sections).forEach(function (s) {
      if (order.indexOf(s) === -1) ordered.push([s, sections[s]]);
    });
    var parts = [];
    ordered.forEach(function (pair) {
      var sec = pair[0];
      var items = pair[1].slice().sort(function (a, b) {
        if (a.subsection !== b.subsection) return a.subsection < b.subsection ? -1 : 1;
        return (a.line || 0) - (b.line || 0);
      });
      if (sec === "intro") {
        items.forEach(function (r) {
          if (r.kind === "title") parts.push("<h1>" + esc(r.text) + "</h1>");
          else if (r.kind === "note") parts.push('<p class="note">' + esc(r.text) + "</p>");
        });
      } else if (sec === "decks" || sec === "scoring" || sec === "launching") {
        var inner = [];
        var bullets = [];
        function flush() {
          if (bullets.length) {
            inner.push('<ul class="plain">' + bullets.join("") + "</ul>");
            bullets = [];
          }
        }
        items.forEach(function (r) {
          if (r.kind === "heading") {
            flush();
            inner.push("<h2>" + esc(r.text) + "</h2>");
          } else if (r.kind === "paragraph") {
            flush();
            inner.push("<p>" + esc(r.text) + "</p>");
          } else if (r.kind === "paragraph_html") {
            flush();
            inner.push("<p>" + r.text + "</p>");
          } else if (r.kind === "bullet") {
            if (r.label) bullets.push("<li><strong>" + esc(r.label) + "</strong> " + esc(r.text) + "</li>");
            else bullets.push("<li>" + esc(r.text) + "</li>");
          }
        });
        flush();
        parts.push('<section class="card">\n    ' + inner.join("\n    ") + "\n  </section>");
      } else if (sec === "more") {
        var bits = [];
        items.forEach(function (r) {
          if (r.kind === "span") bits.push(esc(r.text));
          else if (r.kind === "link") bits.push('<a href="' + esc(r.url) + '">' + esc(r.text) + "</a>");
        });
        parts.push("<p>" + bits.join("") + "</p>");
      }
    });
    return parts.join("\n\n  ");
  }

  function renderLinks(payload) {
    var title = "";
    var items = [];
    (payload.rows || []).slice().sort(function (a, b) { return (a.line || 0) - (b.line || 0); })
      .forEach(function (r) {
        if (r.kind === "title") title = "<h1>" + esc(r.text) + "</h1>";
        else if (r.kind === "link_item") {
          items.push('<li><a href="' + esc(r.url) + '">' + esc(r.text) + "</a></li>");
        }
      });
    return title + '\n  <ul class="card links">\n    ' + items.join("\n    ") + "\n  </ul>";
  }

  function render(page, payload) {
    if (page === "rules") return renderRules(payload);
    if (page === "links") return renderLinks(payload);
    return null;
  }

  function boot() {
    var root = document.getElementById("copy-root");
    if (!root) return;
    var page = (root.getAttribute("data-page") || "").toLowerCase();
    var cfg = window.ZEN_FORM_CONFIG || {};
    var url = (cfg.webAppUrl || "").trim();
    if (!page || !url) return;
    fetch(url + "?action=page&name=" + encodeURIComponent(page), { method: "GET", redirect: "follow" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) return;
        var html = render(page, data);
        if (html == null) return; // unsupported page — keep static
        root.innerHTML = html;
      })
      .catch(function () { /* keep static fallback */ });
  }

  window.ZenPageCopy = { render: render, boot: boot };
  boot();
})();
