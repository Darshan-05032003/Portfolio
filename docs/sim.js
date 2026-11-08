/* Simulation engines for the portfolio labs. Pure logic, no DOM.
   Works in the browser (window.Sim) and in Node (module.exports) for unit tests. */
(function (root) {
  'use strict';

  // Small seeded PRNG (mulberry32) so demos are reproducible and testable.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Indian digit grouping, amounts held as integer paise.
  function inr(paise) {
    const neg = paise < 0;
    const abs = Math.abs(paise);
    const rupees = Math.floor(abs / 100);
    const p = abs % 100;
    const s = String(rupees);
    let out = s;
    if (s.length > 3) {
      const last3 = s.slice(-3);
      const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      out = rest + ',' + last3;
    }
    return (neg ? '−' : '') + '₹' + out + (p ? '.' + String(p).padStart(2, '0') : '');
  }

  // ---------- Lab 1: twenty buyers, five units ----------
  // naive: SELECT stock, then later UPDATE stock = seen - 1 (read-modify-write, lost updates)
  // safe:  UPDATE product SET stock = stock - 1 WHERE id = ? AND stock >= 1 (atomic, conditional)
  function race(opts) {
    const { mode, buyers, stock, seed } = opts;
    if (mode !== 'naive' && mode !== 'safe') throw new Error('mode must be naive or safe');
    if (!(buyers > 0) || !(stock >= 0)) throw new Error('buyers must be > 0 and stock >= 0');
    const r = rng(seed);
    const plan = [];
    for (let b = 0; b < buyers; b++) {
      // requests arrive over ~1s; each holds its read for 50–300 ms before writing
      const read = r() * 1.0;
      const write = read + 0.05 + r() * 0.25;
      plan.push({ b, read, write });
    }
    const queue = [];
    for (const p of plan) {
      queue.push({ t: p.read, buyer: p.b, kind: 'read' });
      queue.push({ t: p.write, buyer: p.b, kind: 'write' });
    }
    queue.sort((x, y) => x.t - y.t || (x.kind === 'read' ? -1 : 1));

    let current = stock;
    const seen = {};
    const events = [];
    let orders = 0, rejected = 0;
    for (const q of queue) {
      if (q.kind === 'read') {
        if (mode === 'naive') {
          seen[q.buyer] = current;
          events.push({ t: q.t, buyer: q.buyer, type: 'read', stockSeen: current });
        } else {
          events.push({ t: q.t, buyer: q.buyer, type: 'request' });
        }
        continue;
      }
      if (mode === 'naive') {
        const s = seen[q.buyer];
        if (s > 0) {
          current = s - 1;
          orders++;
          events.push({ t: q.t, buyer: q.buyer, type: 'order', stockSeen: s, stockAfter: current });
        } else {
          rejected++;
          events.push({ t: q.t, buyer: q.buyer, type: 'reject', stockSeen: s, stockAfter: current });
        }
      } else {
        if (current >= 1) {
          current -= 1;
          orders++;
          events.push({ t: q.t, buyer: q.buyer, type: 'order', stockAfter: current });
        } else {
          rejected++;
          events.push({ t: q.t, buyer: q.buyer, type: 'reject', stockAfter: current });
        }
      }
    }
    return { mode, events, orders, rejected, finalStock: current, oversold: Math.max(0, orders - stock) };
  }

  // ---------- Lab 2: idempotent payments ----------
  function paymentServer() {
    const store = new Map();
    const charges = [];
    return {
      charges,
      handle(req) {
        if (req.key && store.has(req.key)) {
          const saved = store.get(req.key);
          if (saved.amount !== req.amount) {
            return { status: 422, error: 'Idempotency-Key reused with a different request body' };
          }
          return Object.assign({}, saved.response, { replayed: true });
        }
        const charge = { id: 'ch_' + (charges.length + 1), amount: req.amount };
        charges.push(charge);
        const response = { status: 201, chargeId: charge.id, replayed: false };
        if (req.key) store.set(req.key, { amount: req.amount, response });
        return response;
      }
    };
  }

  function payWithRetries(server, opts) {
    const { useKey, amount, lostResponses } = opts;
    const key = useKey ? (opts.key || 'idem-' + Math.random().toString(36).slice(2, 10)) : null;
    const attempts = [];
    for (let i = 0; i <= lostResponses; i++) {
      const res = server.handle({ key, amount });
      attempts.push(Object.assign({}, res, { lost: i < lostResponses, attempt: i + 1 }));
    }
    return { key, attempts };
  }

  // ---------- Lab 3: double-entry ledger ----------
  class AppendOnlyError extends Error {}

  function ledger(opts) {
    const approvalThreshold = opts.approvalThreshold;
    const accounts = Object.keys(opts.accounts);
    const entries = [];
    const journals = [];
    const transfers = [];
    let seq = 0, jseq = 0, tseq = 0;

    function isInt(n) { return Number.isInteger(n) && n > 0; }

    function post(type, legs, meta) {
      let d = 0, c = 0;
      for (const l of legs) {
        if (!isInt(l.amount)) throw new Error('leg amounts must be positive integers');
        if (l.side === 'D') d += l.amount; else if (l.side === 'C') c += l.amount; else throw new Error('side must be D or C');
      }
      if (d !== c) throw new Error('Refused: unbalanced journal (debits ' + d + ' ≠ credits ' + c + ')');
      const id = 'J' + String(++jseq).padStart(4, '0');
      const j = Object.freeze(Object.assign({ id, type, reversalOf: null }, meta || {}));
      journals.push(j);
      for (const l of legs) entries.push(Object.freeze({ id: ++seq, journal: id, type, account: l.account, side: l.side, amount: l.amount }));
      return j;
    }

    function balance(acct) {
      let b = 0;
      for (const e of entries) if (e.account === acct) b += e.side === 'C' ? e.amount : -e.amount;
      return b;
    }
    function held(acct) {
      let h = 0;
      for (const t of transfers) if (t.status === 'PENDING_APPROVAL' && t.from === acct) h += t.amount;
      return h;
    }
    function available(acct) { return balance(acct) - held(acct); }

    for (const a of accounts) {
      if (opts.accounts[a] > 0) post('OPENING', [{ account: 'CASH_VAULT', side: 'D', amount: opts.accounts[a] }, { account: a, side: 'C', amount: opts.accounts[a] }]);
    }

    function transfer({ from, to, amount, by }) {
      if (!isInt(amount)) throw new Error('amount must be a positive integer in paise');
      if (from === to) throw new Error('from and to must differ');
      if (!accounts.includes(from) || !accounts.includes(to)) throw new Error('unknown account');
      const t = { id: 'T' + String(++tseq).padStart(3, '0'), from, to, amount, by, status: null, journal: null };
      if (available(from) < amount) {
        t.status = 'REJECTED';
        t.reason = 'Insufficient available balance';
        transfers.push(t);
        return { status: t.status, transfer: t.id, reason: t.reason };
      }
      if (amount > approvalThreshold) {
        t.status = 'PENDING_APPROVAL';
        transfers.push(t);
        return { status: t.status, transfer: t.id };
      }
      const j = post('TRANSFER', [{ account: from, side: 'D', amount }, { account: to, side: 'C', amount }], { transfer: t.id });
      t.status = 'POSTED'; t.journal = j.id;
      transfers.push(t);
      return { status: t.status, transfer: t.id, journal: j.id };
    }

    function approve(transferId, checker) {
      const t = transfers.find(x => x.id === transferId);
      if (!t || t.status !== 'PENDING_APPROVAL') throw new Error('transfer is not awaiting approval');
      if (checker === t.by) throw new Error('Four-eyes rule: the same user cannot raise and approve a transfer');
      t.status = 'APPROVING'; // release hold before posting
      const j = post('TRANSFER', [{ account: t.from, side: 'D', amount: t.amount }, { account: t.to, side: 'C', amount: t.amount }], { transfer: t.id, approvedBy: checker });
      t.status = 'POSTED'; t.journal = j.id;
      return { status: 'POSTED', transfer: t.id, journal: j.id };
    }

    function reverse(journalId, by) {
      const j = journals.find(x => x.id === journalId);
      if (!j) throw new Error('unknown journal');
      if (journals.some(x => x.reversalOf === journalId)) throw new Error('Journal ' + journalId + ' is already reversed');
      const legs = entries.filter(e => e.journal === journalId).map(e => ({ account: e.account, side: e.side === 'D' ? 'C' : 'D', amount: e.amount }));
      const r = post('REVERSAL', legs, { reversalOf: journalId, by });
      return { status: 'POSTED', journal: r.id };
    }

    function update() {
      throw new AppendOnlyError('ledger_entry is append-only: UPDATE rejected by trigger. Post a reversal instead.');
    }

    function trialBalance() {
      let d = 0, c = 0;
      for (const e of entries) { if (e.side === 'D') d += e.amount; else c += e.amount; }
      return { debits: d, credits: c, balanced: d === c };
    }

    return {
      post, transfer, approve, reverse, update, trialBalance, balance, available, held,
      entries: () => entries.slice(),
      journals: () => journals.slice(),
      transfers: () => transfers.map(t => Object.assign({}, t)),
      accounts: () => accounts.slice()
    };
  }

  // ---------- Lab 4: geofence with cooldown ----------
  function geofence(opts) {
    const { cx, cy, r, cooldownMs } = opts;
    let inside = null;
    let lastNotify = -Infinity;
    return {
      move(x, y, now) {
        const isIn = Math.hypot(x - cx, y - cy) <= r;
        if (inside === null) { inside = isIn; return { transition: null, inside }; }
        if (isIn === inside) return { transition: null, inside };
        inside = isIn;
        if (!isIn) {
          const notify = now - lastNotify > cooldownMs;
          if (notify) lastNotify = now;
          return { transition: 'EXIT', notify, inside };
        }
        return { transition: 'ENTER', notify: false, inside };
      },
      get inside() { return inside; }
    };
  }

  const api = { rng, inr, race, paymentServer, payWithRetries, ledger, geofence, AppendOnlyError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sim = api;
})(typeof window !== 'undefined' ? window : this);
