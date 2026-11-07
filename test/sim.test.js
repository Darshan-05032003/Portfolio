// Unit tests for the simulation engines behind the portfolio's interactive labs.
// Written before sim.js (TDD). Run: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/sim.js');

// ---------- seeded RNG ----------
test('rng is deterministic for a seed', () => {
  const a = S.rng(42), b = S.rng(42);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
});
test('rng stays in [0,1)', () => {
  const r = S.rng(7);
  for (let i = 0; i < 1000; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});

// ---------- Lab 1: stock race ----------
test('safe mode sells exactly the stock, never below zero, for many seeds', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const res = S.race({ mode: 'safe', buyers: 20, stock: 5, seed });
    assert.equal(res.orders, 5, `seed ${seed}`);
    assert.equal(res.finalStock, 0);
    assert.equal(res.rejected, 15);
    assert.equal(res.oversold, 0);
    for (const e of res.events) assert.ok(e.stockAfter === undefined || e.stockAfter >= 0);
  }
});
test('naive mode oversells (lost updates) for the demo seeds', () => {
  let oversoldRuns = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const res = S.race({ mode: 'naive', buyers: 20, stock: 5, seed });
    assert.ok(res.orders >= 5);
    if (res.oversold > 0) oversoldRuns++;
  }
  assert.ok(oversoldRuns >= 290, `only ${oversoldRuns}/300 runs oversold`);
});
test('race events are time ordered and every buyer resolves once', () => {
  const res = S.race({ mode: 'naive', buyers: 20, stock: 5, seed: 3 });
  for (let i = 1; i < res.events.length; i++) assert.ok(res.events[i].t >= res.events[i - 1].t);
  const outcomes = res.events.filter(e => e.type === 'order' || e.type === 'reject');
  assert.equal(outcomes.length, 20);
  assert.equal(new Set(outcomes.map(e => e.buyer)).size, 20);
});
test('race validates input', () => {
  assert.throws(() => S.race({ mode: 'nope', buyers: 2, stock: 1, seed: 1 }));
  assert.throws(() => S.race({ mode: 'safe', buyers: 0, stock: 1, seed: 1 }));
});

// ---------- Lab 2: idempotent payments ----------
test('with an Idempotency-Key, retries never double-charge', () => {
  const srv = S.paymentServer();
  const r = S.payWithRetries(srv, { useKey: true, amount: 49900, lostResponses: 2, key: 'k1' });
  assert.equal(srv.charges.length, 1);
  assert.equal(r.attempts.length, 3);
  assert.equal(r.attempts.filter(a => a.replayed).length, 2);
});
test('without a key, each retry charges again', () => {
  const srv = S.paymentServer();
  S.payWithRetries(srv, { useKey: false, amount: 49900, lostResponses: 2 });
  assert.equal(srv.charges.length, 3);
});
test('same key with a different body is refused with 422', () => {
  const srv = S.paymentServer();
  srv.handle({ key: 'k', amount: 100 });
  const res = srv.handle({ key: 'k', amount: 200 });
  assert.equal(res.status, 422);
  assert.equal(srv.charges.length, 1);
});
test('keys are scoped: different keys charge separately', () => {
  const srv = S.paymentServer();
  srv.handle({ key: 'a', amount: 100 });
  srv.handle({ key: 'b', amount: 100 });
  assert.equal(srv.charges.length, 2);
});

// ---------- Lab 3: double-entry ledger ----------
function fresh() {
  return S.ledger({ accounts: { asha: 1000000, ravi: 200000 }, approvalThreshold: 500000 });
}
test('opening balances are posted as balanced journals', () => {
  const L = fresh();
  assert.equal(L.balance('asha'), 1000000);
  assert.equal(L.balance('ravi'), 200000);
  assert.ok(L.trialBalance().balanced);
});
test('a transfer posts one debit and one credit of equal amount', () => {
  const L = fresh();
  const r = L.transfer({ from: 'asha', to: 'ravi', amount: 150000, by: 'asha' });
  assert.equal(r.status, 'POSTED');
  const legs = L.entries().filter(e => e.journal === r.journal);
  assert.equal(legs.length, 2);
  assert.equal(legs.find(l => l.side === 'D').amount, 150000);
  assert.equal(legs.find(l => l.side === 'C').amount, 150000);
  assert.equal(L.balance('asha'), 850000);
  assert.equal(L.balance('ravi'), 350000);
  assert.ok(L.trialBalance().balanced);
});
test('unbalanced journals are refused', () => {
  const L = fresh();
  assert.throws(() => L.post('BAD', [{ account: 'asha', side: 'D', amount: 5 }, { account: 'ravi', side: 'C', amount: 4 }]), /unbalanced/i);
});
test('insufficient funds is rejected and nothing is posted', () => {
  const L = fresh();
  const before = L.entries().length;
  const r = L.transfer({ from: 'ravi', to: 'asha', amount: 300000, by: 'ravi' });
  assert.equal(r.status, 'REJECTED');
  assert.equal(L.entries().length, before);
});
test('ledger entries are append-only: edits throw, reversal corrects', () => {
  const L = fresh();
  const r = L.transfer({ from: 'asha', to: 'ravi', amount: 100000, by: 'asha' });
  const entry = L.entries().find(e => e.journal === r.journal);
  assert.throws(() => L.update(entry.id, { amount: 1 }), /append-only/i);
  const rev = L.reverse(r.journal, 'asha');
  assert.equal(rev.status, 'POSTED');
  assert.equal(L.balance('asha'), 1000000);
  assert.equal(L.balance('ravi'), 200000);
  assert.throws(() => L.reverse(r.journal, 'asha'), /already reversed/i);
  assert.ok(L.trialBalance().balanced);
});
test('large transfers are held for a different checker (maker-checker)', () => {
  const L = fresh();
  const r = L.transfer({ from: 'asha', to: 'ravi', amount: 600000, by: 'asha' });
  assert.equal(r.status, 'PENDING_APPROVAL');
  assert.equal(L.balance('asha'), 1000000);       // ledger balance unchanged
  assert.equal(L.available('asha'), 400000);      // money on hold
  assert.throws(() => L.approve(r.transfer, 'asha'), /four-eyes|same user/i);
  const ok = L.approve(r.transfer, 'checker');
  assert.equal(ok.status, 'POSTED');
  assert.equal(L.balance('asha'), 400000);
  assert.equal(L.available('asha'), 400000);
  assert.ok(L.trialBalance().balanced);
});
test('holds count against available balance for later transfers', () => {
  const L = fresh();
  L.transfer({ from: 'asha', to: 'ravi', amount: 600000, by: 'asha' });
  const r = L.transfer({ from: 'asha', to: 'ravi', amount: 450000, by: 'asha' });
  assert.equal(r.status, 'REJECTED');
});
test('amounts must be positive integers (paise)', () => {
  const L = fresh();
  assert.throws(() => L.transfer({ from: 'asha', to: 'ravi', amount: -5, by: 'asha' }));
  assert.throws(() => L.transfer({ from: 'asha', to: 'ravi', amount: 1.5, by: 'asha' }));
  assert.throws(() => L.transfer({ from: 'asha', to: 'asha', amount: 100, by: 'asha' }));
});

// ---------- Lab 4: geofence ----------
test('geofence reports EXIT once when crossing out, ENTER when back', () => {
  const g = S.geofence({ cx: 0, cy: 0, r: 100, cooldownMs: 300000 });
  assert.equal(g.move(10, 10, 0).transition, null);       // starts inside
  const out = g.move(200, 0, 1000);
  assert.equal(out.transition, 'EXIT');
  assert.equal(out.notify, true);
  assert.equal(g.move(210, 0, 2000).transition, null);    // still outside, no repeat
  assert.equal(g.move(0, 0, 3000).transition, 'ENTER');
});
test('a second exit inside the cooldown is recorded but not pushed', () => {
  const g = S.geofence({ cx: 0, cy: 0, r: 100, cooldownMs: 300000 });
  g.move(0, 0, 0);
  g.move(200, 0, 1000);
  g.move(0, 0, 2000);
  const again = g.move(200, 0, 3000);
  assert.equal(again.transition, 'EXIT');
  assert.equal(again.notify, false);
  g.move(0, 0, 4000);
  const later = g.move(200, 0, 1000 + 300001);
  assert.equal(later.notify, true);
});
test('formatting rupees from paise', () => {
  assert.equal(S.inr(150000), '₹1,500');
  assert.equal(S.inr(1000000), '₹10,000');
  assert.equal(S.inr(49900), '₹499');
  assert.equal(S.inr(12345678), '₹1,23,456.78');
});
