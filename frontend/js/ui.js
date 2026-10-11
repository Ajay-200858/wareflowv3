/* =====================================================================
   WareFlow v3 — shared UI helpers (loaded on every page, before the page's own script)
   Everything hangs off one global object: window.WF
   ===================================================================== */
(function () {
  'use strict';

  const WF = (window.WF = window.WF || {});
  WF.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- shared reference data ---------- */
  WF.TYPES = {
    cold_storage_co: {
      label: 'Cold storage', icon: 'snow',
      hint: 'Food, pharma and other temperature-sensitive stock',
      roles: ['Cold storage operator', 'Quality auditor', 'Logistics staff', 'Manager']
    },
    fashion_co: {
      label: 'Fashion & apparel retail', icon: 'shirt',
      hint: 'Seasonal stock with fast-moving sizes and styles',
      roles: ['Inventory associate', 'Visual merchandiser', 'Auditor', 'Manager']
    },
    electronics_co: {
      label: 'Electronics & hardware', icon: 'chip',
      hint: 'High-value parts, devices and accessories',
      roles: ['Warehouse technician', 'QC inspector', 'Logistics staff', 'Manager']
    }
  };
  WF.SHIFTS = ['Day shift (08:00–16:00)', 'Evening shift (16:00–00:00)', 'Night shift (00:00–08:00)'];

  /* ---------- tiny helpers ---------- */
  WF.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  WF.fmtSize = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
  WF.num = (n) => new Intl.NumberFormat('en-IN').format(n);
  WF.uid = () => Math.random().toString(36).slice(2, 9);
  WF.tween = (from, to, dur, fn) => {
    if (WF.reduced) { fn(to); return; }
    const t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      fn(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  };

  /* ---------- icons (one small stroke set, used everywhere) ---------- */
  const P = {
    panel: '<rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M9 4v16"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/>',
    building: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 10h5a1 1 0 0 1 1 1v10"/><path d="M8 8h2M8 12h2M8 16h2M3 21h18"/>',
    warehouse: '<path d="M3 9l9-5 9 5v11H3z"/><path d="M8 20v-6h8v6M8 17h8"/>',
    stamp: '<path d="M8 3h8v6a2 2 0 0 1-1 1.7V13h3a2 2 0 0 1 2 2v2H5v-2a2 2 0 0 1 2-2h3v-2.3A2 2 0 0 1 9 9z"/><path d="M5 21h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 4.5 5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    snow: '<path d="M12 2v20M4.2 7l15.6 10M4.2 17L19.8 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
    shirt: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    rank: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'
  };
  WF.ic = (name, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
  WF.hydrate = (root) => {
    (root || document).querySelectorAll('i[data-icon]').forEach((el) => {
      const tpl = document.createElement('template');
      tpl.innerHTML = WF.ic(el.dataset.icon, el.className);
      el.replaceWith(tpl.content.firstChild);
    });
    (root || document).querySelectorAll('[data-logo]').forEach((el) => { el.innerHTML = WF.logo(); });
  };

  WF.logo = () =>
    '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#0E1B26"/>' +
    '<rect x="8" y="28" width="24" height="3.5" rx="1.5" fill="#F5B335"/><rect x="10" y="31.5" width="3.5" height="2.5" fill="#F5B335"/><rect x="26.5" y="31.5" width="3.5" height="2.5" fill="#F5B335"/>' +
    '<rect x="9" y="16" width="10.5" height="11" rx="1.6" fill="#8FB3C7"/><rect x="21" y="11" width="10" height="16" rx="1.6" fill="#fff"/>' +
    '<rect x="21" y="16" width="10" height="2" fill="#0E1B26" opacity=".15"/><circle cx="30" cy="11" r="3.4" fill="#F5B335"/></svg>';

  /* ---------- toasts ---------- */
  WF.toast = (msg, type, ms) => {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    type = type || 'info';
    t.className = 'toast ' + type;
    t.innerHTML = WF.ic(type === 'ok' ? 'check' : type === 'bad' ? 'alert' : 'info') + '<span>' + WF.esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 380); }, ms || 3800);
  };

  /* ---------- page change with a soft fade ---------- */
  WF.go = (url) => {
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = url; }, WF.reduced ? 0 : 260);
  };

  /* ---------- form errors ---------- */
  WF.setError = (el, msg) => {
    const f = el.closest('.field');
    if (!f) return;
    f.classList.add('invalid');
    let e = f.querySelector(':scope > .err');
    if (!e) { e = document.createElement('p'); e.className = 'err'; e.setAttribute('role', 'alert'); f.appendChild(e); }
    e.textContent = msg;
    if (el.setAttribute) el.setAttribute('aria-invalid', 'true');
    f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  };
  WF.clearError = (el) => {
    const f = el.closest('.field');
    if (!f) return;
    f.classList.remove('invalid', 'shake');
    if (el.removeAttribute) el.removeAttribute('aria-invalid');
  };
  WF.clearErrors = (root) => root.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid', 'shake'));

  /* ---------- reveal on scroll + count-up ---------- */
  let io;
  const fmtCount = (el, v) => {
    const t = Math.round(v);
    el.textContent = (el.dataset.locale === 'no' ? String(t) : WF.num(t)) + (el.dataset.suffix || '');
  };
  WF.observe = (root) => {
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          el.classList.add('in');
          if (el.dataset.count !== undefined) WF.tween(0, parseFloat(el.dataset.count) || 0, 1200, (v) => fmtCount(el, v));
          io.unobserve(el);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    }
    (root || document).querySelectorAll('[data-reveal],[data-count]').forEach((el) => {
      if (el.dataset.obs) return;
      el.dataset.obs = '1';
      if (WF.reduced) {
        el.classList.add('in');
        if (el.dataset.count !== undefined) fmtCount(el, parseFloat(el.dataset.count) || 0);
        return;
      }
      if (el.dataset.count !== undefined) fmtCount(el, 0);
      io.observe(el);
    });
  };

  /* ---------- sidebar (hide / show) ---------- */
  WF.initShell = () => {
    const root = document.documentElement;
    const mq = window.matchMedia('(max-width: 960px)');
    const toggles = document.querySelectorAll('[data-sidebar-toggle]');
    const labels = document.querySelectorAll('[data-sb-label]');

    function paint() {
      const hidden = mq.matches ? root.dataset.drawer !== 'open' : root.dataset.sidebar === 'hidden';
      toggles.forEach((b) => { b.setAttribute('aria-expanded', String(!hidden)); b.title = (hidden ? 'Show' : 'Hide') + ' sidebar  ( [ )'; });
      labels.forEach((l) => { l.textContent = hidden ? 'Show sidebar' : 'Hide sidebar'; });
    }
    function toggle() {
      if (mq.matches) {
        root.dataset.drawer = root.dataset.drawer === 'open' ? 'closed' : 'open';
      } else {
        const next = root.dataset.sidebar === 'hidden' ? 'open' : 'hidden';
        root.dataset.sidebar = next;
        try { localStorage.setItem('wf2_sidebar', next); } catch (e) { /* private mode */ }
      }
      paint();
    }
    toggles.forEach((b) => b.addEventListener('click', toggle));
    document.querySelectorAll('[data-sidebar-close]').forEach((b) => b.addEventListener('click', () => { root.dataset.drawer = 'closed'; paint(); }));
    document.querySelectorAll('.sidebar a').forEach((a) => a.addEventListener('click', () => { if (mq.matches) { root.dataset.drawer = 'closed'; paint(); } }));
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); toggle(); }
      if (e.key === 'Escape' && mq.matches && root.dataset.drawer === 'open') { root.dataset.drawer = 'closed'; paint(); }
    });
    (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => { root.dataset.drawer = 'closed'; paint(); });
    paint();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-tr')));
  };

  /* ---------- parallax warehouse scene ---------- */
  function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

  function sceneLayers() {
    const r = rng(11);
    const W = 1200, H = 800;
    const open = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';

    /* far layer: faint racks and ceiling lights */
    let back = open;
    for (let i = 0; i < 6; i++) {
      const x = 30 + i * 205;
      back += '<polygon points="' + x + ',80 ' + (x + 130) + ',80 ' + (x + 180) + ',300 ' + (x - 50) + ',300" fill="#3B7FA3" opacity=".07" class="sc-light" style="animation-delay:' + (i * 0.7) + 's"/>';
      back += '<rect x="' + x + '" y="74" width="130" height="6" rx="3" fill="#5AA3C7" opacity=".7" class="sc-light" style="animation-delay:' + (i * 0.7) + 's"/>';
    }
    for (let i = 0; i < 15; i++) {
      const x = i * 86 - 20;
      back += '<rect x="' + x + '" y="330" width="70" height="420" fill="#112637"/>';
      for (let k = 0; k < 4; k++) {
        back += '<rect x="' + x + '" y="' + (350 + k * 100) + '" width="70" height="4" fill="#1B384D"/>';
        let bx = x + 5;
        while (bx < x + 60) { const w = 12 + r() * 16; back += '<rect x="' + bx.toFixed(0) + '" y="' + (350 + k * 100 - 22).toFixed(0) + '" width="' + w.toFixed(0) + '" height="22" fill="#17334A"/>'; bx += w + 4; }
      }
    }
    back += '</svg>';

    /* middle layer: the racking bays with boxes */
    const upX = [40, 380, 720, 1060];
    const beamY = [270, 430, 590];
    const bases = [270, 430, 590, 740];
    const palette = ['#8FA9B8', '#B7C8D2', '#DCE6EC', '#6F8CA0', '#A3B9C6'];
    let mid = open;
    let flag = null;
    let n = 0;
    let boxes = '';
    for (let b = 0; b < 3; b++) {
      bases.forEach((base, li) => {
        let cx = upX[b] + 24;
        while (cx < upX[b + 1] - 60) {
          const w = 58 + r() * 52, h = 54 + r() * 64;
          if (r() < 0.14) { cx += w + 12; continue; }
          const y = base - h;
          const col = palette[Math.floor(r() * palette.length)];
          const isFlag = b === 1 && li === 1 && !flag;
          if (isFlag) flag = { x: cx, y, w, h };
          boxes += '<g class="sc-box" style="--i:' + n++ + '"><rect x="' + cx.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '" rx="3" fill="' + col + '"' + (isFlag ? ' stroke="#E5573F" stroke-width="4"' : '') + '/>' +
            '<rect x="' + (cx + w / 2 - 4).toFixed(0) + '" y="' + y.toFixed(0) + '" width="8" height="' + h.toFixed(0) + '" fill="#0E1B26" opacity=".12"/></g>';
          cx += w + 10 + r() * 14;
        }
      });
    }
    upX.forEach((x) => { mid += '<rect x="' + x + '" y="120" width="14" height="620" fill="#2F6F8F"/><rect x="' + (x + 10) + '" y="120" width="4" height="620" fill="#245A75"/>'; });
    for (let b = 0; b < 3; b++) beamY.forEach((y) => { mid += '<rect x="' + (upX[b] + 14) + '" y="' + y + '" width="' + (upX[b + 1] - upX[b] - 14) + '" height="12" fill="#F5B335"/><rect x="' + (upX[b] + 14) + '" y="' + (y + 9) + '" width="' + (upX[b + 1] - upX[b] - 14) + '" height="3" fill="#C98A12"/>'; });
    mid += boxes;
    if (flag) {
      const fx = flag.x + flag.w / 2, fy = flag.y;
      mid += '<g class="sc-tag"><rect x="' + (fx - 74) + '" y="' + (fy - 50) + '" width="148" height="34" rx="10" fill="#fff"/><polygon points="' + (fx - 8) + ',' + (fy - 16) + ' ' + (fx + 8) + ',' + (fy - 16) + ' ' + fx + ',' + (fy - 6) + '" fill="#fff"/>' +
        '<circle cx="' + (fx - 54) + '" cy="' + (fy - 33) + '" r="5" fill="#E5573F"/><text x="' + (fx - 42) + '" y="' + (fy - 28) + '" font-family="Instrument Sans, Segoe UI, sans-serif" font-size="14" font-weight="600" fill="#12202C">Expires in 2 days</text></g>';
      mid += '<circle class="sc-ping" cx="' + (flag.x + flag.w - 8) + '" cy="' + (flag.y + 10) + '" r="7" fill="#E5573F"/><circle cx="' + (flag.x + flag.w - 8) + '" cy="' + (flag.y + 10) + '" r="6" fill="#E5573F"/>';
    }
    mid += '</svg>';

    /* near layer: floor, painted line, foreground pallet */
    let front = open;
    front += '<rect x="0" y="738" width="1200" height="70" fill="#0A141D"/>';
    front += '<rect x="0" y="764" width="1200" height="7" fill="#F5B335" opacity=".92"/>';
    for (let i = 0; i < 12; i++) front += '<rect x="' + (i * 110 + 20) + '" y="786" width="58" height="4" fill="#F5B335" opacity=".4"/>';
    front += '<g class="sc-box" style="--i:40"><rect x="930" y="716" width="220" height="16" fill="#5B5546"/><rect x="930" y="732" width="30" height="16" fill="#4A4538"/><rect x="1120" y="732" width="30" height="16" fill="#4A4538"/><rect x="1015" y="732" width="30" height="16" fill="#4A4538"/>' +
      '<rect x="944" y="626" width="92" height="90" rx="3" fill="#B7C8D2"/><rect x="1044" y="646" width="94" height="70" rx="3" fill="#8FA9B8"/><rect x="984" y="626" width="8" height="90" fill="#0E1B26" opacity=".12"/></g>';
    front += '</svg>';

    return [{ svg: back, d: 0.12 }, { svg: mid, d: 0.42 }, { svg: front, d: 0.95 }];
  }

  WF.scene = (el) => {
    if (!el || el.dataset.sceneInit === '1') return;
    el.dataset.sceneInit = '1';

    const layers = sceneLayers().map((l) => {
      const d = document.createElement('div');
      d.className = 'layer';
      d.innerHTML = l.svg;
      el.appendChild(d);
      return { el: d, d: l.d };
    });
    if (WF.reduced) return;
    const host = el.closest('[data-scene-host]') || el.parentElement;
    const useScroll = el.hasAttribute('data-scroll');
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true;

    function frame() {
      raf = 0;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      const s = useScroll ? Math.min(Math.max(window.scrollY, 0), 520) : 0;
      layers.forEach((l) => {
        l.el.style.transform = 'translate3d(' + (-cx * l.d * 24).toFixed(2) + 'px,' + (-cy * l.d * 14 + s * l.d * 0.25).toFixed(2) + 'px,0)';
      });
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) kick();
    }
    function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      kick();
    });
    host.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
    if (useScroll) window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', () => { if (visible) kick(); }, { passive: true });
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) kick(); }).observe(host);
    kick();
  };

  WF.recalculateScenes = () => {
    document.querySelectorAll('[data-scene]').forEach((el) => {
      if (!el.dataset.sceneInit) WF.scene(el);
    });
  };

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    WF.hydrate();
    document.querySelectorAll('[data-scene]').forEach(WF.scene);
    if (document.querySelector('.sidebar')) WF.initShell();
    /* one frame later, so a page script can draw its content before we start watching it */
    requestAnimationFrame(() => WF.observe());
  });
})();
