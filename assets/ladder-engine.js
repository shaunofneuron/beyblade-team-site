/* Zen Blitz tournament engine: Swiss qualifying (5-point) then seeded single elimination (7-point).
   Pure functions over a JSON state. Shared by the Apps Script backend and the tests. */
(function (root) {
  var SWISS_TO = 5, FINALS_TO = 7, MIN_BOUTS = 2;

  function Refuse(msg) { this.message = msg; }
  Refuse.prototype = Object.create(Error.prototype);
  Refuse.prototype.name = "Refuse";

  function newState() {
    return { version: 1, participants: {}, order: [], pending: [], nextId: 1,
      swiss: { matchTo: SWISS_TO, rounds: [], supplemental: [] }, finals: null, log: [] };
  }
  function now() { return new Date().toISOString(); }
  function sourceKey(e) { return e && e.id ? "src:" + String(e.id) : null; }
  function findByKey(s, k) {
    for (var i = 0; i < s.order.length; i++) if (s.participants[s.order[i]].keys.indexOf(k) >= 0) return s.order[i];
    return null;
  }
  function add(s, e, k) {
    var pid = "P" + ("00" + s.nextId++).slice(-3);
    s.participants[pid] = { name: e.nickname || "", privateName: e.privateName || "", team: e.team || "",
      age: e.ageBracket || "", keys: k ? [k] : [], status: s.finals ? "late" : "active", nameLock: false };
    s.order.push(pid); s.log.push([now(), "add", pid]); return pid;
  }
  function applyMeta(p, e, changes, pid) {
    [["name", "nickname"], ["privateName", "privateName"], ["team", "team"], ["age", "ageBracket"]].forEach(function (f) {
      if (f[0] === "name" && p.nameLock) return;
      var v = e[f[1]] == null ? "" : String(e[f[1]]);
      if (v && p[f[0]] !== v) { changes.push([pid, f[0]]); p[f[0]] = v; }
    });
  }

  // Metadata-only refresh: never reorders, re-pairs, or touches results.
  function sync(s, entries) {
    var seen = {}, r = { added: [], updated: [], pending: [], missing: [] }, pendingKeys = {};
    entries.forEach(function (e, i) {
      var k = sourceKey(e);
      if (!k) {
        var pk = "noid:" + i + ":" + String(e.nickname || "").toLowerCase();
        pendingKeys[pk] = 1;
        if (!s.pending.some(function (x) { return x.key === pk; })) s.pending.push({ key: pk, entry: e });
        r.pending.push(pk); return;
      }
      var pid = findByKey(s, k);
      if (!pid) { pid = add(s, e, k); r.added.push(pid); }
      else applyMeta(s.participants[pid], e, r.updated, pid);
      if (s.participants[pid].status === "missing") s.participants[pid].status = "active";
      seen[pid] = 1;
    });
    s.pending = s.pending.filter(function (x) { return pendingKeys[x.key]; });
    s.order.forEach(function (pid) {
      var p = s.participants[pid];
      if (!seen[pid] && p.status === "active" && p.keys.length) { p.status = "missing"; r.missing.push(pid); }
    });
    s.lastSync = now(); return r;
  }
  function link(s, key, pid) {
    var x = s.pending.filter(function (y) { return y.key === key; })[0];
    if (!x) throw new Refuse("no pending entry " + key);
    if (pid === "new") pid = add(s, x.entry, null);
    else { var p = s.participants[pid]; if (!p) throw new Refuse("unknown " + pid); applyMeta(p, x.entry, [], pid); }
    s.pending.splice(s.pending.indexOf(x), 1); return pid;
  }
  function rename(s, pid, name) { must(s, pid); s.participants[pid].name = name; s.participants[pid].nameLock = true; }
  function unlockName(s, pid) { must(s, pid); s.participants[pid].nameLock = false; }
  function withdraw(s, pid) { must(s, pid); s.participants[pid].status = "withdrawn"; }
  function reinstate(s, pid) { must(s, pid); s.participants[pid].status = s.finals ? "late" : "active"; }
  function must(s, pid) { if (!s.participants[pid]) throw new Refuse("unknown participant " + pid); }

  function swissMatches(s) {
    var out = [];
    s.swiss.rounds.forEach(function (r) { out = out.concat(r.matches); });
    return out.concat(s.swiss.supplemental);
  }
  function allMatches(s) {
    var out = swissMatches(s);
    if (s.finals) s.finals.rounds.forEach(function (r) { out = out.concat(r); });
    return out;
  }
  function openMatches(s) { return allMatches(s).filter(function (m) { return !m.winner && m.b; }); }
  function eligible(s) { return s.order.filter(function (pid) { return s.participants[pid].status === "active"; }); }

  // Tie breaks (Zen Blitz defaults): wins, then opponents' wins (Buchholz), then point diff, then registration order.
  function standings(s) {
    var t = {};
    s.order.forEach(function (pid, i) { t[pid] = { pid: pid, wins: 0, bouts: 0, diff: 0, opps: [], byes: 0, reg: i }; });
    swissMatches(s).forEach(function (m) {
      if (!m.winner) return;
      [[m.a, m.sa - m.sb, m.b], [m.b, m.sb - m.sa, m.a]].forEach(function (x) {
        var row = t[x[0]]; row.bouts++; row.diff += x[1]; row.opps.push(x[2]);
      });
      t[m.winner].wins++;
    });
    s.swiss.rounds.forEach(function (r) { r.byes.forEach(function (b) { t[b].byes++; }); });
    var rows = s.order.map(function (pid) { return t[pid]; });
    rows.forEach(function (r) { r.buchholz = r.opps.reduce(function (a, o) { return a + t[o].wins; }, 0); });
    return rows.sort(function (x, y) {
      return y.wins - x.wins || y.buchholz - x.buchholz || y.diff - x.diff || x.reg - y.reg;
    });
  }
  function played(s) {
    var seen = {};
    swissMatches(s).forEach(function (m) { seen[[m.a, m.b].sort().join()] = 1; });
    return seen;
  }
  function pairGreedy(pool, seen) {
    // Backtracking pairing in standings order, avoiding rematches when possible.
    function go(rest) {
      if (!rest.length) return [];
      var a = rest[0];
      for (var j = 1; j < rest.length; j++) {
        if (seen[[a, rest[j]].sort().join()]) continue;
        var sub = go(rest.slice(1, j).concat(rest.slice(j + 1)));
        if (sub) return [[a, rest[j]]].concat(sub);
      }
      return null;
    }
    return go(pool) || pool.reduce(function (acc, p, i) { if (i % 2) acc.push([pool[i - 1], p]); return acc; }, []);
  }
  function mk(s, kind, a, b, to) {
    var m = { id: kind + (allMatches(s).length + 1), a: a, b: b, sa: null, sb: null, winner: null, to: to };
    return m;
  }
  function newRound(s) {
    if (s.finals) throw new Refuse("finals are seeded; Swiss is closed");
    if (openMatches(s).length) throw new Refuse("finish open matches first");
    var st = standings(s), elig = eligible(s), byes = {};
    s.swiss.rounds.forEach(function (r) { r.byes.forEach(function (b) { byes[b] = 1; }); });
    var pool = st.map(function (r) { return r.pid; }).filter(function (p) { return elig.indexOf(p) >= 0; });
    if (pool.length < 2) throw new Refuse("need at least 2 active players");
    var round = { n: s.swiss.rounds.length + 1, matches: [], byes: [], createdAt: now() };
    if (pool.length % 2) {
      var cand = pool.slice().reverse().filter(function (p) { return !byes[p]; })[0] || pool[pool.length - 1];
      round.byes.push(cand); pool.splice(pool.indexOf(cand), 1);
    }
    s.swiss.rounds.push(round);
    pairGreedy(pool, played(s)).forEach(function (pr) { round.matches.push(mk(s, "S", pr[0], pr[1], SWISS_TO)); });
    return round;
  }
  function supplemental(s, minBouts) {
    if (s.finals) throw new Refuse("finals are seeded");
    if (openMatches(s).length) throw new Refuse("finish open matches first");
    minBouts = minBouts || MIN_BOUTS;
    var st = standings(s), elig = eligible(s), seen = played(s), out = [];
    var short = st.filter(function (r) { return elig.indexOf(r.pid) >= 0 && r.bouts < minBouts; }).map(function (r) { return r.pid; });
    var busy = {};
    short.forEach(function (a) {
      if (busy[a]) return;
      var opp = st.map(function (r) { return r.pid; }).filter(function (b) {
        return b !== a && !busy[b] && elig.indexOf(b) >= 0 && !seen[[a, b].sort().join()];
      }).sort(function (x, y) { return (short.indexOf(x) < 0) - (short.indexOf(y) < 0); })[0];
      if (!opp) return;
      busy[a] = busy[opp] = 1;
      var m = mk(s, "X", a, opp, SWISS_TO); s.swiss.supplemental.push(m); out.push(m);
    });
    return out;
  }
  function report(s, id, sa, sb) {
    var m = allMatches(s).filter(function (x) { return x.id === id; })[0];
    if (!m || !m.b) throw new Refuse("no such match " + id);
    sa = Number(sa); sb = Number(sb);
    var hi = Math.max(sa, sb), lo = Math.min(sa, sb);
    if (!(hi >= m.to && lo < m.to && sa !== sb && lo >= 0)) throw new Refuse("score must be first to " + m.to);
    var isFinal = id.charAt(0) === "F";
    if (isFinal && m.winner) throw new Refuse("finals result already recorded; use correctFinal");
    if (!isFinal && m.winner && s.finals) throw new Refuse("finals seeded; Swiss results locked");
    m.sa = sa; m.sb = sb; m.winner = sa > sb ? m.a : m.b; m.reportedAt = now();
    s.log.push([now(), "report", id, sa, sb]);
    if (isFinal) advance(s);
    return m;
  }
  function seedFinals(s, topCut, override) {
    if (s.finals) throw new Refuse("finals already seeded");
    if (openMatches(s).length) throw new Refuse("finish open matches first");
    var st = standings(s), elig = eligible(s);
    var short = st.filter(function (r) { return elig.indexOf(r.pid) >= 0 && r.bouts < MIN_BOUTS; });
    if (short.length && !override) throw new Refuse(short.length + " player(s) have fewer than " + MIN_BOUTS +
      " real bouts; run supplemental or pass an override reason");
    var seeds = st.filter(function (r) { return elig.indexOf(r.pid) >= 0; }).slice(0, topCut).map(function (r) { return r.pid; });
    var size = 1; while (size < seeds.length) size *= 2;
    s.finals = { matchTo: FINALS_TO, seeds: seeds, size: size, rounds: [], champion: null,
      override: override ? String(override) : null, seededAt: now() };
    var order = bracketOrder(size), first = [];
    for (var i = 0; i < size; i += 2) {
      var a = seeds[order[i] - 1] || null, b = seeds[order[i + 1] - 1] || null;
      var m = mk(s, "F", a || b, a && b ? b : null, FINALS_TO);
      if (!m.b) m.winner = m.a;
      first.push(m); s.finals.rounds[0] = first;
    }
    advance(s); return s.finals;
  }
  function bracketOrder(n) {
    var o = [1];
    while (o.length < n) { var m = o.length * 2 + 1, nx = []; o.forEach(function (x) { nx.push(x, m - x); }); o = nx; }
    return o;
  }
  function advance(s) {
    var f = s.finals, last = f.rounds[f.rounds.length - 1];
    if (last.some(function (m) { return !m.winner; })) return;
    if (last.length === 1) { f.champion = last[0].winner; return; }
    var next = [];
    for (var i = 0; i < last.length; i += 2) next.push(mk(s, "F", last[i].winner, last[i + 1].winner, FINALS_TO));
    f.rounds.push(next);
  }
  function label(s, pid) {
    var p = s.participants[pid]; if (!p) return "";
    return p.name || "Blader " + (s.order.indexOf(pid) + 1);
  }
  function publicView(s) {
    var L = function (pid) { return pid ? label(s, pid) : null; };
    var team = function (pid) { return pid ? s.participants[pid].team : null; };
    var pm = function (m) { return { id: m.id, a: L(m.a), aTeam: team(m.a), b: L(m.b), bTeam: team(m.b),
      sa: m.sa, sb: m.sb, winner: L(m.winner) }; };
    return {
      swissTo: SWISS_TO, finalsTo: FINALS_TO,
      standings: standings(s).filter(function (r) { return s.participants[r.pid].status !== "late"; }).map(function (r, i) {
        var p = s.participants[r.pid];
        return { rank: i + 1, name: L(r.pid), team: p.team, wins: r.wins, bouts: r.bouts, diff: r.diff, status: p.status };
      }),
      rounds: s.swiss.rounds.map(function (r) { return { n: r.n, matches: r.matches.map(pm), byes: r.byes.map(L) }; }),
      supplemental: s.swiss.supplemental.map(pm),
      finals: s.finals && { seeds: s.finals.seeds.map(L), rounds: s.finals.rounds.map(function (r) { return r.map(pm); }),
        champion: L(s.finals.champion) }
    };
  }
  function suggest(n) {
    var rounds = Math.max(3, Math.ceil(Math.log(Math.max(n, 2)) / Math.LN2));
    return { swissRounds: Math.min(rounds, 5), topCut: n >= 12 ? 8 : 4, note: "Zen Blitz default, not a WBO requirement" };
  }

  var api = { Refuse: Refuse, newState: newState, sync: sync, link: link, rename: rename, unlockName: unlockName,
    withdraw: withdraw, reinstate: reinstate, newRound: newRound, supplemental: supplemental, report: report,
    seedFinals: seedFinals, standings: standings, openMatches: openMatches, publicView: publicView, suggest: suggest,
    SWISS_TO: SWISS_TO, FINALS_TO: FINALS_TO, MIN_BOUTS: MIN_BOUTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ZenLadder = api;
})(this);
