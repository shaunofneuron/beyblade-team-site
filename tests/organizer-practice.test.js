const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");

function page() {
  const els = {}, store = {}, fetches = [];
  const el = (id) => (els[id] ||= { id, innerHTML: "", textContent: "", hidden: false, value: "", handlers: {},
    addEventListener(t, f) { this.handlers[t] = f; } });
  const ctx = {
    window: { ZEN_FORM_CONFIG: { webAppUrl: "https://example.invalid/exec" }, confirm: () => true, prompt: () => "" },
    document: { getElementById: el, body: { classList: { toggle() {} } } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    fetch: (...a) => { fetches.push(a); return new Promise(() => {}); },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../assets/ladder-engine.js", "utf8"), ctx);
  ctx.window.ZenLadder = ctx.ZenLadder;
  vm.runInContext(fs.readFileSync(__dirname + "/../assets/organizer.js", "utf8"), ctx);
  const click = (attrs) => els["org-root"].handlers.click({ target: { closest: () => ({ getAttribute: (k) => attrs[k.replace("data-", "")] ?? null }) } });
  const state = () => JSON.parse(store.zbPracticeState || "null");
  return { els, store, fetches, click, state };
}

test("practice run goes from Swiss to champion with no network calls, then deletes cleanly", () => {
  const p = page();
  p.els["org-practice-start"].handlers.click();
  assert.equal(p.els["org-practice-banner"].hidden, false);
  for (let r = 0; r < 3; r++) {
    p.click({ op: "newRound" });
    for (const m of p.state().swiss.rounds.at(-1).matches) p.click({ op: "win", id: m.id, pid: m.a });
  }
  let guard = 0;
  while (guard++ < 3 && p.state().swiss.supplemental.length + 1 && /Add extra/.test(p.els["org-root"].innerHTML)) {
    const before = p.state().swiss.supplemental.length; p.click({ op: "supplemental" });
    const added = p.state().swiss.supplemental.slice(before); if (!added.length) break;
    for (const m of added) p.click({ op: "win", id: m.id, pid: m.b });
  }
  p.click({ op: "seedFinals" });
  assert.equal(p.state().finals, null, "top cut 0 refused");
  p.els["org-cut"].value = "4";
  p.click({ op: "seedFinals" });
  assert.ok(p.state().finals, p.els["org-msg"].textContent);
  for (let i = 0; i < 5 && !p.state().finals.champion; i++) {
    const open = p.state().finals.rounds.at(-1).filter((m) => !m.winner);
    for (const m of open) p.click({ op: "win", id: m.id, pid: m.a });
  }
  const champ = p.state().finals.champion;
  assert.ok(champ);
  const lastFinal = p.state().finals.rounds.at(-1)[0].id;
  p.click({ op: "undo", id: lastFinal });
  assert.equal(p.state().finals.champion, null);
  assert.equal(p.fetches.length, 0, "practice never calls the backend");
  p.els["org-practice-delete"].handlers.click();
  assert.equal(p.state(), null);
  assert.equal(p.els["org-practice-banner"].hidden, true);
  assert.equal(p.fetches.length, 0, "no key stored, so returning to real mode makes no call");
});

test("real mode sends winner taps to the backend with the remembered key", () => {
  const p = page();
  p.store.zbOrgToken = "k";
  p.click({ op: "win", id: "S1", pid: "P001" });
  const body = JSON.parse(p.fetches.at(-1)[1].body);
  assert.deepEqual([body.op, body.args.id, body.args.pid, body.token], ["win", "S1", "P001", "k"]);
});
