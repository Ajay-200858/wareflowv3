/* =====================================================================
   WareFlow v3 — overview page
   Reads the saved company record and works out every number on screen
   (totals, shares, readiness) so nothing is hard-coded.
   ===================================================================== */
(function () {
  'use strict';
  const WF = window.WF;
  const $ = (id) => document.getElementById(id);
  const esc = WF.esc;

  document.addEventListener('DOMContentLoaded', () => {
    const ctx = WF.requireAuth();
    if (!ctx) return;
    const { user } = ctx;
    const c = ctx.company || {};
    const type = WF.TYPES[user.type] || WF.TYPES.cold_storage_co;
    const name = c.name || user.companyName || 'Your company';
    const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
    const has = (v) => String(v == null ? '' : v).trim().length > 0;

    /* shell */
    $('sbCompany').textContent = name;
    $('sbType').textContent = type.label;
    $('sbAvatar').textContent = name.charAt(0).toUpperCase();
    $('userEmail').textContent = user.email;

    /* clean data */
    const whs = (c.warehouses || []).filter((w) => has(w.location) || Number(w.capacity) > 0);
    const emps = (c.employees || []).filter((e) => has(e.name) || has(e.email));
    const docs = c.docs || [];
    const submitted = c.status === 'pending_review';
    const when = (t) => new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const unitName = { sqft: 'sq ft', pallets: 'pallets' };

    /* hero */
    $('dTitle').textContent = name;
    $('dStatus').textContent = submitted ? 'Under review' : 'Draft, not submitted';
    $('dSub').textContent = submitted
      ? 'Submitted ' + when(c.submittedAt || c.updatedAt) + '. Our team checks these details before your model is set up.'
      : "You haven't submitted yet. Finish the missing items below, then send it for review.";
    if (!submitted) $('dStatus').classList.remove('live');

    /* nothing saved at all */
    const empty = !has(c.gstin) && !has(c.address) && !whs.length && !emps.length && !c.seal && !docs.length;
    if (empty) {
      $('content').innerHTML =
        '<div class="emptystate" data-reveal><h2>Nothing to review yet</h2><p>Add your company details and this page will fill in with totals, your team and what is missing.</p>' +
        '<a class="btn btn-primary" href="onboarding.html">' + WF.ic('arrow') + 'Start company setup</a></div>';
      return;
    }

    /* totals */
    const sum = (u) => whs.filter((w) => w.unit === u).reduce((a, w) => a + (Number(w.capacity) || 0), 0);
    const totals = { sqft: sum('sqft'), pallets: sum('pallets') };
    const capMain = totals.sqft ? { v: totals.sqft, u: 'sq ft' } : totals.pallets ? { v: totals.pallets, u: 'pallets' } : { v: 0, u: 'sq ft' };
    const capSub = totals.sqft && totals.pallets ? '+ ' + WF.num(totals.pallets) + ' pallets' : whs.length ? 'across ' + whs.length + (whs.length === 1 ? ' site' : ' sites') : 'no sites yet';
    const roleCount = {};
    emps.forEach((e) => { roleCount[e.role] = (roleCount[e.role] || 0) + 1; });
    const roleRows = Object.keys(roleCount).map((r) => [r, roleCount[r]]).sort((a, b) => b[1] - a[1]);

    /* KPIs */
    const kpi = (icon, label, value, unit, sub, d) =>
      '<div class="kpi" data-reveal style="--d:' + d + 's"><span>' + WF.ic(icon) + label + '</span><b><span data-count="' + value + '">0</span>' + (unit ? '<em>' + unit + '</em>' : '') + '</b><small>' + esc(sub) + '</small></div>';
    $('kpis').innerHTML =
      kpi('warehouse', 'Warehouses', whs.length, '', whs.length === 1 ? 'site connected' : 'sites connected', 0.1) +
      kpi('grid', 'Total capacity', capMain.v, capMain.u, capSub, 0.18) +
      kpi('users', 'Team members', emps.length, '', roleRows.length + (roleRows.length === 1 ? ' role' : ' roles'), 0.26) +
      kpi('file', 'Documents', docs.length, '', docs.length ? 'file names on record' : 'none added yet', 0.34);

    /* readiness */
    const items = [
      { label: 'Company profile', ok: has(c.name || name) && has(c.gstin) && has(c.address), to: 's1' },
      { label: 'Warehouse sites', ok: whs.length > 0 && whs.every((w) => has(w.location) && Number(w.capacity) > 0), to: 's1' },
      { label: 'Official seal', ok: !!c.seal, to: 's2' },
      { label: 'Team roster', ok: emps.length > 0 && emps.every((e) => has(e.name) && emailOk(e.email)), to: 's3' },
      { label: 'Compliance documents', ok: docs.length > 0, to: 's4' }
    ];
    const done = items.filter((i) => i.ok).length;
    const pct = Math.round((done / items.length) * 100);
    const missing = items.length - done;
    $('readiness').innerHTML =
      '<div class="ring-wrap"><svg class="ring light ring-tie" viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="34" pathLength="100"/><circle class="ring-arc" cx="40" cy="40" r="34" pathLength="100" style="--off:' + (100 - pct) + '"/></svg><b><span data-count="' + pct + '" data-locale="no">0</span><small>%</small></b></div>' +
      '<div><h3>' + (missing ? missing + (missing === 1 ? ' item' : ' items') + ' still to add' : 'Everything is on file') + '</h3>' +
      '<p>' + (missing ? 'Tap an item to jump straight to it.' : 'Nothing is missing. Your team can review it whenever they’re ready.') + '</p>' +
      '<ul class="checks">' + items.map((i) => i.ok
        ? '<li><span class="yes">' + WF.ic('check') + esc(i.label) + '</span></li>'
        : '<li><a class="no" href="onboarding.html#' + i.to + '">' + WF.ic('plus') + esc(i.label) + '</a></li>').join('') + '</ul></div>';

    /* warehouses */
    $('sites').innerHTML =
      '<div class="card-h"><h3>' + WF.ic('warehouse') + 'Warehouse network</h3><a href="onboarding.html#s1">Edit</a></div>' +
      (whs.length
        ? '<ul class="wh-list">' + whs.map((w) => {
            const t = totals[w.unit] || 0;
            const share = t ? Math.round((Number(w.capacity) / t) * 100) : 0;
            return '<li class="wh-item"><span class="pin">' + WF.ic('pin') + '</span><div><b>' + esc(w.location || 'Unnamed site') + '</b><div class="bar ' + (w.unit === 'pallets' ? 'beam' : '') + '" title="' + share + '% of your ' + unitName[w.unit] + '"><i style="--w:' + share + '%"></i></div></div><span class="val">' + WF.num(Number(w.capacity) || 0) + ' ' + (unitName[w.unit] || '') + '</span></li>';
          }).join('') + '</ul>'
        : '<p class="hint">No sites added yet.</p>');

    /* team */
    const shortShift = (s) => String(s || '').split(' (')[0];
    const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
    $('team').innerHTML =
      '<div class="card-h"><h3>' + WF.ic('users') + 'Team &amp; roles</h3><a href="onboarding.html#s3">Edit</a></div>' +
      (emps.length
        ? '<ul class="roles">' + roleRows.map((r) => '<li><div><b>' + esc(r[0]) + '</b><span>' + r[1] + ' of ' + emps.length + '</span></div><div class="bar"><i style="--w:' + Math.round((r[1] / emps.length) * 100) + '%"></i></div></li>').join('') + '</ul>' +
          '<div class="people">' + emps.slice(0, 5).map((e) => '<div class="person"><span class="avatar">' + esc(initials(e.name)) + '</span><div><b>' + esc(e.name || 'Unnamed') + '</b><small>' + esc(e.email) + '</small></div><small>' + esc(shortShift(e.shift)) + '</small></div>').join('') +
          (emps.length > 5 ? '<p class="hint">+ ' + (emps.length - 5) + ' more</p>' : '') + '</div>'
        : '<p class="hint">No team members added yet.</p>');

    /* profile */
    $('profileCard').innerHTML =
      '<div class="card-h"><h3>' + WF.ic('building') + 'Company profile</h3><a href="onboarding.html#s1">Edit</a></div>' +
      '<dl class="dl"><div><dt>Registered name</dt><dd>' + esc(name) + '</dd></div><div><dt>Warehouse type</dt><dd>' + esc(type.label) + '</dd></div><div><dt>GSTIN or tax ID</dt><dd>' + (has(c.gstin) ? esc(c.gstin) : '<span class="hint">Not added</span>') + '</dd></div><div><dt>Head office</dt><dd>' + (has(c.address) ? esc(c.address) : '<span class="hint">Not added</span>') + '</dd></div><div><dt>Admin email</dt><dd>' + esc(user.email) + '</dd></div></dl>';

    /* seal */
    $('sealCard').innerHTML =
      '<div class="card-h"><h3>' + WF.ic('stamp') + 'Official seal</h3><a href="onboarding.html#s2">' + (c.seal ? 'Replace' : 'Add') + '</a></div>' +
      '<div class="seal-show">' + (c.seal ? '<img src="' + esc(c.seal) + '" alt="Company seal">' : '<span>No seal uploaded yet</span>') + '</div>';

    /* documents */
    const extOf = (n) => (String(n).split('.').pop() || '').toLowerCase();
    $('docsCard').innerHTML =
      '<div class="card-h"><h3>' + WF.ic('file') + 'Documents</h3><a href="onboarding.html#s4">Manage</a></div>' +
      (docs.length
        ? '<ul class="docs" style="margin:0">' + docs.map((d) => { const e = extOf(d.name); return '<li class="doc"><span class="ext ' + (e === 'pdf' ? 'pdf' : /png|jpe?g/.test(e) ? 'img' : '') + '">' + esc(e.slice(0, 4)) + '</span><div><b title="' + esc(d.name) + '">' + esc(d.name) + '</b><small>' + WF.fmtSize(d.size || 0) + '</small></div></li>'; }).join('') + '</ul>'
        : '<p class="hint">No documents yet. They’re optional for now.</p>');

    /* what happens next */
    const steps = [
      ['Submit your details', 'Everything on this page, sent to our team.'],
      ['Team review', 'We check your details and documents.'],
      ['Model set-up', 'Your urgency model is configured for a ' + type.label.toLowerCase() + ' warehouse.'],
      ['Live monitoring', 'Products are ranked and alerts start flowing.']
    ];
    const now = submitted ? 1 : 0;
    $('nextCard').innerHTML =
      '<div class="card-h"><h3>What happens next</h3></div><ol class="tl">' + steps.map((s, i) =>
        '<li class="' + (i < now ? 'done' : i === now ? 'now' : '') + '"><span class="dot">' + (i < now ? WF.ic('check') : i + 1) + '</span><div><b>' + s[0] + '</b><small>' + s[1] + '</small></div></li>').join('') + '</ol>';

    WF.observe();

    /* jump links glide to their card */
    document.querySelectorAll('.sidebar a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: WF.reduced ? 'auto' : 'smooth', block: 'start' });
    }));
  });
})();
