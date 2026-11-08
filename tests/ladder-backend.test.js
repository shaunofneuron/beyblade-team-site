const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

function backend(entries) {
  const tabs = {};
  const sheet = (name) => ({
    name, rows: [],
    getLastRow() { return this.rows.length; },
    getRange(r, c, n) {
      const sh = this;
      return {
        getValues: () => sh.rows.slice(r - 1, r - 1 + n).map((v) => [v]),
        setValues: (vals) => vals.forEach((v, i) => { sh.rows[r - 1 + i] = v[0]; }),
        clearContent: () => { sh.rows.length = r - 1; },
      };
    },
  });
  const ctx = {
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => tabs[n] || null, insertSheet: (n) => (tabs[n] = sheet(n)) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "fixture-key" }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 1 }, computeDigest: (_, s) => crypto.createHash("sha256").update(s).digest(),
      base64Encode: (b) => Buffer.from(b).toString("base64") },
    ContentService: { MimeType: { JSON: 1 }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
    ladderSourceEntries_: () => entries,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../assets/ladder-engine.js", "utf8"), ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../backend/LadderApi.gs.template", "utf8"), ctx);
  ctx.tabs = tabs;
  return ctx;
}
const players = "ABCD".split("").map((c) => ({ id: "reg-" + c, nickname: "Nick" + c, privateName: "Secret Real " + c, team: "T" }));
const admin = (b, op, args, rev) => b.ladderAdmin_({ token: "fixture-key", op, args, rev });

test("rejects missing or wrong organizer key without saving", () => {
  const b = backend(players);
  assert.equal(b.ladderAdmin_({ token: "nope", op: "sync", rev: 0 }).error, "unauthorized");
  assert.equal(b.tabs.LadderState, undefined);
});

test("organizer results persist across reloads and appear in public view", () => {
  const b = backend(players);
  let r = admin(b, "sync", {}, 0); assert.ok(r.ok);
  r = admin(b, "newRound", {}, r.admin.rev);
  const m = r.admin.open[0];
  r = admin(b, "report", { id: m.id, sa: 5, sb: 3 }, r.admin.rev); assert.ok(r.ok, r.error);
  const pub = b.ladderPublic_().ladder;
  assert.equal(pub.rounds[0].matches[0].winner, "NickA");
  assert.ok(b.tabs.LadderStateBackup.rows.length > 0, "previous state backed up");
});

test("stale revision is refused and does not overwrite newer results", () => {
  const b = backend(players);
  let r = admin(b, "sync", {}, 0); r = admin(b, "newRound", {}, r.admin.rev);
  const staleRev = r.admin.rev, id = r.admin.open[0].id;
  admin(b, "report", { id, sa: 5, sb: 1 }, staleRev);
  const again = admin(b, "withdraw", { pid: "P002" }, staleRev);
  assert.match(again.error, /stale/);
  assert.equal(b.ladderPublic_().ladder.rounds[0].matches[0].sa, 5);
});

test("public and admin responses never include private names or source ids", () => {
  const b = backend(players);
  const r = admin(b, "sync", {}, 0);
  const out = JSON.stringify(r) + JSON.stringify(b.ladderPublic_());
  assert.ok(!out.includes("Secret Real"), "private name leaked");
  assert.ok(!out.includes("reg-"), "source id leaked");
});
