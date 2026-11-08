/* The four race-control labs. DOM wiring only; the simulations live in sim.js (window.Sim),
   the layout math in motion.js (window.Motion). */
export function initLabs({ reduce, setStatus }) {
  const M = window.Motion, S = window.Sim;
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /* ================= Lab 1: 20 buyers, 5 units ================= */
  (function raceLab() {
    const STATUS = 'race-status'; const stage = $('race-stage'), log = $('race-log'), verdict = $('race-verdict');
    const ordersEl = $('race-orders'), stockEl = $('race-stock'), runBtn = $('race-run');
    const N = 20, STOCK = 5;
    const SEEDS = [6, 15, 29, 63, 47, 19, 62, 71, 70, 25];
    let L = null, running = false, runIdx = 0, timers = [];
    const cars = [], where = []; // where[i] = ['grid'|'box'|'over', index]
    const slots = [];

    for (let i = 0; i < N; i++) {
      const c = el('div', 'car', String(i + 1)); c.setAttribute('aria-label', 'Buyer ' + (i + 1)); stage.appendChild(c); cars.push(c); where.push(['grid', i]);
    }
    for (let i = 0; i < 5; i++) { const sl = el('div', 'slot'); stage.insertBefore(sl, stage.firstChild); slots.push(sl); }

    function pos(i) { const [z, k] = where[i]; return z === 'grid' ? L.grid[k] : z === 'box' ? L.boxes[k] : L.overflow[k]; }
    function layout() {
      L = M.raceLayout(stage.clientWidth);
      stage.style.height = L.height + 'px';
      slots.forEach((s, k) => { const b = L.boxes[k]; s.style.cssText = 'left:' + (b.x - 3) + 'px;top:' + (b.y - 3) + 'px;width:' + (L.chipW + 6) + 'px;height:' + (L.chipH + 6) + 'px'; });
      $('z-box').style.left = L.boxesX + 'px';
      $('z-over').style.left = (L.boxesX + L.chipW + 4) + 'px';
      cars.forEach((c, i) => { const p = pos(i); c.style.width = L.chipW + 'px'; c.style.height = L.chipH + 'px'; c.style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)'; });
    }
    layout();
    new ResizeObserver(() => layout()).observe(stage);

    function move(i, zone, k) { where[i] = [zone, k]; const p = pos(i); cars[i].style.transform = 'translate3d(' + p.x + 'px,' + p.y + 'px,0)'; }
    function say(html, cls) {
      const li = el('li', cls || ''); li.innerHTML = html; log.appendChild(li);
      while (log.children.length > 7) log.removeChild(log.firstChild);
    }
    function bump(node, val, cls) { node.textContent = String(val); node.className = cls || ''; void node.offsetWidth; node.classList.add('pop'); }

    function reset() {
      timers.forEach(clearTimeout); timers = [];
      cars.forEach((c, i) => { c.className = 'car'; move(i, 'grid', i); });
      stage.classList.remove('over');
      bump(ordersEl, 0); bump(stockEl, STOCK);
      log.textContent = ''; verdict.textContent = ''; verdict.className = 'verdict';
    }

    function run() {
      if (running) return; running = true; runBtn.disabled = true;
      reset();
      const mode = document.querySelector('input[name="race-mode"]:checked').value;
      const res = S.race({ mode, buyers: N, stock: STOCK, seed: SEEDS[runIdx++ % SEEDS.length] });
      setStatus(STATUS, 'Session live', 'live');
      const scale = reduce ? 0 : 3600;
      let placed = 0, last = 0;
      say('<b>RACE CONTROL</b> ' + (mode === 'naive' ? 'Each buyer reads stock, then writes stock − 1' : 'Each buyer runs UPDATE … WHERE stock >= 1'));
      for (const e of res.events) {
        const at = 250 + e.t * scale; last = Math.max(last, at);
        timers.push(setTimeout(() => {
          const c = cars[e.buyer], n = e.buyer + 1;
          if (e.type === 'read') { c.classList.add('req'); say('<b>CAR ' + n + '</b> SELECT stock → ' + e.stockSeen); }
          else if (e.type === 'request') { c.classList.add('req'); say('<b>CAR ' + n + '</b> UPDATE … WHERE stock >= 1'); }
          else if (e.type === 'order') {
            c.classList.remove('req'); placed++;
            if (placed <= STOCK) { c.classList.add('won'); move(e.buyer, 'box', placed - 1); }
            else { c.classList.add('phantom'); move(e.buyer, 'over', placed - STOCK - 1); stage.classList.add('over'); }
            bump(ordersEl, placed, placed > STOCK ? 'bad' : '');
            bump(stockEl, e.stockAfter);
            if (mode === 'naive') say('<b>CAR ' + n + '</b> UPDATE stock = ' + e.stockAfter + ' (saw ' + e.stockSeen + ')' + (placed > STOCK ? ' · phantom unit' : ''), placed > STOCK ? 'bad' : 'ok');
            else say('<b>CAR ' + n + '</b> 1 row updated → order ' + placed, 'ok');
          } else {
            c.classList.remove('req'); c.classList.add('rej');
            say('<b>CAR ' + n + '</b> ' + (mode === 'naive' ? 'saw 0 → out of stock → 409' : '0 rows → 409 Conflict'));
          }
        }, at));
      }
      timers.push(setTimeout(() => {
        const over = res.orders - STOCK;
        if (over > 0) {
          verdict.className = 'verdict bad';
          verdict.innerHTML = '<strong>' + res.orders + ' orders for ' + STOCK + ' units.</strong> ' + over + ' customers paid for stock that does not exist, because each request trusted a number it read a moment earlier. Switch to Conditional UPDATE and run it again.';
          setStatus(STATUS, 'Oversold', 'bad');
        } else {
          verdict.className = 'verdict good';
          verdict.innerHTML = '<strong>Exactly ' + STOCK + ' orders, ' + res.rejected + ' clean rejections.</strong> The database decides in one atomic statement; zero affected rows rolls the whole order back.';
          ordersEl.className = 'good'; stockEl.className = 'good';
          setStatus(STATUS, 'Clean session', '');
        }
        running = false; runBtn.disabled = false; runBtn.textContent = 'Run again';
      }, last + 700));
    }
    runBtn.addEventListener('click', run);
    document.querySelectorAll('input[name="race-mode"]').forEach((r) => r.addEventListener('change', () => { if (!running) reset(); }));
  })();

  /* ================= Lab 2: idempotent payments ================= */
  (function payLab() {
    const road = $('pay-road'), wire = $('pay-wire'), stmt = $('pay-stmt'), verdict = $('pay-verdict');
    const STATUS = 'pay-status'; const btn = $('pay-run'), keyBox = $('pay-key'), chargesEl = $('pay-charges');
    let busy = false;
    function drive(node, from, to, ms, easing) {
      if (reduce) { node.style.transform = 'translate3d(' + to + 'px,0,0)'; return Promise.resolve(); }
      const a = node.animate([{ transform: 'translate3d(' + from + 'px,0,0)' }, { transform: 'translate3d(' + to + 'px,0,0)' }], { duration: ms, easing: easing || 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      return a.finished;
    }
    function line(attempt, html, cls) {
      const li = el('li'); li.appendChild(el('b', cls || null, attempt)); const sp = el('span', cls || null); sp.innerHTML = html; li.appendChild(sp); wire.appendChild(li);
    }
    async function run() {
      if (busy) return; busy = true; btn.disabled = true;
      wire.textContent = ''; stmt.textContent = ''; verdict.textContent = ''; verdict.className = 'verdict'; road.textContent = '';
      chargesEl.textContent = '0 charges';
      setStatus(STATUS, 'Session live', 'live');
      const useKey = keyBox.checked;
      const server = S.paymentServer();
      const r = S.payWithRetries(server, { useKey, amount: 49900, lostResponses: 2, key: 'idem-7f3a9c' });
      const w = road.clientWidth;
      for (const a of r.attempts) {
        const req = el('div', 'pkt', useKey ? 'POST · key 7f3a' : 'POST /pay'); road.appendChild(req);
        const reqW = req.offsetWidth;
        line('Attempt ' + a.attempt, 'POST /payments ₹499' + (useKey ? ' <code>Idempotency-Key: idem-7f3a9c</code>' : ''));
        await drive(req, 0, w - reqW - 12, 650);
        const soFar = useKey ? 1 : a.attempt; // the server has charged this many times by now
        chargesEl.textContent = soFar + (soFar === 1 ? ' charge' : ' charges');
        req.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce ? 1 : 200, fill: 'forwards' });
        const back = el('div', 'pkt back', a.replayed ? '201 replayed' : '201 Paid'); road.appendChild(back);
        const bw = back.offsetWidth;
        if (a.lost) {
          await drive(back, 0, -(w - bw - 12) * 0.5, 420, 'cubic-bezier(.4,0,1,1)');
          back.classList.add('lost'); back.textContent = '✕ radio lost';
          if (!reduce) back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 250, fill: 'forwards' });
          line('timeout', 'server answered <code>' + a.status + '</code>' + (a.replayed ? ' (replayed)' : ' (charged ' + esc(a.chargeId) + ')') + ', but the phone never heard it. Retrying…', 'lost');
          await wait(380);
        } else {
          await drive(back, 0, -(w - bw - 12), 650);
          line(String(a.status), a.replayed ? '<code>Idempotent-Replayed: true</code>: same stored response, no new charge' : 'Paid. Charge ' + esc(a.chargeId), a.replayed ? 'replay' : '');
        }
        await wait(200);
      }
      const n = server.charges.length;
      chargesEl.textContent = n + (n === 1 ? ' charge' : ' charges');
      server.charges.forEach((c) => { const row = el('div', 'stmt-row'); row.appendChild(el('span', null, c.id + ' · card ending 4417')); row.appendChild(el('span', null, S.inr(c.amount))); stmt.appendChild(row); });
      const tot = el('div', 'stmt-row total ' + (n > 1 ? 'bad' : 'good')); tot.appendChild(el('span', null, 'Charged to customer')); tot.appendChild(el('span', null, S.inr(n * 49900))); stmt.appendChild(tot);
      if (n > 1) {
        verdict.className = 'verdict bad';
        verdict.innerHTML = '<strong>Charged ' + n + ' times for one order.</strong> Every retry looked like a new payment. Flip the switch and pay again.';
        setStatus(STATUS, 'Double charge', 'bad');
      } else {
        verdict.className = 'verdict good';
        verdict.innerHTML = '<strong>Charged once.</strong> The key, the user and a SHA-256 of the body are stored with the first response in the same transaction. Retries get that response back; the same key with a different amount gets 422.';
        setStatus(STATUS, 'Clean session', '');
      }
      busy = false; btn.disabled = false;
    }
    btn.addEventListener('click', run);
  })();

  /* ================= Lab 3: ledger ================= */
  (function ledgerLab() {
    const STATUS = 'ledger-status'; const acctsEl = $('accts'), tbody = $('journal'), notice = $('ledger-notice'), pendingEl = $('pending');
    const NAMES = { asha: 'Asha', ravi: 'Ravi', CASH_VAULT: 'Cash vault (GL)' };
    let L;
    function fresh() { L = S.ledger({ accounts: { asha: 1000000, ravi: 200000 }, approvalThreshold: 500000 }); }
    function say(kind, html) { notice.innerHTML = '<p class="notice' + (kind === 'bad' ? ' bad' : '') + '">' + html + '</p>'; }
    function lb(text, cls, fn, label) { const b = el('button', 'linkbtn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (label) b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; }

    function render() {
      acctsEl.textContent = '';
      for (const a of L.accounts()) {
        const d = el('div', 'acct'); const held = L.held(a);
        d.appendChild(el('span', null, NAMES[a])); d.appendChild(el('b', null, S.inr(L.balance(a))));
        const av = el('span', null, 'available ' + S.inr(L.available(a)));
        if (held) { av.appendChild(document.createTextNode(' · ')); av.appendChild(el('span', 'held', 'on hold ' + S.inr(held))); }
        d.appendChild(av); acctsEl.appendChild(d);
      }
      pendingEl.textContent = '';
      for (const t of L.transfers()) {
        if (t.status !== 'PENDING_APPROVAL') continue;
        const row = el('div'); row.appendChild(el('span', null, t.id + ' ' + NAMES[t.from] + ' → ' + NAMES[t.to] + ' ' + S.inr(t.amount) + ' awaits a checker.'));
        row.appendChild(lb('Approve as ' + NAMES[t.by], null, () => { try { L.approve(t.id, t.by); } catch (e) { say('bad', '<code>403</code> ' + esc(e.message) + '. The server checks the raiser\'s id against the approver\'s token, not a UI flag.'); } render(); }));
        row.appendChild(lb('Approve as Checker', null, () => { const r = L.approve(t.id, 'checker'); say('ok', 'Posted as ' + esc(r.journal) + '. The hold is released and the ledger balance moves only now.'); render(); }));
        pendingEl.appendChild(row);
      }
      tbody.textContent = '';
      const journals = L.journals(), entries = L.entries();
      for (const e of entries) {
        const j = journals.find((x) => x.id === e.journal);
        const tr = el('tr'); if (j.type === 'REVERSAL') tr.className = 'rev';
        const firstLeg = entries.find((x) => x.journal === e.journal).id === e.id;
        const td1 = el('td');
        if (firstLeg) { td1.appendChild(document.createTextNode(e.journal + ' ')); td1.appendChild(el('span', 'jt', j.type.toLowerCase() + (j.reversalOf ? ' of ' + j.reversalOf : ''))); }
        tr.appendChild(td1); tr.appendChild(el('td', null, NAMES[e.account]));
        tr.appendChild(el('td', 'num', e.side === 'D' ? S.inr(e.amount) : '')); tr.appendChild(el('td', 'num', e.side === 'C' ? S.inr(e.amount) : ''));
        const act = el('td', 'act');
        act.appendChild(lb('Edit', 'danger', () => {
          try { L.update(e.id, { amount: 1 }); } catch (err) {
            say('bad', '<code>ERROR: ' + esc(err.message) + '</code><br>In core-banking-ledger this is a PostgreSQL trigger on <code>ledger_entry</code>, so even someone with a psql shell cannot quietly change history.');
          }
        }, 'Try to edit entry ' + e.id));
        if (firstLeg && j.type === 'TRANSFER' && !journals.some((x) => x.reversalOf === j.id)) {
          act.appendChild(lb('Reverse', null, () => { const r = L.reverse(j.id, 'teller'); say('ok', 'Posted ' + esc(r.journal) + ', a mirror-image journal linked by <code>reversal_of</code>. The original stays, the books still balance, and a unique constraint means it can only be reversed once.'); render(); }));
        }
        tr.appendChild(act); tbody.appendChild(tr);
      }
      const tb = L.trialBalance();
      $('tb-d').textContent = S.inr(tb.debits); $('tb-c').textContent = S.inr(tb.credits);
      const st = $('tb-stamp'); st.textContent = ''; st.appendChild(el('span', 'stamp' + (tb.balanced ? '' : ' bad'), tb.balanced ? 'Balanced' : 'Off'));
      setStatus(STATUS, tb.balanced ? 'Books balanced' : 'Books off', tb.balanced ? '' : 'bad');
      const sc = tbody.parentElement.parentElement; sc.scrollTop = sc.scrollHeight;
    }

    document.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => {
      const op = b.dataset.op;
      try {
        if (op === 'reset') { fresh(); say('ok', 'Fresh books. Opening balances are themselves journals against the cash vault, so the trial balance starts balanced.'); }
        if (op === 't1') { const r = L.transfer({ from: 'asha', to: 'ravi', amount: 150000, by: 'asha' }); r.status === 'POSTED' ? say('ok', 'Posted ' + r.journal + ': debit Asha, credit Ravi, one transaction. Both balance rows were locked in ascending id order first.') : say('bad', '<code>422</code> ' + esc(r.reason) + '.'); }
        if (op === 't2') { const r = L.transfer({ from: 'ravi', to: 'asha', amount: 300000, by: 'ravi' }); r.status === 'POSTED' ? say('ok', 'Posted ' + r.journal + '.') : say('bad', '<code>422 INSUFFICIENT_FUNDS</code> Nothing was written. The FAILED transfer row is kept for audit; the ledger is untouched.'); }
        if (op === 'big') { const r = L.transfer({ from: 'asha', to: 'ravi', amount: 600000, by: 'asha' }); r.status === 'PENDING_APPROVAL' ? say('ok', '<code>202 Accepted</code> Above ₹5,000 a transfer needs a second pair of eyes. ₹6,000 is now on hold: Asha\'s available balance dropped, her ledger balance did not.') : say('bad', '<code>422</code> ' + esc(r.reason || r.status) + '.'); }
        if (op === 'bad') { L.post('MANUAL', [{ account: 'asha', side: 'D', amount: 100000 }, { account: 'ravi', side: 'C', amount: 99900 }]); }
      } catch (e) {
        say('bad', '<code>' + esc(e.message) + '</code><br><code>PostingService</code> sums the legs before anything touches the database. Debits ₹1,000, credits ₹999: refused.');
      }
      render();
    }));
    fresh(); render();
  })();

  /* ================= Lab 4: geofence ================= */
  (function geoLab() {
    const svg = $('geo-map'), dot = $('geo-dot'), halo = $('geo-halo'), carEl = $('geo-car'), name = $('geo-name');
    const STATUS = 'geo-status'; const screen = $('geo-screen'), pipe = $('geo-pipe'), help = $('geo-help');
    const CX = 200, CY = 150, R = 95, GREEN = '#F0F1FA', RED = '#FF5A1F';
    const g = S.geofence({ cx: CX, cy: CY, r: R, cooldownMs: 300000 });
    let x = 180, y = 140, simNow = 0, lastReal = performance.now(), dragging = false, animating = false;
    g.move(x, y, 0);
    const base = 10 * 60 + 42;
    setInterval(() => {
      const now = performance.now(); simNow += (now - lastReal) * 60; lastReal = now; // demo time runs 60x
      const mins = base + Math.floor(simNow / 60000);
      $('geo-clock').textContent = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    }, 1000);
    function paint(c) { halo.setAttribute('fill', c); carEl.setAttribute('fill', c); }
    function place(nx, ny) {
      x = M.clamp(nx, 12, 408); y = M.clamp(ny, 26, 288);
      [halo, carEl].forEach((c) => { c.setAttribute('cx', x); c.setAttribute('cy', y); });
      name.setAttribute('x', x); name.setAttribute('y', y - 20);
      const dist = Math.hypot(x - CX, y - CY);
      dot.setAttribute('aria-valuenow', Math.min(100, Math.round(dist / R * 50)));
      dot.setAttribute('aria-valuetext', (dist <= R ? 'inside' : 'outside') + ' the zone, ' + Math.round(dist / R * 300) + ' metres from centre');
      const res = g.move(x, y, simNow);
      if (res.transition === 'EXIT') fire(res.notify);
      if (res.transition === 'ENTER') { paint(GREEN); clearPipe(); setStatus(STATUS, 'Inside track limits', ''); help.textContent = 'Back inside. Re-entry is a transition too, but the app only alerts on EXIT.'; }
    }
    function clearPipe() { pipe.querySelectorAll('li').forEach((li) => { li.classList.remove('on', 'muted'); }); }
    async function fire(notify) {
      paint(RED); setStatus(STATUS, 'Track limits exceeded', 'bad');
      if (animating) return; animating = true; clearPipe();
      for (const s of ['os', 'worker', 'fs', 'fn', 'fcm']) {
        const li = pipe.querySelector('[data-step="' + s + '"]');
        if (!notify && s === 'fn') {
          li.classList.add('muted');
          help.textContent = 'Recorded, not pushed: this exit is inside the 5-minute cooldown, so GPS jitter at the edge cannot spam the group. Wait a minute of demo time and try again.';
          animating = false; return;
        }
        li.classList.add('on');
        await wait(330);
      }
      const n = el('div', 'notif'); n.appendChild(el('b', null, 'GeoGuard · now')); n.appendChild(document.createTextNode('Asha has left the safe zone.'));
      screen.appendChild(n);
      while (screen.children.length > 4) screen.removeChild(screen.children[1]);
      help.textContent = 'Delivered with the app closed. Drag her back in, then out again to see the cooldown.';
      animating = false;
    }
    function pt(ev) { const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 420, y: (ev.clientY - r.top) / r.height * 300 }; }
    let pending = null;
    function schedule(p) { // coalesce pointer moves to one update per frame
      const first = !pending; pending = p;
      if (first) requestAnimationFrame(() => { const q = pending; pending = null; place(q.x, q.y); });
    }
    dot.addEventListener('pointerdown', (e) => { dragging = true; dot.setPointerCapture(e.pointerId); e.preventDefault(); });
    dot.addEventListener('pointermove', (e) => { if (dragging) schedule(pt(e)); });
    dot.addEventListener('pointerup', () => { dragging = false; });
    dot.addEventListener('pointercancel', () => { dragging = false; });
    svg.addEventListener('pointerdown', (e) => { if (dot.contains(e.target)) return; const p = pt(e); place(p.x, p.y); });
    dot.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
      if (!k) return; e.preventDefault(); place(x + k[0], y + k[1]);
    });
  })();

}
