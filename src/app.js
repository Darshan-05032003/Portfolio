/* Wiring for the four labs. Depends on window.Sim (sim.js). */
(function () {
  'use strict';
  const S = window.Sim;
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- Lab 1: race ---------------- */
  (function raceLab() {
    const buyersEl = $('buyers'), log = $('race-log'), verdict = $('race-verdict');
    const ordersEl = $('race-orders'), stockEl = $('race-stock'), runBtn = $('race-run');
    if (!buyersEl) return;
    const N = 20, STOCK = 5;
    const SEEDS = [6, 15, 29, 63, 47, 19, 62, 71, 70, 25];
    let running = false, runIdx = 0;

    function reset() {
      buyersEl.innerHTML = '';
      for (let i = 0; i < N; i++) {
        const li = document.createElement('li');
        li.className = 'buyer'; li.id = 'buyer-' + i; li.textContent = 'B' + (i + 1);
        li.setAttribute('aria-label', 'Buyer ' + (i + 1) + ': waiting');
        buyersEl.appendChild(li);
      }
      ordersEl.textContent = '0'; ordersEl.classList.remove('bad');
      stockEl.textContent = String(STOCK); stockEl.classList.remove('bad');
      log.innerHTML = ''; verdict.textContent = ''; verdict.className = 'verdict';
    }
    function line(cls, text) {
      const span = document.createElement('span');
      span.className = cls; span.textContent = text + '\n';
      log.appendChild(span);
      while (log.childNodes.length > 7) log.removeChild(log.firstChild);
    }
    function mode() { return document.querySelector('input[name="race-mode"]:checked').value; }

    async function run() {
      if (running) return;
      running = true; runBtn.disabled = true; reset();
      const m = mode();
      const res = S.race({ mode: m, buyers: N, stock: STOCK, seed: SEEDS[runIdx++ % SEEDS.length] });
      let orders = 0, stock = STOCK;
      line('no', m === 'naive' ? '-- read-modify-write, no lock' : '-- UPDATE product SET stock = stock - 1 WHERE id = 7 AND stock >= 1');
      let last = 0;
      for (const e of res.events) {
        await wait(Math.min(220, Math.max(30, (e.t - last) * 900)));
        last = e.t;
        const b = $('buyer-' + e.buyer);
        if (e.type === 'read') { b.classList.add('reading'); b.setAttribute('aria-label', 'Buyer ' + (e.buyer + 1) + ' read stock ' + e.stockSeen); line('no', 'B' + (e.buyer + 1) + '  SELECT stock → ' + e.stockSeen); continue; }
        if (e.type === 'request') { b.classList.add('reading'); continue; }
        b.classList.remove('reading');
        if (e.type === 'order') {
          orders++;
          const phantom = orders > STOCK;
          b.classList.add(phantom ? 'phantom' : 'ordered');
          b.setAttribute('aria-label', 'Buyer ' + (e.buyer + 1) + (phantom ? ' ordered a unit that does not exist' : ' ordered'));
          stock = m === 'naive' ? e.stockAfter : e.stockAfter;
          if (m === 'naive') line(phantom ? 'bad' : 'ok', 'B' + (e.buyer + 1) + '  UPDATE stock = ' + e.stockSeen + ' - 1   -- saw ' + e.stockSeen + (phantom ? '  ← phantom unit' : ''));
          else line('ok', 'B' + (e.buyer + 1) + '  UPDATE … stock >= 1 → 1 row   (' + e.stockAfter + ' left)');
          ordersEl.textContent = String(orders);
          if (phantom) { ordersEl.classList.add('bad'); }
          stockEl.textContent = String(stock);
        } else {
          b.classList.add('rejected');
          b.setAttribute('aria-label', 'Buyer ' + (e.buyer + 1) + ' rejected, out of stock');
          if (m === 'naive') line('no', 'B' + (e.buyer + 1) + '  saw 0 → 409 Out of stock');
          else line('no', 'B' + (e.buyer + 1) + '  UPDATE … stock >= 1 → 0 rows → 409');
        }
      }
      if (m === 'naive') {
        verdict.className = 'verdict bad';
        verdict.innerHTML = '<strong>' + res.orders + ' orders for ' + STOCK + ' units.</strong> ' + res.oversold + ' customers paid for stock that does not exist, because each request trusted the number it read a moment earlier' + (res.finalStock > 0 ? ', and the shelf still claims ' + res.finalStock + ' left' : '') + '. Switch to the conditional UPDATE and run it again.';
      } else {
        verdict.className = 'verdict good';
        verdict.innerHTML = '<strong>Exactly ' + res.orders + ' orders, ' + res.rejected + ' clean rejections.</strong> The database decides in one atomic statement; zero affected rows means the whole order rolls back. This is <code>OrderPlacementService</code> in ecommerce-backend, and the test that guards it sends ' + N + ' real threads.';
      }
      running = false; runBtn.disabled = false;
      runBtn.textContent = 'Run again';
    }
    reset();
    runBtn.addEventListener('click', run);
    document.querySelectorAll('input[name="race-mode"]').forEach((r) => r.addEventListener('change', () => { if (!running) { reset(); runBtn.textContent = 'Run the sale'; } }));
  })();

  /* ---------------- Lab 2: payments ---------------- */
  (function payLab() {
    const wire = $('pay-wire'), stmt = $('pay-stmt'), verdict = $('pay-verdict'), btn = $('pay-run'), keyBox = $('pay-key');
    if (!wire) return;
    let busy = false;
    async function run() {
      if (busy) return; busy = true; btn.disabled = true;
      wire.innerHTML = ''; stmt.innerHTML = ''; verdict.textContent = ''; verdict.className = 'verdict';
      const useKey = keyBox.checked;
      const server = S.paymentServer();
      const r = S.payWithRetries(server, { useKey, amount: 49900, lostResponses: 2, key: 'idem-7f3a9c' });
      for (const a of r.attempts) {
        const li = document.createElement('li');
        const hdr = useKey ? ' <code>Idempotency-Key: idem-7f3a9c</code>' : '';
        li.innerHTML = '<b>Attempt ' + a.attempt + '</b><span>POST /me/orders/42/payments  ₹499' + hdr + '</span>';
        wire.appendChild(li);
        await wait(380);
        const res = document.createElement('li');
        if (a.lost) {
          res.innerHTML = '<b class="lost">timeout</b><span class="lost">server answered <code>' + a.status + '</code>' + (a.replayed ? ' (replayed)' : ' (charged ' + a.chargeId + ')') + ', but the response never reached the phone. Retrying…</span>';
        } else {
          res.innerHTML = '<b>' + a.status + '</b><span' + (a.replayed ? ' class="replay"' : '') + '>' + (a.replayed ? '<code>Idempotent-Replayed: true</code> — same stored response, no new charge' : 'Paid. Charge ' + a.chargeId) + '</span>';
        }
        wire.appendChild(res);
        await wait(380);
      }
      const n = server.charges.length;
      let html = '';
      server.charges.forEach((c, i) => { html += '<div class="stmt-row"><span>' + c.id + ' · Card ending 4417</span><span>' + S.inr(c.amount) + '</span></div>'; });
      html += '<div class="stmt-row total' + (n > 1 ? ' bad' : '') + '"><span>Charged to customer</span><span>' + S.inr(n * 49900) + '</span></div>';
      stmt.innerHTML = html;
      if (n > 1) {
        verdict.className = 'verdict bad';
        verdict.innerHTML = '<strong>Charged ' + n + ' times for one order.</strong> Every retry looked like a new payment. Flip the switch and pay again.';
      } else {
        verdict.className = 'verdict good';
        verdict.innerHTML = '<strong>Charged once.</strong> The key, the user and a SHA-256 of the body are stored with the first response in the same transaction. Retries get that response back; the same key with a different amount gets 422.';
      }
      busy = false; btn.disabled = false;
    }
    btn.addEventListener('click', run);
  })();

  /* ---------------- Lab 3: ledger ---------------- */
  (function ledgerLab() {
    const acctsEl = $('accts'), tbody = $('journal'), notice = $('ledger-notice'), pendingEl = $('pending');
    if (!acctsEl) return;
    const NAMES = { asha: 'Asha', ravi: 'Ravi', CASH_VAULT: 'Cash vault (GL)' };
    let L;
    function fresh() { L = S.ledger({ accounts: { asha: 1000000, ravi: 200000 }, approvalThreshold: 500000 }); }
    function say(kind, html) { notice.innerHTML = '<p class="notice' + (kind === 'bad' ? ' bad' : '') + '">' + html + '</p>'; }

    function render() {
      acctsEl.innerHTML = '';
      for (const a of L.accounts()) {
        const d = document.createElement('div'); d.className = 'acct';
        const held = L.held(a);
        d.innerHTML = '<span>' + NAMES[a] + '</span><b>' + S.inr(L.balance(a)) + '</b><span>available ' + S.inr(L.available(a)) + (held ? ' · <span class="held">on hold ' + S.inr(held) + '</span>' : '') + '</span>';
        acctsEl.appendChild(d);
      }
      pendingEl.innerHTML = '';
      for (const t of L.transfers()) {
        if (t.status !== 'PENDING_APPROVAL') continue;
        const row = document.createElement('div');
        row.innerHTML = '<span><b>' + t.id + '</b> ' + NAMES[t.from] + ' → ' + NAMES[t.to] + ' ' + S.inr(t.amount) + ' awaits a checker.</span>';
        const self = document.createElement('button'); self.className = 'linkbtn'; self.type = 'button'; self.textContent = 'Approve as ' + NAMES[t.by];
        self.addEventListener('click', () => { try { L.approve(t.id, t.by); } catch (e) { say('bad', '<code>403</code> ' + esc(e.message) + '. The server checks the raiser\'s id against the approver\'s token, not a UI flag.'); } render(); });
        const chk = document.createElement('button'); chk.className = 'linkbtn'; chk.type = 'button'; chk.textContent = 'Approve as Checker';
        chk.addEventListener('click', () => { const r = L.approve(t.id, 'checker'); say('ok', 'Posted as ' + r.journal + '. The hold is released and the ledger balance moves only now.'); render(); });
        row.appendChild(self); row.appendChild(chk); pendingEl.appendChild(row);
      }
      tbody.innerHTML = '';
      const journals = L.journals();
      for (const e of L.entries()) {
        const j = journals.find((x) => x.id === e.journal);
        const tr = document.createElement('tr');
        if (j.type === 'REVERSAL') tr.className = 'rev';
        const firstLeg = L.entries().find((x) => x.journal === e.journal).id === e.id;
        tr.innerHTML = '<td>' + (firstLeg ? e.journal + ' <span style="color:var(--ink-2)">' + j.type.toLowerCase() + (j.reversalOf ? ' of ' + j.reversalOf : '') + '</span>' : '') + '</td>' +
          '<td>' + NAMES[e.account] + '</td>' +
          '<td class="num">' + (e.side === 'D' ? S.inr(e.amount) : '') + '</td>' +
          '<td class="num">' + (e.side === 'C' ? S.inr(e.amount) : '') + '</td>' +
          '<td class="act"></td>';
        const act = tr.lastElementChild;
        const ed = document.createElement('button'); ed.className = 'linkbtn danger'; ed.type = 'button'; ed.textContent = 'Edit';
        ed.setAttribute('aria-label', 'Try to edit entry ' + e.id);
        ed.addEventListener('click', () => { try { L.update(e.id, { amount: 1 }); } catch (err) { say('bad', '<code>ERROR: ' + esc(err.message) + '</code><br>In core-banking-ledger this is a PostgreSQL trigger on <code>ledger_entry</code>, so even a DBA with a psql shell cannot quietly change history.'); } });
        act.appendChild(ed);
        if (firstLeg && j.type === 'TRANSFER' && !journals.some((x) => x.reversalOf === j.id)) {
          const rv = document.createElement('button'); rv.className = 'linkbtn'; rv.type = 'button'; rv.textContent = 'Reverse';
          rv.addEventListener('click', () => { const r = L.reverse(j.id, 'teller'); say('ok', 'Posted ' + r.journal + ', a mirror-image journal linked by <code>reversal_of</code>. The original stays; the books still balance; a unique constraint means it can only be reversed once.'); render(); });
          act.appendChild(rv);
        }
        tbody.appendChild(tr);
      }
      const tb = L.trialBalance();
      $('tb-d').textContent = S.inr(tb.debits); $('tb-c').textContent = S.inr(tb.credits);
      $('tb-stamp').innerHTML = '<span class="stamp' + (tb.balanced ? '' : ' bad') + '">' + (tb.balanced ? 'Balanced' : 'Off') + '</span>';
    }

    document.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      const op = b.dataset.op;
      try {
        if (op === 'reset') { fresh(); say('ok', 'Fresh books. Opening balances are themselves journals against the cash vault, so the trial balance starts balanced.'); }
        if (op === 't1') { const r = L.transfer({ from: 'asha', to: 'ravi', amount: 150000, by: 'asha' }); r.status === 'POSTED' ? say('ok', 'Posted ' + r.journal + ': debit Asha, credit Ravi, one transaction. Both balance rows were locked in ascending id order first.') : say('bad', '<code>422</code> ' + esc(r.reason) + '.'); }
        if (op === 't2') { const r = L.transfer({ from: 'ravi', to: 'asha', amount: 300000, by: 'ravi' }); r.status === 'POSTED' ? say('ok', 'Posted ' + r.journal + '.') : say('bad', '<code>422 INSUFFICIENT_FUNDS</code> Nothing was written. The FAILED transfer row is kept for audit; the ledger is untouched.'); }
        if (op === 'big') { const r = L.transfer({ from: 'asha', to: 'ravi', amount: 600000, by: 'asha' }); r.status === 'PENDING_APPROVAL' ? say('ok', '<code>202 Accepted</code> Above ₹5,000 a transfer needs a second pair of eyes. ₹6,000 is now on hold: Asha\'s available balance dropped, her ledger balance did not.') : say('bad', '<code>422</code> ' + esc(r.reason || r.status) + '.'); }
        if (op === 'bad') { L.post('MANUAL', [{ account: 'asha', side: 'D', amount: 100000 }, { account: 'ravi', side: 'C', amount: 99900 }]); }
      } catch (e) { say('bad', '<code>' + esc(e.message) + '</code><br><code>PostingService</code> sums the legs before anything touches the database. Debits ₹1,000, credits ₹999: refused.'); }
      render();
    }));
    fresh(); render();
  })();

  /* ---------------- Lab 4: geofence ---------------- */
  (function geoLab() {
    const svg = $('geo-map'); if (!svg) return;
    const dot = $('geo-dot'), c1 = $('geo-dot-c'), c2 = $('geo-dot-i'), t = $('geo-dot-t');
    const screen = $('geo-screen'), pipe = $('geo-pipe'), help = $('geo-help');
    const CX = 200, CY = 150, R = 95;
    const g = S.geofence({ cx: CX, cy: CY, r: R, cooldownMs: 300000 });
    let x = 180, y = 140, simNow = 0, lastRealTs = performance.now(), dragging = false, animating = false;
    g.move(x, y, 0);
    const clockBase = 10 * 60 + 42;
    function tick() {
      // simulated time runs 60x so the 5-minute cooldown is reachable in a demo
      const real = performance.now(); simNow += (real - lastRealTs) * 60; lastRealTs = real;
      const mins = clockBase + Math.floor(simNow / 60000);
      $('geo-clock').textContent = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    }
    setInterval(tick, 1000);

    function place(nx, ny) {
      x = Math.max(12, Math.min(408, nx)); y = Math.max(26, Math.min(288, ny));
      [c1, c2].forEach((c) => { c.setAttribute('cx', x); c.setAttribute('cy', y); });
      t.setAttribute('x', x); t.setAttribute('y', y - 18);
      const dist = Math.hypot(x - CX, y - CY);
      dot.setAttribute('aria-valuenow', Math.min(100, Math.round(dist / R * 50)));
      dot.setAttribute('aria-valuetext', (dist <= R ? 'inside' : 'outside') + ' the zone, ' + Math.round(dist / R * 300) + ' metres from centre');
      const res = g.move(x, y, simNow);
      if (res.transition === 'EXIT') fire(res.notify);
      if (res.transition === 'ENTER') { c2.setAttribute('fill', '#2443B0'); c1.setAttribute('fill', '#2443B0'); clearPipe(); help.textContent = 'Back inside. Re-entry is a transition too, but the app only alerts on EXIT.'; }
    }
    function clearPipe() { pipe.querySelectorAll('li').forEach((li) => { li.className = ''; }); }
    async function fire(notify) {
      c2.setAttribute('fill', '#B3261E'); c1.setAttribute('fill', '#B3261E');
      if (animating) return; animating = true; clearPipe();
      const steps = ['os', 'worker', 'fs', 'fn', 'fcm'];
      for (const s of steps) {
        const li = pipe.querySelector('[data-step="' + s + '"]');
        if (!notify && s === 'fn') { li.className = 'muted'; li.textContent = 'Cloud Function: exit within 5-min cooldown → logged in feed, no push'; animating = false; help.textContent = 'Recorded, not pushed. GPS jitter at the edge would otherwise spam the group. Wait a minute of demo time and try again.'; return; }
        li.className = 'on';
        await wait(420);
      }
      const n = document.createElement('div'); n.className = 'notif';
      n.innerHTML = '<b>GeoGuard · now</b>Asha has left the safe zone.';
      screen.appendChild(n);
      while (screen.children.length > 4) screen.removeChild(screen.children[1]);
      help.textContent = 'Delivered with the app closed. Drag her back in, then out again to see the cooldown.';
      animating = false;
    }
    function pt(ev) {
      const r = svg.getBoundingClientRect();
      const p = ev.touches ? ev.touches[0] : ev;
      return { x: (p.clientX - r.left) / r.width * 420, y: (p.clientY - r.top) / r.height * 300 };
    }
    dot.addEventListener('pointerdown', (e) => { dragging = true; dot.setPointerCapture(e.pointerId); e.preventDefault(); });
    dot.addEventListener('pointermove', (e) => { if (!dragging) return; const p = pt(e); place(p.x, p.y); });
    dot.addEventListener('pointerup', () => { dragging = false; });
    dot.addEventListener('pointercancel', () => { dragging = false; });
    svg.addEventListener('pointerdown', (e) => { if (e.target === dot || dot.contains(e.target)) return; const p = pt(e); place(p.x, p.y); });
    dot.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
      if (!k) return; e.preventDefault(); place(x + k[0], y + k[1]);
    });
  })();

  /* ---------------- copy email ---------------- */
  (function copy() {
    const b = $('copy-mail'), out = $('copied'); if (!b) return;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('sonawanedarshan35@gmail.com'); out.textContent = 'Copied'; }
      catch (e) { out.textContent = 'Select and copy the address above'; }
      setTimeout(() => { out.textContent = ''; }, 2500);
    });
  })();
})();
