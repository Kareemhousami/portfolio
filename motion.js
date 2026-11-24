// How the page moves: the opening, the travelling name, the menu, buttons
// that fill and lean toward the pointer, the picture that follows the pointer
// over the work list, text that arrives as it is scrolled to, and the parts
// that are tied to the scroll position.
//
// The page reads and works without any of this. With "reduce motion" switched
// on in the system settings, only the menu, the clock and the plain hovers run.

(() => {
  const root = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const STEP = 1000 / 120; // physics run in fixed steps, so they feel the same on any screen

  // ---------- The opening ----------
  // A dark sheet, a greeting in a few languages, then the sheet lifts and the
  // first screen rises into place. Once per browser tab (see the <head>).

  if (root.classList.contains('loading')) {
    const greetings = ['Hello', 'Bonjour', 'Ciao', 'Olá', 'Hallo', 'Hola', 'Merhaba', 'مرحبا'];
    const word = document.createElement('p');
    word.className = 'loader-word';
    word.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = greetings[0];
    word.append(text);
    document.body.append(word);

    const lift = () => {
      window.scrollTo(0, 0);
      root.classList.add('lifting');
      window.setTimeout(() => { root.classList.remove('loading', 'lifting'); word.remove(); }, 2400);
    };
    let index = 0;
    const next = () => {
      index += 1;
      text.textContent = greetings[index];
      if (index < greetings.length - 1) window.setTimeout(next, 150);
      else window.setTimeout(lift, 380);
    };
    window.setTimeout(() => word.classList.add('is-in'), 500);
    window.setTimeout(next, 900);
  }

  // ---------- The name travels sideways ----------
  // It crosses the screen at a steady pace, is pushed along by the scroll, and
  // turns round (easing through a standstill) when the page is scrolled back.

  const track = document.querySelector('.stage-track');
  if (track && !calm) {
    let unit = 0, travelled = 0, pace = 1, heading = 1, lastY = window.scrollY, shown = true;
    const measure = () => { unit = track.firstElementChild.getBoundingClientRect().width; };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y !== lastY) heading = y > lastY ? 1 : -1;
      lastY = y;
    }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { shown = entry.isIntersecting; }).observe(track);
    let last = performance.now();
    (function step(now) {
      const dt = Math.min(now - last, 60);
      last = now;
      if (shown && unit) {
        pace += (heading - pace) * (1 - Math.exp(-dt / 180));
        travelled += pace * (unit / 18000) * dt;         // one name every 18 seconds
        let x = -((travelled + window.scrollY * 0.4) % unit);
        if (x > 0) x -= unit;
        track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      }
      requestAnimationFrame(step);
    })(last);
  }

  // ---------- The round menu button and its panel ----------

  const menuWrap = document.querySelector('.menu-btn-wrap');
  const menu = document.querySelector('.menu-btn');
  const panel = document.querySelector('.menu-panel');
  const back = document.querySelector('.menu-back');
  if (menuWrap && menu && panel) {
    const setOpen = (open) => {
      root.classList.toggle('menu-open', open);
      menuWrap.classList.toggle('is-open', open);
      menu.setAttribute('aria-expanded', String(open));
    };
    const isOpen = () => root.classList.contains('menu-open');
    const place = () => menuWrap.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.3);
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    place();
    menu.addEventListener('click', () => setOpen(!isOpen()));
    panel.addEventListener('click', (event) => { if (event.target.closest('a, button')) setOpen(false); });
    if (back) back.addEventListener('click', () => setOpen(false));
    document.querySelectorAll('[data-menu-open]').forEach((opener) => opener.addEventListener('click', () => setOpen(true)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) { setOpen(false); menu.focus({ preventScroll: true }); }
    });

    // The dot in the panel marks the section being read.
    if ('IntersectionObserver' in window) {
      const links = new Map();
      panel.querySelectorAll('.menu-nav a[href^="#"]').forEach((link) => {
        const section = document.getElementById(link.getAttribute('href').slice(1));
        if (section) links.set(section, link);
      });
      // The plan belongs to the documents, and the last chapter to the work.
      const adopt = (id, href) => {
        const section = document.getElementById(id);
        const link = panel.querySelector('.menu-nav a[href="' + href + '"]');
        if (section && link) links.set(section, link);
      };
      adopt('plan', '#documents');
      adopt('beyond', '#work');
      const visible = new Set();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target); });
        let current = null;
        links.forEach((link, section) => { if (!current && visible.has(section)) current = link; });
        new Set(links.values()).forEach((link) => {
          if (link === current) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      links.forEach((link, section) => observer.observe(section));
    }
  }

  // ---------- Buttons: a fill that rises through, and a lean toward the pointer ----------

  document.querySelectorAll('.btn, .btn-round, .menu-btn').forEach((button) => {
    if (!button.querySelector('.btn-fill')) {
      const fill = document.createElement('span');
      fill.className = 'btn-fill';
      const label = document.createElement('span');
      label.className = 'mag-text';
      while (button.firstChild) label.append(button.firstChild);
      button.append(fill, label);
    }
    if (!pointer) return;
    button.classList.add('is-ready');
    const fill = button.querySelector('.btn-fill');
    let leaving = 0;
    button.addEventListener('mouseenter', () => {
      window.clearTimeout(leaving);
      button.classList.add('is-over');
      fill.style.transition = 'none';
      fill.style.transform = 'translate3d(0,76%,0)';   // start below...
      void fill.offsetHeight;
      fill.style.transition = 'transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)';
      fill.style.transform = 'translate3d(0,0,0)';     // ...rise to cover...
    });
    button.addEventListener('mouseleave', () => {
      fill.style.transition = 'transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)';
      fill.style.transform = 'translate3d(0,-76%,0)';  // ...and leave through the top.
      leaving = window.setTimeout(() => button.classList.remove('is-over'), 300);
    });
  });

  if (pointer && !calm && window.innerWidth > 540) {
    document.querySelectorAll('.btn:not(.small)').forEach((button) => {
      button.classList.add('magnetic');
      if (!button.dataset.strength) { button.dataset.strength = '25'; button.dataset.strengthText = '15'; }
    });
    document.querySelectorAll('.magnetic').forEach((el) => {
      const label = el.querySelector('.mag-text');
      const strength = Number(el.dataset.strength) || 20;
      const ratio = (Number(el.dataset.strengthText) || strength / 2) / strength;
      let x = 0, y = 0, vx = 0, vy = 0, tx = 0, ty = 0, inside = false, frame = 0, last = 0, owed = 0;
      const draw = () => {
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        if (label) label.style.transform = 'translate3d(' + (x * ratio).toFixed(2) + 'px,' + (y * ratio).toFixed(2) + 'px,0)';
      };
      const tick = (now) => {
        owed += Math.min(now - last, 60);
        last = now;
        while (owed >= STEP) {
          owed -= STEP;
          if (inside) {            // follow the pointer, quick at first then settling
            x += (tx - x) * 0.07; y += (ty - y) * 0.07; vx = 0; vy = 0;
          } else {                 // let go: spring back and wobble to rest
            vx += (-195 * x - 6.2 * vx) * (STEP / 1000); vy += (-195 * y - 6.2 * vy) * (STEP / 1000);
            x += vx * (STEP / 1000); y += vy * (STEP / 1000);
          }
        }
        draw();
        if (inside || Math.abs(x) + Math.abs(y) > 0.05 || Math.abs(vx) + Math.abs(vy) > 0.5) frame = requestAnimationFrame(tick);
        else { frame = 0; x = 0; y = 0; el.style.transform = ''; if (label) label.style.transform = ''; }
      };
      const wake = () => { if (!frame) { last = performance.now(); owed = 0; frame = requestAnimationFrame(tick); } };
      el.addEventListener('mousemove', (event) => {
        const box = el.getBoundingClientRect();
        // Measured from where the element rests, not from where it has leaned to.
        tx = ((event.clientX - (box.left - x)) / box.width - 0.5) * strength;
        ty = ((event.clientY - (box.top - y)) / box.height - 0.5) * strength;
        inside = true;
        wake();
      });
      el.addEventListener('mouseleave', () => { inside = false; wake(); });
    });
  }

  // ---------- The work list: a picture follows the pointer ----------

  const list = document.querySelector('.worklist');
  if (list && pointer && !calm) {
    const rows = Array.from(list.querySelectorAll('a'));
    const box = document.createElement('div');
    box.className = 'preview';
    box.setAttribute('aria-hidden', 'true');
    const strip = document.createElement('div');
    strip.className = 'preview-strip';
    rows.forEach((row) => {
      const source = row.querySelector('.work-thumb img');
      const picture = document.createElement('img');
      picture.src = source ? source.getAttribute('src') : '';
      picture.alt = '';
      strip.append(picture);
    });
    box.append(strip);
    const dot = document.createElement('div');
    dot.className = 'preview-dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.innerHTML = '<span>View</span>';
    document.body.append(box, dot);

    let mx = 0, my = 0, bx = 0, by = 0, dx = 0, dy = 0, on = false, frame = 0, last = 0, owed = 0;
    const draw = () => {
      box.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px,0) translate(-50%,-52%)';
      dot.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) translate(-50%,-60%)';
    };
    const tick = (now) => {
      owed += Math.min(now - last, 60);
      last = now;
      while (owed >= STEP) {
        owed -= STEP;
        bx += (mx - bx) / 12; by += (my - by) / 12;   // the picture trails...
        dx += (mx - dx) / 7; dy += (my - dy) / 7;     // ...the round label keeps closer.
      }
      draw();
      const settled = Math.abs(mx - bx) + Math.abs(my - by) < 0.3;
      if (on || !settled) frame = requestAnimationFrame(tick);
      else frame = 0;
    };
    const wake = () => { if (!frame) { last = performance.now(); owed = 0; frame = requestAnimationFrame(tick); } };
    document.addEventListener('mousemove', (event) => {
      mx = event.clientX; my = event.clientY;
      if (!frame && !on) { bx = dx = mx; by = dy = my; draw(); }   // idle: stay under the pointer
    }, { passive: true });
    rows.forEach((row, index) => {
      row.addEventListener('mouseenter', () => {
        on = true;
        strip.style.transform = 'translateY(' + (-index * 100 / rows.length) + '%)';
        box.classList.add('is-on');
        dot.classList.add('is-on');
        wake();
      });
      row.addEventListener('mouseleave', () => {
        on = false;
        box.classList.remove('is-on');
        dot.classList.remove('is-on');
      });
    });
  }

  // ---------- Text that arrives ----------

  if (!calm && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-in');
        // Scrolled back below the screen: reset, so it arrives again next time.
        // Under a finger the page is flicked up and down much more, so there
        // each text arrives once and stays.
        else if (pointer && entry.boundingClientRect.top > 0) entry.target.classList.remove('is-in');
      });
    }, { rootMargin: '0px 0px -6% 0px' });

    // Things that arrive once: the two sheets dealt onto the desk, pictures
    // uncovered, a rule drawn across to the round button that lands on it.
    const once = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        once.unobserve(el);
        el.classList.add('is-in');
        // Afterwards the element goes back to its everyday transitions.
        window.setTimeout(() => el.classList.remove('will-arrive', 'is-in'), 2200);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    document.querySelectorAll('.desk-sheets, .plate, figure.tile, .hang, .round-wrap').forEach((el) => {
      el.classList.add('will-arrive');
      once.observe(el);
    });

    document.querySelectorAll('[data-words]').forEach((el) => {
      const whole = el.textContent.trim().replace(/\s+/g, ' ');
      const spoken = document.createElement('span');
      spoken.className = 'sr';
      spoken.textContent = whole;
      el.textContent = '';
      el.append(spoken);
      whole.split(' ').forEach((part, i) => {
        const outer = document.createElement('span');
        outer.className = 'w';
        outer.setAttribute('aria-hidden', 'true');
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', i);
        outer.append(inner);
        el.append(outer, document.createTextNode(' '));
      });
      el.classList.add('is-split');
      seen.observe(el);
    });
    document.querySelectorAll('[data-fade]').forEach((el) => { el.classList.add('is-fade'); seen.observe(el); });
  }

  // ---------- "© Portfolio by Kareem" becomes "© Kareem Jobeily" ----------

  const credit = document.querySelector('.credit');
  if (credit) {
    const by = credit.querySelector('.credit-by');
    const lastName = credit.querySelector('.credit-last');
    const fit = () => {
      if (!by || !lastName) return;
      credit.style.setProperty('--by', (-by.getBoundingClientRect().width).toFixed(1) + 'px');
      credit.style.setProperty('--last', lastName.getBoundingClientRect().width.toFixed(1) + 'px');
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('resize', fit);
  }

  // ---------- The time in Beirut ----------

  const clock = document.querySelector('[data-beirut-time]');
  if (clock && window.Intl) {
    try {
      const format = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Beirut', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' });
      const tell = () => { clock.textContent = format.format(new Date()); };
      tell();
      window.setInterval(tell, 1000);
    } catch (error) { /* keep the fallback text */ }
  }

  // ---------- Tied to the scroll ----------

  if (!calm) {
    const stage = document.querySelector('.stage');
    const photo = document.querySelector('.stage-photo figure');
    const roleArrow = document.querySelector('.stage-role .arrow');
    const globe = document.querySelector('.globe');
    const lifted = Array.from(document.querySelectorAll('[data-lift]'));
    const curve = document.querySelector('.curve i');
    const closing = document.querySelector('.closing');
    const closingMove = document.querySelector('.closing-move');
    const closingArrow = document.querySelector('.closing-top .arrow');
    const slid = document.querySelector('[data-slide]');
    const wide = window.matchMedia('(min-width: 721px)');
    const shifts = new WeakMap();
    let waiting = false;

    const frame = () => {
      waiting = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const depth = wide.matches && pointer;   // layered movement is for large screens with a pointer

      if (stage && y < stage.offsetHeight) {
        // The portrait leaves more slowly than the page.
        if (photo) photo.style.setProperty('--drift', (depth ? y * 0.3 : 0).toFixed(1) + 'px');
        // The small arrow turns a quarter as the stage scrolls away.
        if (roleArrow) roleArrow.style.setProperty('--turn', (clamp((y - (stage.offsetHeight - vh)) / vh, 0, 1) * 90).toFixed(1) + 'deg');
        if (globe) globe.style.setProperty('--turn', (clamp(y / vh, 0, 1) * 90).toFixed(1) + 'deg');
      }

      // Round buttons travel a little faster than the text around them.
      lifted.forEach((el) => {
        if (!depth) { el.style.removeProperty('--lift'); shifts.delete(el); return; }
        const box = el.getBoundingClientRect();
        if (box.bottom < -vh || box.top > vh * 2) return;
        const before = shifts.get(el) || 0;
        const centre = box.top + box.height / 2 - before;
        const shift = (centre - vh / 2) * Number(el.dataset.lift);
        shifts.set(el, shift);
        el.style.setProperty('--lift', shift.toFixed(1) + 'px');
      });

      if (closing) {
        const box = closing.getBoundingClientRect();
        // 0 when the dark block first shows, 1 when the page has reached its end.
        const done = clamp((vh - box.top) / box.height, 0, 1);
        if (curve) curve.style.setProperty('--curve', ((1 - done) * (wide.matches ? 10 : 7.5)).toFixed(2) + 'vh');
        // The block is uncovered rather than scrolled in: its contents rise more slowly than the page.
        if (closingMove) closingMove.style.setProperty('--rise', (depth ? -(1 - done) * box.height * 0.4 : 0).toFixed(1) + 'px');
        if (slid) slid.style.setProperty('--slide', (depth ? (1 - done) * box.height * 0.1 : 0).toFixed(1) + 'px');
        if (closingArrow) closingArrow.style.setProperty('--turn', ((1 - done) * 15).toFixed(1) + 'deg');
      }
    };
    const ask = () => { if (!waiting) { waiting = true; requestAnimationFrame(frame); } };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    frame();
  }
})();
