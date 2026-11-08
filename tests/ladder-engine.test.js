const test = require("node:test");
const assert = require("node:assert");
const L = require("../assets/ladder-engine.js");

const E = (n, rid, team = "X") => ({ id: rid, nickname: n, team, ageBracket: "7 to 10" });
const play = (s, sa = 5, sb = 2) => L.openMatches(s).forEach(m => L.report(s, m.id, sa, sb));
const seeded = (ids) => { const s = L.newState(); L.sync(s, ids.split("").map(c => E(c, c))); return s; };

test("source reorder + rename keeps identity, order and results", () => {
  const s = seeded("ABCD"); L.newRound(s); play(s); const before = JSON.stringify(s.swiss);
  L.sync(s, [E("D", "D"), E("Cee", "C"), E("A", "A"), E("B", "B")]);
  assert.equal(s.participants.P003.name, "Cee");
  assert.equal(JSON.stringify(s.swiss), before);
  assert.deepEqual(s.order, ["P001", "P002", "P003", "P004"]);
});
test("repeat sync is idempotent", () => {
  const s = seeded("ABCD"); const a = JSON.stringify(s); L.sync(s, "ABCD".split("").map(c => E(c, c)));
  const b = JSON.parse(JSON.stringify(s)); delete b.lastSync; const a2 = JSON.parse(a); delete a2.lastSync;
  assert.deepEqual(b, a2);
});
test("append newcomer, missing entrant flagged not deleted", () => {
  const s = seeded("ABCD"); const r = L.sync(s, [E("A", "A"), E("B", "B"), E("C", "C"), E("N", "N")]);
  assert.deepEqual(r.added, ["P005"]); assert.equal(s.participants.P004.status, "missing");
});
test("entry without stable id goes to pending, never guessed; link maps it", () => {
  const s = seeded("AB"); const r = L.sync(s, [E("A", "A"), E("B", "B"), { nickname: "Z", team: "X" }]);
  assert.equal(Object.keys(s.participants).length, 2); assert.equal(s.pending.length, 1);
  L.link(s, s.pending[0].key, "new"); assert.equal(s.participants.P003.name, "Z");
});
test("manual rename locks name against sync", () => {
  const s = seeded("AB"); L.rename(s, "P001", "Ace"); L.sync(s, [E("A", "A"), E("B", "B")]);
  assert.equal(s.participants.P001.name, "Ace");
});
test("new round refused until previous complete; saved rounds frozen", () => {
  const s = seeded("ABCDE"); L.newRound(s); assert.throws(() => L.newRound(s), L.Refuse);
  play(s); const r1 = JSON.stringify(s.swiss.rounds[0]); L.newRound(s);
  assert.equal(JSON.stringify(s.swiss.rounds[0]), r1);
});
test("bye counts as neither bout nor win; no rematches; byes rotate", () => {
  const s = seeded("ABCDE"); for (let i = 0; i < 3; i++) { L.newRound(s); play(s); }
  const byes = s.swiss.rounds.flatMap(r => r.byes);
  const pairs = s.swiss.rounds.flatMap(r => r.matches.map(m => [m.a, m.b].sort().join()));
  assert.equal(new Set(pairs).size, pairs.length); assert.equal(new Set(byes).size, byes.length);
  const st = Object.fromEntries(L.standings(s).map(r => [r.pid, r]));
  assert.equal(st[byes[0]].bouts, 2);
});
test("five-point swiss score validation", () => {
  const s = seeded("ABCD"); L.newRound(s); const m = L.openMatches(s)[0];
  assert.throws(() => L.report(s, m.id, 4, 2), L.Refuse); assert.throws(() => L.report(s, m.id, 5, 5), L.Refuse);
  L.report(s, m.id, 6, 4);
});
test("finals need min bouts; supplemental bouts fill gap; override recorded", () => {
  const s = seeded("ABCDE"); L.newRound(s); play(s);
  assert.throws(() => L.seedFinals(s, 4), L.Refuse);
  for (let i = 0; i < 3 && L.standings(s).some(r => r.bouts < 2); i++) { assert.ok(L.supplemental(s).length); play(s); }
  assert.ok(L.standings(s).every(r => r.bouts >= 2));
  L.seedFinals(s, 4); assert.equal(s.finals.seeds.length, 4);
  const t = seeded("ABCDE"); L.newRound(t); play(t); L.seedFinals(t, 4, "short on time");
  assert.match(t.finals.override, /short on time/);
});
test("withdrawn not paired", () => {
  const s = seeded("ABCD"); L.withdraw(s, "P001"); L.newRound(s);
  const r = s.swiss.rounds[0]; assert.ok(![...r.matches.flatMap(m => [m.a, m.b]), ...r.byes].includes("P001"));
});
test("finals: 1v4 2v3, seven-point, advance without reshuffle, late entrant locked out", () => {
  const s = seeded("ABCDEF"); for (let i = 0; i < 3; i++) { L.newRound(s); play(s); }
  L.seedFinals(s, 4); const f = s.finals, sd = [...f.seeds];
  assert.deepEqual(f.rounds[0].map(m => [m.a, m.b]), [[sd[0], sd[3]], [sd[1], sd[2]]]);
  assert.throws(() => L.report(s, f.rounds[0][0].id, 5, 1), L.Refuse);
  f.rounds[0].slice().forEach(m => L.report(s, m.id, 2, 7));
  assert.deepEqual([f.rounds[1][0].a, f.rounds[1][0].b], [sd[3], sd[2]]);
  L.sync(s, "ABCDEFG".split("").map(c => E(c, c)));
  assert.equal(s.participants.P007.status, "late"); assert.deepEqual(f.seeds, sd);
  assert.throws(() => L.newRound(s), L.Refuse);
  L.report(s, f.rounds[1][0].id, 7, 3); assert.equal(f.champion, sd[3]);
});
test("public view exposes nickname/team only, no source keys", () => {
  const s = L.newState(); L.sync(s, [{ id: "h1", nickname: "", privateName: "Real Kid", team: "X" }, E("Nick", "h2")]);
  const v = JSON.stringify(L.publicView(s));
  assert.ok(!v.includes("Real Kid") && !v.includes("h1")); assert.match(v, /Blader 1/);
});

test("winner-only result records no fake score and counts as a win", () => {
  const s = seeded("ABCD"); L.newRound(s); const m = L.openMatches(s)[0];
  L.reportWinner(s, m.id, m.b);
  assert.equal(m.winner, m.b); assert.equal(m.sa, null); assert.equal(m.scoreKnown, false);
  const st = Object.fromEntries(L.standings(s).map(r => [r.pid, r]));
  assert.equal(st[m.b].wins, 1); assert.equal(st[m.a].bouts, 1);
});
test("undo swiss result allowed until next round exists", () => {
  const s = seeded("ABCD"); L.newRound(s); const m = L.openMatches(s)[0];
  L.reportWinner(s, m.id, m.a); assert.deepEqual(L.undoable(s), [m.id]);
  L.undo(s, m.id); assert.equal(m.winner, null);
  play(s); L.newRound(s); assert.throws(() => L.undo(s, s.swiss.rounds[0].matches[0].id), L.Refuse);
});
test("undo finals result removes unplayed next round only", () => {
  const s = seeded("ABCD"); for (let i = 0; i < 2; i++) { L.newRound(s); play(s); }
  for (let i = 0; i < 2 && L.standings(s).some(r => r.bouts < 2); i++) { L.supplemental(s); play(s); }
  L.seedFinals(s, 4); const f = s.finals, r0 = f.rounds[0];
  L.reportWinner(s, r0[0].id, r0[0].a); L.reportWinner(s, r0[1].id, r0[1].a);
  assert.equal(f.rounds.length, 2);
  L.undo(s, r0[1].id); assert.equal(f.rounds.length, 1); assert.equal(r0[1].winner, null);
  L.reportWinner(s, r0[1].id, r0[1].b); L.reportWinner(s, f.rounds[1][0].id, f.rounds[1][0].a);
  assert.throws(() => L.undo(s, r0[0].id), L.Refuse);
  L.undo(s, f.rounds[1][0].id); assert.equal(f.champion, null);
});
