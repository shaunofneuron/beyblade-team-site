const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const L = require("../assets/ladder-engine.js");

function runPage(payload) {
  const root = { innerHTML: "" }, calls = [];
  const ctx = {
    window: { ZEN_FORM_CONFIG: { webAppUrl: "https://example.invalid/exec" } },
    document: { getElementById: (id) => (id === "ladder-root" ? root : null) },
    fetch: (url, opts) => { calls.push([url, opts]); return Promise.resolve({ json: () => payload }); },
  };
  vm.runInNewContext(fs.readFileSync(__dirname + "/../assets/ladder.js", "utf8"), ctx);
  return new Promise((r) => setTimeout(() => r({ root, calls }), 10));
}

test("public ladder page renders standings, byes and finals read-only via GET", async () => {
  const s = L.newState();
  L.sync(s, "ABCDE".split("").map((c) => ({ id: c, nickname: "<b>" + c, team: "T" })));
  L.newRound(s); L.openMatches(s).forEach((m) => L.report(s, m.id, 5, 1));
  const { root, calls } = await runPage({ ok: true, ladder: L.publicView(s) });
  assert.match(root.innerHTML, /Swiss standings/);
  assert.match(root.innerHTML, /Bye:/);
  assert.ok(!root.innerHTML.includes("<b>A"), "nicknames are escaped");
  assert.equal(calls.length, 1); assert.equal(calls[0][1].method, "GET");
});

test("public ladder page shows not-published when backend lacks the ladder action", async () => {
  const { root } = await runPage({ ok: false, error: "unknown_action" });
  assert.match(root.innerHTML, /not published yet/);
});
