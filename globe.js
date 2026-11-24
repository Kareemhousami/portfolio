// The globe in the "Based in Beirut" tab: a real sphere drawn in 3D on a canvas,
// sharp at any screen density. A solid lit ball with a tilted axis, curved
// meridians and parallels on the near side, and Beirut marked with a pulse when it turns towards you.
// It spins slowly and a little faster while the page scrolls. With "reduce
// motion" on, it rests with Beirut facing front.
(() => {
  const canvas = document.querySelector('.globe3d');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const RAD = Math.PI / 180;
  const TILT = -23 * RAD;                    // axial tilt, leaning like the real Earth
  const VIEW_LAT = 18 * RAD;                 // we look slightly down onto the northern half
  const BEIRUT = { lat: 33.9 * RAD, lon: 35.5 * RAD };
  const MERIDIANS = 12;                      // every 30 degrees
  const PARALLELS = [-60, -30, 0, 30, 60];
  const STEP = 4 * RAD;                      // curve sampling

  let size = 0, dpr = 1, fill = '#0B0B0F', ink = '#A6CEE0', mark = '#FFFFFF';
  let spin = -BEIRUT.lon;                    // start with Beirut facing front
  let scrollSpin = 0, lastScroll = window.scrollY;
  let visible = true, last = performance.now(), raf = 0;

  // Point on the unit sphere -> screen space (x right, y down, z towards viewer).
  function project(lat, lon) {
    const l = lon + spin;
    let x = Math.cos(lat) * Math.sin(l);
    let y = Math.sin(lat);
    let z = Math.cos(lat) * Math.cos(l);
    // look down a little onto the globe
    const y1 = y * Math.cos(VIEW_LAT) - z * Math.sin(VIEW_LAT);
    const z1 = y * Math.sin(VIEW_LAT) + z * Math.cos(VIEW_LAT);
    // tilt the axis in the picture plane
    const x2 = x * Math.cos(TILT) - y1 * Math.sin(TILT);
    const y2 = x * Math.sin(TILT) + y1 * Math.cos(TILT);
    return [x2, -y2, z1];
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    size = Math.round(box.width);
    if (!size) return;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const cs = getComputedStyle(canvas);
    fill = cs.getPropertyValue('--globe-fill').trim() || fill;
    ink = cs.getPropertyValue('--globe-line').trim() || ink;
    mark = cs.getPropertyValue('--globe-mark').trim() || mark;
  }

  // Draw a curve, front half strong and back half faint, in two passes.
  function strokeCurve(points, r, c, front, width, alpha) {
    ctx.beginPath();
    let pen = false;
    for (const [x, y, z] of points) {
      const show = front ? z >= -0.02 : z < 0.02;
      if (show) {
        const px = c + x * r, py = c + y * r;
        pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        pen = true;
      } else pen = false;
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function draw(now) {
    if (!size) return;
    const W = size * dpr, c = W / 2;
    const r = c - 0.6 * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // the solid ball
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.closePath();
    ctx.globalAlpha = 1; ctx.fillStyle = fill; ctx.fill();
    ctx.clip();

    // grid on the near side, each line one smooth stroke
    ctx.strokeStyle = ink;
    for (let m = 0; m < MERIDIANS; m++) {
      const lon = (m * 360 / MERIDIANS) * RAD, pts = [];
      for (let lat = -90 * RAD; lat <= 90 * RAD + 1e-6; lat += STEP) pts.push(project(lat, lon));
      strokeCurve(pts, r, c, true, 0.85 * dpr, 0.7);
    }
    for (const p of PARALLELS) {
      const lat = p * RAD, pts = [];
      for (let lon = 0; lon <= 360 * RAD + 1e-6; lon += STEP) pts.push(project(lat, lon));
      strokeCurve(pts, r, c, true, (p === 0 ? 1.15 : 0.85) * dpr, p === 0 ? 0.95 : 0.7);
    }

    // light from the top left, shadow round the far edge: lines fade into the curve
    ctx.globalAlpha = 1;
    const light = ctx.createRadialGradient(c - r * 0.42, c - r * 0.48, 0, c - r * 0.42, c - r * 0.48, r * 1.25);
    light.addColorStop(0, 'rgba(255,255,255,0.26)');
    light.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    light.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = light; ctx.fillRect(0, 0, W, W);
    const shade = ctx.createRadialGradient(c - r * 0.2, c - r * 0.25, r * 0.5, c, c, r * 1.02);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, W);
    ctx.restore();

    // a fine rim
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.8 * dpr;
    ctx.beginPath(); ctx.arc(c, c, r - 0.4 * dpr, 0, Math.PI * 2); ctx.stroke();

    // Beirut: a bright dot and a ring that breathes outward, on the near side only
    const [bx, by, bz] = project(BEIRUT.lat, BEIRUT.lon);
    if (bz > 0) {
      const fade = Math.min(1, bz / 0.35);
      const px = c + bx * r, py = c + by * r;
      const t = calm ? 0.35 : ((now / 1800) % 1);
      ctx.strokeStyle = mark; ctx.fillStyle = mark;
      ctx.globalAlpha = fade * (1 - t) * 0.95;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.arc(px, py, (1.9 + t * 5.5) * dpr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.beginPath(); ctx.arc(px, py, 1.9 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(64, now - last); last = now;
    const y = window.scrollY;
    scrollSpin += (y - lastScroll) * 0.004;  // scrolling nudges the spin
    lastScroll = y;
    const nudge = scrollSpin * 0.12; scrollSpin -= nudge;
    spin += dt * (2 * Math.PI / 26000) + nudge;  // one turn every 26 seconds
    draw(now);
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && !calm) { last = performance.now(); lastScroll = window.scrollY; raf = requestAnimationFrame(frame); } }

  resize();
  draw(performance.now());
  window.addEventListener('resize', () => { resize(); draw(performance.now()); });
  window.matchMedia('(max-width: 45rem)').addEventListener?.('change', () => { resize(); draw(performance.now()); });
  if (calm) return;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  start();
})();
