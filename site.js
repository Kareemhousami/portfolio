// What the page does: the reader that opens documents in full, the two
// sheets in the documents block, and the three live demos in "Samples of my
// work". How the page moves is in motion.js.
//
// Every demo runs real logic in the visitor's browser. Where a demo differs
// from the real system (sample data, simulated traffic, a different hash),
// the page says so next to it.

(() => {
  const root = document.documentElement;

  // ---------- The reader ----------

  const reader = document.querySelector('.reader');
  if (reader) {
    const title = reader.querySelector('#reader-title');
    const body = reader.querySelector('.reader-body');
    const download = reader.querySelector('.reader-download');
    const canModal = typeof reader.showModal === 'function';
    let openedBy = null;

    function openDocument(id, opener) {
      const template = document.getElementById(id);
      if (!template || !template.content) return;
      title.textContent = template.dataset.title || '';
      body.replaceChildren(template.content.cloneNode(true));
      if (template.dataset.download) {
        download.href = template.dataset.download;
        download.hidden = false;
      } else {
        download.hidden = true;
      }
      openedBy = opener || null;
      if (canModal) reader.showModal();
      else reader.setAttribute('open', '');
      // Focus goes to the reader itself, not to its first button, so no
      // focus ring is drawn until the keyboard is used.
      reader.focus({ preventScroll: true });
      reader.scrollTop = 0;
      root.classList.add('is-reading');
    }

    function closeDocument() {
      if (canModal && reader.open) reader.close();
      else reader.removeAttribute('open');
    }

    // Runs however the reader was closed (the button, Escape, the back key).
    function afterClose() {
      root.classList.remove('is-reading');
      // Stops a video that is still playing, and frees the pictures.
      body.replaceChildren();
      if (openedBy && document.contains(openedBy)) openedBy.focus({ preventScroll: true });
      openedBy = null;
    }

    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-open]');
      if (opener) {
        event.preventDefault();
        openDocument(opener.dataset.open, opener);
      }
    });
    reader.querySelector('.reader-close').addEventListener('click', closeDocument);
    // A click on the dark area beside the page closes the reader too.
    reader.addEventListener('click', (event) => { if (event.target === reader) closeDocument(); });
    reader.addEventListener('close', afterClose);
    if (!canModal) {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && reader.hasAttribute('open')) { closeDocument(); afterClose(); }
      });
    }
  }

  // ---------- The desk: bring a sheet to the front ----------

  const sheets = document.querySelector('.desk-sheets');
  if (sheets) {
    document.querySelectorAll('.desk [data-sheet]').forEach((item) => {
      const front = () => { sheets.dataset.front = item.dataset.sheet; };
      item.addEventListener('pointerenter', front);
      item.addEventListener('focusin', front);
    });
  }

  // ---------- Shared by the demos ----------

  const demoOf = (name) => document.querySelector(`.demo[data-demo="${name}"]`);
  const money = (amount) => `${amount < 0 ? '−' : ''}$${Math.abs(amount).toFixed(2)}`;
  const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  function randomHex(byteCount) {
    const bytes = new Uint8Array(byteCount);
    window.crypto.getRandomValues(bytes);
    return toHex(bytes);
  }
  function cell(row, text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    row.append(td);
    return td;
  }
  function wire(block, actions, after) {
    block.addEventListener('click', (event) => {
      const button = event.target.closest('[data-act]');
      const action = button && actions[button.dataset.act];
      if (!action) return;
      Promise.resolve(action()).then(after).catch(() => {});
    });
  }

  // ---------- Dion: an append-only ledger ----------

  const dionBlock = demoOf('dion');
  if (dionBlock && window.crypto && window.crypto.getRandomValues) {
    const tbody = dionBlock.querySelector('tbody');
    const totalCell = dionBlock.querySelector('[data-total]');
    const note = dionBlock.querySelector('.demo-note');
    const AMOUNTS = [4.5, 6, 8, 12, 15, 20];
    const SHOWN = 7;
    const entries = [
      { key: 'a1c4', amount: 8, kind: 'payment' },
      { key: '9e02', amount: 14.5, kind: 'payment' },
    ];
    let rejected = null;   // the key of a payment that just arrived twice
    let fresh = false;     // whether the last entry was added a moment ago
    const total = () => entries.reduce((sum, entry) => sum + entry.amount, 0);

    function draw() {
      tbody.replaceChildren();
      const first = Math.max(0, entries.length - SHOWN);
      if (first > 0) {
        const row = tbody.insertRow();
        const td = cell(row, `${first} earlier ${first === 1 ? 'entry' : 'entries'}, still on the ledger`);
        td.colSpan = 3;
      }
      entries.slice(first).forEach((entry, index) => {
        const number = first + index + 1;
        const refund = entry.kind === 'refund';
        const row = tbody.insertRow();
        if (refund) row.classList.add('is-refund');
        if (fresh && number === entries.length) row.classList.add('is-new');
        cell(row, String(number).padStart(2, '0'));
        cell(row, `${refund ? 'refund' : 'pay'} ${entry.key}`);
        cell(row, `${refund ? '' : '+'}${money(entry.amount)}`, 'num');
      });
      if (rejected) {
        const row = tbody.insertRow();
        row.className = 'is-rejected is-new';
        cell(row, '—');
        const td = cell(row, '');
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = `pay ${rejected}`;
        td.append(key, ' duplicate, ignored');
        cell(row, '$0.00', 'num');
      }
      totalCell.textContent = money(total());
      fresh = false;
    }

    wire(dionBlock, {
      pay() {
        const key = randomHex(2);
        const amount = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
        entries.push({ key, amount, kind: 'payment' });
        rejected = null;
        fresh = true;
        note.textContent = `Payment ${key} for ${money(amount)} was accepted. The total is now ${money(total())}.`;
      },
      again() {
        const last = [...entries].reverse().find((entry) => entry.kind === 'payment');
        if (!last) { note.textContent = 'Send a payment first.'; return; }
        rejected = last.key;
        note.textContent = `Payment ${last.key} arrived a second time. The ledger recognised its key and ignored it, so the total is still ${money(total())}.`;
      },
      refund() {
        const refunded = new Set(entries.filter((entry) => entry.kind === 'refund').map((entry) => entry.key));
        const last = [...entries].reverse().find((entry) => entry.kind === 'payment' && !refunded.has(entry.key));
        if (!last) { note.textContent = 'There is no payment left to refund.'; return; }
        entries.push({ key: last.key, amount: -last.amount, kind: 'refund' });
        rejected = null;
        fresh = true;
        note.textContent = `The refund for ${last.key} was added as a new entry of ${money(-last.amount)}. The original payment is still there, because nothing in the ledger is edited or erased.`;
      },
    }, draw);

    draw();
    dionBlock.hidden = false;
  }

  // ---------- Attendance: a tamper-evident chain of check-ins ----------

  const chainBlock = demoOf('attendance');
  if (chainBlock && window.crypto && window.crypto.subtle) {
    const tbody = chainBlock.querySelector('tbody');
    const note = chainBlock.querySelector('.demo-note');
    const GENESIS = '0'.repeat(64);
    const SHOWN = 6;
    const records = [];
    let broken = [];
    let original = null;   // record 1's true contents while it is tampered with
    let fresh = false;

    async function sha256(message) {
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
      return toHex(new Uint8Array(digest));
    }

    // Recomputes every fingerprint from the start and marks where the chain fails.
    async function verify() {
      let previous = GENESIS;
      let failed = false;
      const result = [];
      for (const record of records) {
        const fingerprint = await sha256(previous + record.payload);
        if (record.previous !== previous || fingerprint !== record.fingerprint) failed = true;
        result.push(failed);
        previous = fingerprint;
      }
      broken = result;
    }

    async function add(when) {
      const number = records.length + 1;
      const last = records[records.length - 1];
      const previous = last ? last.fingerprint : GENESIS;
      const payload = `${number}|${randomHex(5)}|${when.toISOString()}`;
      const fingerprint = await sha256(previous + payload);
      records.push({ payload, previous, fingerprint });
      return fingerprint;
    }

    // "2026-11-22T19:42:57.123Z" becomes "2026-11-22 19:42:57Z" (the Z means UTC).
    function stampCell(row, payload, edited) {
      const iso = payload.split('|')[2];
      const td = cell(row, '', edited ? 'is-edited' : '');
      const year = document.createElement('span');
      year.className = 'yr';
      year.textContent = iso.slice(0, 5);
      td.append(year, `${iso.slice(5, 10)} ${iso.slice(11, 19)}Z`);
    }

    function draw() {
      tbody.replaceChildren();
      const first = Math.max(0, records.length - SHOWN);
      records.forEach((record, index) => {
        // Record 1 always stays in view: it is the one that gets tampered with.
        if (index !== 0 && index < first) return;
        const row = tbody.insertRow();
        if (broken[index]) row.classList.add('is-broken');
        if (fresh && index === records.length - 1) row.classList.add('is-new');
        cell(row, String(index + 1).padStart(2, '0'));
        stampCell(row, record.payload, index === 0 && original !== null);
        cell(row, `${record.fingerprint.slice(0, 12)}…`, 'print');
        cell(row, broken[index] ? 'Fails' : 'Matches');
      });
      fresh = false;
    }

    wire(chainBlock, {
      async scan() {
        const fingerprint = await add(new Date());
        await verify();
        fresh = true;
        note.textContent = `Check-in ${records.length} was recorded and chained to the one before it. Its fingerprint starts ${fingerprint.slice(0, 8)}.`;
      },
      async tamper() {
        if (original !== null) { note.textContent = 'Record 1 has already been edited. Repair it to try again.'; return; }
        original = records[0].payload;
        records[0].payload = original.replace(/\|[^|]*$/, '|2020-01-01T00:00:00.000Z');
        await verify();
        note.textContent = 'The time on record 1 was changed. Its fingerprint no longer matches, so it and every record after it fail the check.';
      },
      async repair() {
        if (original === null) { note.textContent = 'Nothing to repair. The chain is intact.'; return; }
        records[0].payload = original;
        original = null;
        await verify();
        note.textContent = 'Record 1 was restored. Every fingerprint matches again.';
      },
    }, draw);

    // Three sample check-ins, a few minutes apart, so the chain has something to show.
    (async () => {
      const now = Date.now();
      for (const minutesAgo of [9, 6, 2]) await add(new Date(now - minutesAgo * 60000));
      await verify();
      draw();
      chainBlock.hidden = false;
    })().catch(() => {});
  }

  // ---------- Intrusion detection: too many requests inside a window ----------

  const idsBlock = demoOf('ids');
  if (idsBlock) {
    const list = idsBlock.querySelector('.traffic');
    const note = idsBlock.querySelector('.demo-note');
    const LIMIT = 10;       // requests allowed per client...
    const WINDOW = 5000;    // ...inside this many milliseconds
    const TICK = 250;
    const SCALE = 16;       // requests at the right-hand end of a bar
    // Addresses from the ranges reserved for documentation and examples.
    const clients = ['198.51.100.12', '198.51.100.47', '203.0.113.7', '192.0.2.88', '198.51.100.203']
      .map((ip) => ({ ip, hits: [], blocked: false, frozen: 0 }));
    const attacker = clients[2];
    let attacking = false;

    clients.forEach((client) => {
      const item = document.createElement('li');
      const ip = document.createElement('span');
      ip.textContent = client.ip;
      const track = document.createElement('span');
      track.className = 'track';
      const fill = document.createElement('span');
      fill.className = 'fill';
      track.append(fill);
      const count = document.createElement('span');
      count.className = 'count';
      item.append(ip, track, count);
      list.append(item);
      client.item = item;
      client.fill = fill;
      client.count = count;
    });

    function draw() {
      clients.forEach((client) => {
        const requests = client.blocked ? client.frozen : client.hits.length;
        client.fill.style.width = `${(Math.min(requests, SCALE) / SCALE) * 100}%`;
        client.count.textContent = client.blocked ? 'Blocked' : String(requests);
        client.item.classList.toggle('is-blocked', client.blocked);
      });
    }

    function tick() {
      const at = performance.now();
      for (const client of clients) {
        while (client.hits.length && at - client.hits[0] > WINDOW) client.hits.shift();
        if (client.blocked) continue;
        let requests = Math.random() < 0.2 ? 1 : 0;
        if (attacking && client === attacker) requests = 1 + (Math.random() < 0.6 ? 1 : 0);
        for (let i = 0; i < requests; i++) client.hits.push(at);
        // The detection rule itself: too many requests inside the window.
        if (client.hits.length > LIMIT) {
          client.blocked = true;
          client.frozen = client.hits.length;
          attacking = false;
          note.textContent = `Flagged and blocked ${client.ip} after ${client.frozen} requests in 5 seconds. The other clients were not affected.`;
        }
      }
      draw();
    }

    wire(idsBlock, {
      attack() {
        if (attacker.blocked) { note.textContent = 'That client is already blocked. Reset the traffic to try again.'; return; }
        attacking = true;
        note.textContent = `Client ${attacker.ip} has started hammering the login page. Watch its bar.`;
      },
      reset() {
        attacking = false;
        for (const client of clients) { client.hits = []; client.blocked = false; client.frozen = 0; }
        note.textContent = 'Traffic reset. Every client is back under the limit of 10 requests in 5 seconds.';
      },
    }, draw);

    // The traffic only runs while the demo is on screen.
    let timer = 0;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        window.clearInterval(timer);
        if (entry.isIntersecting) timer = window.setInterval(tick, TICK);
      }).observe(idsBlock);
    } else {
      timer = window.setInterval(tick, TICK);
    }

    draw();
    idsBlock.hidden = false;
  }
})();
