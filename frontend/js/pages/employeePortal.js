/* =====================================================================
   WareFlow v3 — Employee Portal & Dashboard Module
   Full-featured Employee Dashboard for WareFlow Warehouse Management System
   ===================================================================== */

window.pages = window.pages || {};

(function() {
  'use strict';

  const api = () => window.apiClient.employee;

  const formatCurrency = function(amount) {
    if (typeof window.formatCurrency === 'function') {
      return window.formatCurrency(amount);
    }
    const num = Number(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(isNaN(num) ? 0 : num);
  };

  // Helper for formatting dates
  function fmtDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch(e) {
      return isoStr;
    }
  }

  function fmtTime(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch(e) {
      return isoStr;
    }
  }

  function getPriorityBadge(priority) {
    const p = parseInt(priority) || 1;
    if (p >= 3) return `<span class="status-badge status-cancelled">High Priority</span>`;
    if (p === 2) return `<span class="status-badge status-pending">Medium</span>`;
    return `<span class="status-badge" style="background:#f1f5f9; color:#475569;">Normal</span>`;
  }

  function getStatusBadge(st) {
    const s = (st || '').toUpperCase();
    if (s === 'COMPLETED') return `<span class="status-badge status-completed">Completed</span>`;
    if (s === 'STARTED' || s === 'IN_PROGRESS') return `<span class="status-badge status-in-progress">In Progress</span>`;
    if (s === 'ACCEPTED') return `<span class="status-badge status-new">Accepted</span>`;
    if (s === 'ASSIGNED') return `<span class="status-badge status-pending">Assigned</span>`;
    if (s === 'REJECTED') return `<span class="status-badge status-error">Rejected</span>`;
    return `<span class="status-badge">${st}</span>`;
  }

  /* =====================================================================
     1. EMPLOYEE OVERVIEW DASHBOARD (#employee-overview)
     ===================================================================== */
  window.pages.employeeOverview = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align:center; padding: 40px;">
        <i data-icon="spark" style="font-size:2rem; animation: pulse 1.5s infinite;"></i>
        <p style="margin-top:12px; color:var(--ink-2)">Loading your employee workspace...</p>
      </div>
    `;

    try {
      const data = await api().getDashboard();
      const emp = data.employee;
      const kpis = data.kpis;
      const att = data.attendance;
      const sal = data.salary;
      const prog = data.today_progress;
      const todayWork = data.today_work || [];
      const recentComp = data.recent_completed || [];
      const recentNotifs = data.recent_notifications || [];
      const perf = data.performance || {};

      container.innerHTML = `
        <div class="dt-container">
          <!-- Hero Header -->
          <section class="hero" data-scene-host style="min-height: 140px; padding: 1.75rem 2rem; border-radius: var(--r-md); background: linear-gradient(135deg, #0E1B26 0%, #16293A 100%); color: white; margin-bottom: 1.5rem; position: relative; overflow: hidden;">
            <div style="position:relative; z-index:2; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <span class="chip" style="background: rgba(245, 179, 53, 0.2); color: #F5B335; border: 1px solid rgba(245, 179, 53, 0.4); margin-bottom: 0.5rem; display: inline-flex;">
                  ${emp.role_type}
                </span>
                <h1 style="margin: 0; font-size: 1.85rem; color: #fff;">Welcome back, ${emp.name}</h1>
                <p style="margin-top: 0.35rem; color: #94a3b8; font-size: 0.95rem;">
                  You have <b style="color:#fff;">${kpis.assigned_jobs} active job${kpis.assigned_jobs === 1 ? '' : 's'}</b> today &bull; Workload: <b>${emp.workload_minutes} mins</b>
                </p>
              </div>

              <div style="display: flex; gap: 10px; align-items: center;">
                <button class="btn ${att.is_checked_in ? 'btn-secondary' : 'btn-primary'}" id="btn-quick-attendance">
                  <i data-icon="panel"></i> ${att.is_checked_in ? 'Clock Out' : 'Clock In'}
                </button>
                <button class="btn btn-secondary" onclick="window.router.navigate('#employee-jobs')">
                  <i data-icon="check"></i> View All Jobs
                </button>
              </div>
            </div>
          </section>

          <!-- 7 Core KPI Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.75rem;">
            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">My Assigned Jobs</span>
                <i data-icon="check" style="color:var(--cold)"></i>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: var(--ink); margin-top: 0.5rem;" class="tabular">${kpis.assigned_jobs}</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.25rem;">Active tasks on floor</div>
            </div>

            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Pending Jobs</span>
                <i data-icon="alert" style="color:var(--beam)"></i>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: #d97706; margin-top: 0.5rem;" class="tabular">${kpis.pending_jobs}</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.25rem;">Awaiting your start</div>
            </div>

            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Completed Jobs</span>
                <i data-icon="stamp" style="color:var(--ok)"></i>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: var(--ok); margin-top: 0.5rem;" class="tabular">${kpis.completed_jobs}</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.25rem;">Total fulfilled tasks</div>
            </div>

            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Today's Progress</span>
                <i data-icon="rank" style="color:var(--cold)"></i>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: var(--cold); margin-top: 0.5rem;" class="tabular">${prog.rate}%</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.25rem;">${prog.completed} done &bull; ${prog.remaining} left</div>
            </div>

            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Today's Attendance</span>
                <i data-icon="pin" style="color:#6366f1"></i>
              </div>
              <div style="margin-top: 0.5rem;">
                <span class="status-badge ${att.is_checked_in ? 'status-completed' : (att.status === 'NOT_CHECKED_IN' ? 'status-new' : 'status-in-progress')}">
                  ${att.is_checked_in ? 'Checked In' : att.status}
                </span>
              </div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.4rem;">
                ${att.check_in ? fmtTime(att.check_in) : 'Not clocked in today'}
              </div>
            </div>

            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Salary Summary</span>
                <i data-icon="file" style="color:var(--beam-deep)"></i>
              </div>
              <div style="font-size: 1.75rem; font-weight: 700; color: var(--ink); margin-top: 0.5rem;" class="tabular">
                ${window.formatCurrency(sal.total_amount)}
              </div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.25rem;">
                Period: <b>${sal.period}</b> &bull; ${sal.status}
              </div>
            </div>

            <div class="card" style="padding: 1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Notifications</span>
                <i data-icon="bell" style="color:#e11d48"></i>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: ${kpis.unread_notifications > 0 ? '#e11d48' : 'var(--ink)'}; margin-top: 0.5rem;" class="tabular">
                ${kpis.unread_notifications}
              </div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:0.25rem;">Unread messages</div>
            </div>
          </div>

          <!-- Main Layout Grid -->
          <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 1.5rem; align-items: start;">
            <!-- Left Column: Assigned Work & Tasks -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div class="card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <h3 style="margin: 0; font-size: 1.25rem;">Today's Assigned Work</h3>
                  <a href="#employee-jobs" style="font-size: 0.85rem; font-weight: 600;">View All &rarr;</a>
                </div>

                ${todayWork.length === 0 ? `
                  <div class="emptystate" style="padding: 2.5rem 1rem; text-align: center;">
                    <i data-icon="check" style="font-size: 2.5rem; color: #94a3b8; display: block; margin-bottom: 0.5rem;"></i>
                    <p style="color: var(--ink-2);">No active jobs right now. You are all caught up!</p>
                  </div>
                ` : `
                  <div class="wf-table-wrap">
                    <table class="wf-table">
                      <thead>
                        <tr>
                          <th>Job ID</th>
                          <th>Type</th>
                          <th>Location / Item</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${todayWork.map(j => `
                          <tr>
                            <td><b>#${j.id}</b></td>
                            <td><span class="chip" style="font-size:0.75rem;">${j.type}</span></td>
                            <td>
                              <div style="font-size:0.9rem; font-weight:600;">${j.position_code ? 'Pos: ' + j.position_code : 'Warehouse Floor'}</div>
                              <div style="font-size:0.75rem; color:var(--ink-3);">${j.product_name || 'Standard Order Item'}</div>
                            </td>
                            <td>${getPriorityBadge(j.priority)}</td>
                            <td>${getStatusBadge(j.status)}</td>
                            <td>
                              <div style="display:flex; gap:6px;">
                                ${j.status === 'ASSIGNED' ? `
                                  <button class="btn btn-sm btn-primary" onclick="window.pages.employeeJobs.accept(${j.id})">Accept</button>
                                  <button class="btn btn-sm btn-ghost" style="color:var(--bad);" onclick="window.pages.employeeJobs.promptReject(${j.id})">Reject</button>
                                ` : ''}
                                ${j.status === 'ACCEPTED' ? `
                                  <button class="btn btn-sm btn-primary" onclick="window.pages.employeeJobs.start(${j.id})">Start</button>
                                ` : ''}
                                ${j.status === 'STARTED' ? `
                                  <button class="btn btn-sm btn-primary" onclick="window.pages.employeeJobs.complete(${j.id})">Complete</button>
                                ` : ''}
                                <button class="btn btn-sm btn-secondary" onclick="window.pages.employeeJobs.viewDetails(${j.id})">Details</button>
                              </div>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              </div>

              <!-- Recent Completed Work -->
              <div class="card" style="padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Recent Completed Jobs</h3>
                ${recentComp.length === 0 ? `
                  <p style="color:var(--ink-3); font-size:0.9rem;">No completed jobs recorded yet.</p>
                ` : `
                  <div class="wf-table-wrap">
                    <table class="wf-table">
                      <thead>
                        <tr>
                          <th>Job ID</th>
                          <th>Task Type</th>
                          <th>Completed At</th>
                          <th>Order Ref</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${recentComp.map(j => `
                          <tr>
                            <td><b>#${j.id}</b></td>
                            <td>${j.type}</td>
                            <td>${fmtDate(j.completed_at)}</td>
                            <td>${j.order_id ? 'ORD-' + j.order_id : 'Standard'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `}
              </div>
            </div>

            <!-- Right Column: Performance, AI Assistance & Notifications -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <!-- Personal Performance Card -->
              <div class="card" style="padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Personal Performance</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                  <div style="background: #f8fafc; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2);">
                    <div style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">Accuracy Rate</div>
                    <div style="font-size: 1.6rem; font-weight: 700; color: var(--ok); margin-top: 4px;" class="tabular">
                      ${Math.round(perf.accuracy * 100)}%
                    </div>
                  </div>
                  <div style="background: #f8fafc; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2);">
                    <div style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">On-Time Rate</div>
                    <div style="font-size: 1.6rem; font-weight: 700; color: var(--cold); margin-top: 4px;" class="tabular">
                      ${Math.round(perf.on_time_rate * 100)}%
                    </div>
                  </div>
                </div>

                <div style="margin-top: 1rem;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: var(--ink-2); display: block; margin-bottom: 0.5rem;">
                    Completed Tasks by Type
                  </span>
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${Object.entries(perf.job_types || {}).length === 0 ? `
                      <p style="font-size: 0.85rem; color: var(--ink-3);">No completed task distribution recorded.</p>
                    ` : Object.entries(perf.job_types).map(([type, count]) => `
                      <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                        <span>${type}</span>
                        <b class="tabular">${count} jobs</b>
                      </div>
                      <div style="background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden;">
                        <div style="background: var(--cold); height: 100%; width: ${Math.min(100, count * 5)}%;"></div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              <!-- Recent Notifications Card -->
              <div class="card" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <h3 style="margin: 0; font-size: 1.25rem;">Recent Notifications</h3>
                  <a href="#employee-notifications" style="font-size: 0.85rem; font-weight: 600;">View All &rarr;</a>
                </div>

                ${recentNotifs.length === 0 ? `
                  <p style="font-size: 0.85rem; color: var(--ink-3);">No new notifications.</p>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${recentNotifs.map(n => `
                      <div style="padding: 0.75rem; border-radius: var(--r-sm); background: ${n.is_read ? '#f8fafc' : '#eff6ff'}; border: 1px solid ${n.is_read ? 'var(--line-2)' : '#bfdbfe'};">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                          <b style="font-size: 0.85rem; color: var(--ink);">${n.title}</b>
                          <span style="font-size: 0.75rem; color: var(--ink-3);">${fmtTime(n.created_at)}</span>
                        </div>
                        <p style="font-size: 0.8rem; color: var(--ink-2); margin-top: 4px;">${n.message}</p>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      `;

      // Wire quick attendance button
      const qBtn = container.querySelector('#btn-quick-attendance');
      if (qBtn) {
        qBtn.addEventListener('click', async () => {
          try {
            qBtn.disabled = true;
            if (att.is_checked_in) {
              await api().checkOut();
              window.WF.toast('Clocked out successfully.', 'ok');
            } else {
              await api().checkIn();
              window.WF.toast('Clocked in successfully. Have a safe shift!', 'ok');
            }
            window.pages.employeeOverview(container);
          } catch(e) {
            window.WF.toast(e.message || 'Attendance action failed', 'bad');
            qBtn.disabled = false;
          }
        });
      }

    } catch (err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          <h3>Error loading employee overview</h3>
          <p>${err.message}</p>
          <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="window.pages.employeeOverview(document.getElementById('router-view'))">Retry</button>
        </div>
      `;
    }
  };


  /* =====================================================================
     2. MY JOBS (#employee-jobs)
     ===================================================================== */
  window.pages.employeeJobs = async function(container) {
    let currentFilter = 'ALL';

    async function renderJobs() {
      container.innerHTML = `
        <div class="dt-container">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
            <div>
              <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink);">My Assigned Jobs</h1>
              <p style="margin-top: 0.25rem; color: var(--ink-2);">View, accept, start and complete your warehouse assignments.</p>
            </div>
            <button class="btn btn-secondary" onclick="window.pages.employeeJobs(document.getElementById('router-view'))">
              <i data-icon="panel"></i> Refresh
            </button>
          </div>

          <!-- Filter Navigation Tabs -->
          <div class="segmented" id="jobs-filter-bar" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-sm ${currentFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}" data-filter="ALL">All Jobs</button>
            <button class="btn btn-sm ${currentFilter === 'PENDING' ? 'btn-primary' : 'btn-ghost'}" data-filter="PENDING">Pending (Assigned)</button>
            <button class="btn btn-sm ${currentFilter === 'ACCEPTED' ? 'btn-primary' : 'btn-ghost'}" data-filter="ACCEPTED">Accepted</button>
            <button class="btn btn-sm ${currentFilter === 'STARTED' ? 'btn-primary' : 'btn-ghost'}" data-filter="STARTED">In Progress</button>
            <button class="btn btn-sm ${currentFilter === 'COMPLETED' ? 'btn-primary' : 'btn-ghost'}" data-filter="COMPLETED">Completed</button>
            <button class="btn btn-sm ${currentFilter === 'REJECTED' ? 'btn-primary' : 'btn-ghost'}" data-filter="REJECTED">Rejected</button>
          </div>

          <!-- Jobs Container -->
          <div id="jobs-list-wrap">
            <div class="panel" style="text-align: center; padding: 40px;">Loading assignments...</div>
          </div>
        </div>

        <!-- Job Details Modal Host -->
        <div id="job-modal-host"></div>
      `;

      // Wire filter bar
      container.querySelectorAll('#jobs-filter-bar button').forEach(btn => {
        btn.addEventListener('click', () => {
          currentFilter = btn.dataset.filter;
          renderJobs();
        });
      });

      try {
        const jobs = await api().getJobs(currentFilter);
        const listWrap = container.querySelector('#jobs-list-wrap');

        if (!jobs || jobs.length === 0) {
          listWrap.innerHTML = `
            <div class="card" style="padding: 3rem; text-align: center;">
              <i data-icon="check" style="font-size: 3rem; color: #94a3b8; display: block; margin-bottom: 0.5rem;"></i>
              <h3 style="margin: 0; color: var(--ink);">No Jobs Found</h3>
              <p style="color: var(--ink-2); margin-top: 0.25rem;">No assignments matching status <b>${currentFilter}</b>.</p>
            </div>
          `;
          return;
        }

        listWrap.innerHTML = `
          <div class="wf-table-wrap">
            <table class="wf-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Type</th>
                  <th>Warehouse / Location</th>
                  <th>Order Ref</th>
                  <th>Items</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${jobs.map(j => {
                  const firstItem = j.items && j.items[0];
                  let locStr = 'Main Floor';
                  if (firstItem && firstItem.position_code) {
                    locStr = `${firstItem.zone_name || 'Zone'} &rarr; ${firstItem.rack_label || 'Rack'} &rarr; <b>${firstItem.position_code}</b>`;
                  }
                  return `
                    <tr>
                      <td><b>#${j.id}</b></td>
                      <td><span class="chip" style="font-size:0.8rem;">${j.type}</span></td>
                      <td><div style="font-size:0.85rem;">${locStr}</div></td>
                      <td>${j.order_ref || 'Standard'}</td>
                      <td>${j.items_count} item${j.items_count === 1 ? '' : 's'}</td>
                      <td>${getPriorityBadge(j.priority)}</td>
                      <td>${getStatusBadge(j.status)}</td>
                      <td>${fmtDate(j.created_at)}</td>
                      <td>
                        <div style="display:flex; gap:6px;">
                          ${j.status === 'ASSIGNED' ? `
                            <button class="btn btn-sm btn-primary" onclick="window.pages.employeeJobs.accept(${j.id})">Accept</button>
                            <button class="btn btn-sm btn-ghost" style="color:var(--bad);" onclick="window.pages.employeeJobs.promptReject(${j.id})">Reject</button>
                          ` : ''}
                          ${j.status === 'ACCEPTED' ? `
                            <button class="btn btn-sm btn-primary" onclick="window.pages.employeeJobs.start(${j.id})">Start</button>
                          ` : ''}
                          ${j.status === 'STARTED' ? `
                            <button class="btn btn-sm btn-primary" onclick="window.pages.employeeJobs.complete(${j.id})">Complete</button>
                          ` : ''}
                          <button class="btn btn-sm btn-secondary" onclick="window.pages.employeeJobs.viewDetails(${j.id})">Details</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch(err) {
        container.querySelector('#jobs-list-wrap').innerHTML = `
          <div class="panel" style="color: var(--bad); padding: 1.5rem;">
            Failed to load jobs: ${err.message}
          </div>
        `;
      }
    }

    renderJobs();
  };

  // Job Actions
  window.pages.employeeJobs.accept = async function(id) {
    try {
      await api().acceptJob(id);
      window.WF.toast(`Job #${id} accepted. You can now start the work.`, 'ok');
      window.pages.employeeJobs(document.getElementById('router-view'));
    } catch(e) {
      window.WF.toast(e.message || 'Failed to accept job', 'bad');
    }
  };

  window.pages.employeeJobs.start = async function(id) {
    try {
      await api().startJob(id);
      window.WF.toast(`Job #${id} started. Timer running.`, 'ok');
      window.pages.employeeJobs(document.getElementById('router-view'));
    } catch(e) {
      window.WF.toast(e.message || 'Failed to start job', 'bad');
    }
  };

  window.pages.employeeJobs.complete = async function(id) {
    if (!confirm(`Mark Job #${id} as completed? Inventory records and order workflow will update automatically.`)) return;
    try {
      await api().completeJob(id);
      window.WF.toast(`Job #${id} completed successfully!`, 'ok');
      window.pages.employeeJobs(document.getElementById('router-view'));
    } catch(e) {
      window.WF.toast(e.message || 'Failed to complete job', 'bad');
    }
  };

  window.pages.employeeJobs.promptReject = function(id) {
    const reason = prompt(`Please provide mandatory reason for rejecting Job #${id} (will notify manager):`);
    if (reason === null) return;
    if (!reason.trim()) {
      window.WF.toast('Rejection cancelled: reason cannot be empty.', 'bad');
      return;
    }
    (async () => {
      try {
        await api().rejectJob(id, reason.trim());
        window.WF.toast(`Job #${id} rejected. AI re-assignment initiated.`, 'ok');
        window.pages.employeeJobs(document.getElementById('router-view'));
      } catch(e) {
        window.WF.toast(e.message || 'Failed to reject job', 'bad');
      }
    })();
  };

  window.pages.employeeJobs.viewDetails = async function(id) {
    const modalHost = document.getElementById('job-modal-host') || document.body;
    try {
      const job = await api().getJob(id);
      const modalEl = document.createElement('div');
      modalEl.className = 'modal-overlay';
      modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; justify-content:center; align-items:center; padding:1.5rem;';
      
      modalEl.innerHTML = `
        <div class="card" style="width: 650px; max-width: 100%; max-height: 90vh; overflow-y: auto; background: #fff; padding: 2rem; border-radius: var(--r-md);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1.25rem;">
            <div>
              <span class="chip" style="margin-bottom:0.35rem;">${job.type}</span>
              <h2 style="margin: 0; font-size: 1.5rem;">Job #${job.id} Details</h2>
            </div>
            <button class="btn btn-ghost btn-sm" id="btn-close-job-modal">&times;</button>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; background:#f8fafc; padding:1rem; border-radius:var(--r-sm);">
            <div><span style="font-size:0.8rem; color:var(--ink-2)">Status:</span> <div>${getStatusBadge(job.status)}</div></div>
            <div><span style="font-size:0.8rem; color:var(--ink-2)">Priority:</span> <div>${getPriorityBadge(job.priority)}</div></div>
            <div><span style="font-size:0.8rem; color:var(--ink-2)">Order Reference:</span> <b>${job.order ? job.order.reference : 'Standard'}</b></div>
            <div><span style="font-size:0.8rem; color:var(--ink-2)">Estimated Duration:</span> <b>${job.estimated_duration} mins</b></div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.5rem 0;">Work Instructions</h4>
            <p style="font-size: 0.9rem; color: var(--ink-2); background: #fdf6ec; border-left: 3px solid #f59e0b; padding: 0.75rem 1rem;">
              ${job.instructions}
            </p>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.5rem 0;">Items & Storage Locations</h4>
            <div class="wf-table-wrap">
              <table class="wf-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Target Position</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${job.items.map(it => `
                    <tr>
                      <td><b>${it.product_name}</b></td>
                      <td><code>${it.product_sku || '—'}</code></td>
                      <td><b>${it.quantity}</b></td>
                      <td><span class="chip" style="font-size:0.75rem;">${it.position_code || 'Floor'}</span></td>
                      <td>${getStatusBadge(it.status)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top: 1.5rem; border-top: 1px solid var(--line-2); padding-top: 1rem;">
            <button class="btn btn-secondary" id="btn-close-modal-bottom">Close</button>
            ${job.status === 'ASSIGNED' ? `<button class="btn btn-primary" onclick="window.pages.employeeJobs.accept(${job.id}); document.querySelector('.modal-overlay').remove();">Accept Job</button>` : ''}
            ${job.status === 'ACCEPTED' ? `<button class="btn btn-primary" onclick="window.pages.employeeJobs.start(${job.id}); document.querySelector('.modal-overlay').remove();">Start Job</button>` : ''}
            ${job.status === 'STARTED' ? `<button class="btn btn-primary" onclick="window.pages.employeeJobs.complete(${job.id}); document.querySelector('.modal-overlay').remove();">Complete Job</button>` : ''}
          </div>
        </div>
      `;

      modalHost.appendChild(modalEl);
      modalEl.querySelector('#btn-close-job-modal').addEventListener('click', () => modalEl.remove());
      modalEl.querySelector('#btn-close-modal-bottom').addEventListener('click', () => modalEl.remove());
      modalEl.addEventListener('click', (e) => { if (e.target === modalEl) modalEl.remove(); });
    } catch(e) {
      window.WF.toast(e.message || 'Could not load job details', 'bad');
    }
  };


  /* =====================================================================
     3. MY WORKSPACE & WAREHOUSE MAP (#employee-workspace)
     ===================================================================== */
  window.pages.employeeWorkspace = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align: center; padding: 40px;">Loading your workspace layout...</div>
    `;

    try {
      const data = await api().getWorkspace();
      const warehouses = data.warehouses || [];
      const directives = data.directives || [];

      if (warehouses.length === 0) {
        container.innerHTML = `
          <div class="dt-container">
            <div class="card" style="padding: 3rem; text-align: center;">
              <i data-icon="warehouse" style="font-size: 3rem; color: #94a3b8; display: block; margin-bottom: 0.5rem;"></i>
              <h3>No Assigned Warehouse</h3>
              <p style="color:var(--ink-2);">You do not currently have physical storage locations assigned to your active tasks.</p>
            </div>
          </div>
        `;
        return;
      }

      const currentWh = warehouses[0];

      container.innerHTML = `
        <div class="dt-container">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
            <div>
              <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink);">My Warehouse Workspace</h1>
              <p style="margin-top: 0.25rem; color: var(--ink-2);">
                Spatial view of facility: <b>${currentWh.name}</b> &bull; Assigned Target Positions: <b style="color:var(--ok)">${data.target_positions_count}</b>
              </p>
            </div>
            <button class="btn btn-secondary" onclick="window.pages.employeeWorkspace(document.getElementById('router-view'))">
              <i data-icon="panel"></i> Refresh Map
            </button>
          </div>

          <!-- Step-by-Step Task Navigation Directives -->
          <div class="card" style="padding: 1.5rem; margin-bottom: 1.75rem; border-left: 4px solid var(--cold);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
              <h3 style="margin: 0; font-size: 1.15rem; display:flex; align-items:center; gap:8px;">
                <i data-icon="pin" style="color:var(--cold);"></i> Active Task Travel Directives
              </h3>
              <span class="chip" style="font-size:0.75rem;">Optimized Route</span>
            </div>

            ${directives.length === 0 ? `
              <p style="color:var(--ink-3); font-size:0.9rem;">No active travel directives right now. Accept jobs to receive step-by-step warehouse directions.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${directives.map(d => `
                  <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:0.75rem 1rem; border-radius:var(--r-sm); border:1px solid var(--line-2);">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <span style="background:var(--cold); color:#fff; font-weight:700; border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem;">
                        ${d.step}
                      </span>
                      <span style="font-size:0.9rem; font-weight:600; color:var(--ink);">${d.instruction}</span>
                    </div>
                    <div>
                      <button class="btn btn-sm btn-secondary" onclick="window.pages.employeeJobs.viewDetails(${d.job_id})">View Job</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Interactive 2D Spatial Layout -->
          <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
              <h3 style="margin: 0; font-size: 1.25rem;">Warehouse Zones & Racks</h3>
              <div style="display:flex; gap:16px; font-size:0.8rem;">
                <span style="display:flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; background:#22c55e; border-radius:2px; display:inline-block;"></span> Your Assigned Position</span>
                <span style="display:flex; align-items:center; gap:6px;"><span style="width:12px; height:12px; background:#e2e8f0; border-radius:2px; display:inline-block;"></span> Other Storage</span>
              </div>
            </div>

            <!-- Zones and Racks Grid -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              ${currentWh.zones.map(z => `
                <div style="background: #f8fafc; border: 1.5px solid var(--line); border-radius: var(--r-md); padding: 1.25rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <b style="font-size: 1.1rem; color: var(--ink);">${z.name}</b>
                    <span class="chip" style="font-size:0.75rem;">${z.racks.length} Racks</span>
                  </div>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                    ${z.racks.map(rk => `
                      <div class="card" style="padding: 1rem; border: ${rk.has_assignment ? '2px solid #22c55e' : '1px solid var(--line-2)'}; background: #fff;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                          <b style="font-size: 0.95rem;">Rack: ${rk.label}</b>
                          ${rk.has_assignment ? `<span class="status-badge status-completed" style="font-size:0.7rem;">Active Task</span>` : ''}
                        </div>

                        <!-- Positions in rack -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 6px;">
                          ${rk.positions.map(p => `
                            <div style="
                              padding: 6px 4px;
                              text-align: center;
                              border-radius: 4px;
                              font-size: 0.75rem;
                              font-weight: 600;
                              cursor: pointer;
                              background: ${p.is_assigned_to_me ? '#dcfce7' : '#f1f5f9'};
                              color: ${p.is_assigned_to_me ? '#15803d' : '#475569'};
                              border: 1px solid ${p.is_assigned_to_me ? '#86efac' : '#cbd5e1'};
                            " title="${p.code} (Occupancy: ${p.occupancy}/${p.capacity})"
                            onclick="${p.is_assigned_to_me ? `window.pages.employeeJobs.viewDetails(${p.assignment_details.job_id})` : ''}">
                              ${p.code}
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch(err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          Failed to load warehouse workspace: ${err.message}
        </div>
      `;
    }
  };


  /* =====================================================================
     4. MY SALARY (#employee-salary)
     ===================================================================== */
  window.pages.employeeSalary = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align: center; padding: 40px;">Loading salary records...</div>
    `;

    try {
      const data = await api().getSalary();
      const current = data.current_salary;
      const rule = data.salary_rule;
      const history = data.history || [];

      container.innerHTML = `
        <div class="dt-container">
          <div style="margin-bottom: 1.5rem;">
            <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink);">My Salary & Earnings</h1>
            <p style="margin-top: 0.25rem; color: var(--ink-2);">Transparent overview of current period earnings, piece-rate breakdown and pay records.</p>
          </div>

          <!-- Current Pay Period Card -->
          <div class="card" style="padding: 2rem; margin-bottom: 1.75rem; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <span class="chip" style="margin-bottom: 0.5rem;">Current Pay Period: ${data.current_period}</span>
                <div style="font-size: 2.75rem; font-weight: 800; color: var(--ink);" class="tabular">
                  ${window.formatCurrency(current.total_amount)}
                </div>
                <div style="font-size: 0.9rem; color: var(--ink-2); margin-top: 4px;">
                  Status: <b>${getStatusBadge(current.status)}</b>
                </div>
              </div>

              ${!data.has_record ? `
                <div style="background: #fef3c7; border: 1px solid #fde68a; padding: 1rem; border-radius: var(--r-sm); max-width: 320px; font-size: 0.85rem; color: #92400e;">
                  <b>Payroll in Progress:</b> Formal monthly payroll has not yet been locked by management. Earnings reflect current completed floor work.
                </div>
              ` : ''}
            </div>

            <!-- Breakdown Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
              <div style="background: #fff; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2);">
                <span style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">Base Salary</span>
                <div style="font-size: 1.4rem; font-weight: 700; color: var(--ink); margin-top: 4px;" class="tabular">
                  ${window.formatCurrency(current.base_amount || 0)}
                </div>
              </div>
              <div style="background: #fff; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2);">
                <span style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">Piece-Rate / Work Completed</span>
                <div style="font-size: 1.4rem; font-weight: 700; color: var(--cold); margin-top: 4px;" class="tabular">
                  ${window.formatCurrency(current.piece_rate_amount || 0)}
                </div>
              </div>
              <div style="background: #fff; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2);">
                <span style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">Overtime</span>
                <div style="font-size: 1.4rem; font-weight: 700; color: var(--ok); margin-top: 4px;" class="tabular">
                  ${window.formatCurrency(current.overtime_amount || 0)}
                </div>
              </div>
              <div style="background: #fff; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2);">
                <span style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">Bonuses & Adjustments</span>
                <div style="font-size: 1.4rem; font-weight: 700; color: var(--ink); margin-top: 4px;" class="tabular">
                  ${window.formatCurrency((current.bonus || 0) + (current.adjustments || 0))}
                </div>
              </div>
            </div>
          </div>

          <!-- Company Salary Formula Card -->
          ${rule ? `
            <div class="card" style="padding: 1.5rem; margin-bottom: 1.75rem;">
              <h3 style="margin: 0 0 0.75rem 0; font-size: 1.15rem;">Salary Calculation Model (${rule.salary_model})</h3>
              <p style="font-size: 0.85rem; color: var(--ink-2); margin-bottom: 1rem;">
                Based on your registered role of <b>${rule.role_type}</b>, your compensation is computed according to company rules:
              </p>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; font-size: 0.85rem;">
                <div style="padding: 0.75rem; background: #f8fafc; border-radius: var(--r-sm);">
                  Base Rate: <b>${window.formatCurrency(rule.base_salary)}</b> / month
                </div>
                <div style="padding: 0.75rem; background: #f8fafc; border-radius: var(--r-sm);">
                  Picking Rate: <b>${window.formatCurrency(rule.picking_rate)}</b> / completed job
                </div>
                <div style="padding: 0.75rem; background: #f8fafc; border-radius: var(--r-sm);">
                  Packing Rate: <b>${window.formatCurrency(rule.packing_rate)}</b> / completed job
                </div>
                <div style="padding: 0.75rem; background: #f8fafc; border-radius: var(--r-sm);">
                  Overtime Rate: <b>${window.formatCurrency(rule.overtime_rate)}</b> / hour
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Historical Pay Records Table -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Payment History</h3>
            ${history.length === 0 ? `
              <p style="color:var(--ink-3); font-size:0.9rem;">No archived payslip records for previous periods yet.</p>
            ` : `
              <div class="wf-table-wrap">
                <table class="wf-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Base Amount</th>
                      <th>Piece-Rate</th>
                      <th>Overtime</th>
                      <th>Bonus/Adj</th>
                      <th>Total Gross</th>
                      <th>Status</th>
                      <th>Generated Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${history.map(r => `
                      <tr>
                        <td><b>${r.period}</b></td>
                        <td class="tabular">${window.formatCurrency(r.base_amount)}</td>
                        <td class="tabular">${window.formatCurrency(r.piece_rate_amount)}</td>
                        <td class="tabular">${window.formatCurrency(r.overtime_amount)}</td>
                        <td class="tabular">${window.formatCurrency(r.bonus + r.adjustments)}</td>
                        <td class="tabular"><b>${window.formatCurrency(r.total_amount)}</b></td>
                        <td>${getStatusBadge(r.status)}</td>
                        <td>${fmtDate(r.created_at)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
    } catch(err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          Failed to load salary details: ${err.message}
        </div>
      `;
    }
  };


  /* =====================================================================
     5. MY ATTENDANCE & SHIFTS (#employee-attendance)
     ===================================================================== */
  window.pages.employeeAttendance = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align: center; padding: 40px;">Loading attendance records...</div>
    `;

    try {
      const data = await api().getAttendance();
      const today = data.today;
      const summary = data.summary;
      const history = data.history || [];

      container.innerHTML = `
        <div class="dt-container">
          <div style="margin-bottom: 1.5rem;">
            <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink);">My Attendance & Working Hours</h1>
            <p style="margin-top: 0.25rem; color: var(--ink-2);">Log your daily shifts, track check-in timestamps, and view your verified floor working hours.</p>
          </div>

          <!-- Today's Clock In/Out Widget -->
          <div class="card" style="padding: 2rem; margin-bottom: 1.75rem; background: #fff; border: 1px solid var(--line);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
              <div>
                <span class="chip" style="margin-bottom:0.5rem;">Today's Shift</span>
                <h2 style="margin:0; font-size:1.75rem; color:var(--ink);">
                  Status: ${getStatusBadge(today.is_checked_in ? 'CHECKED_IN' : today.status)}
                </h2>
                <p style="margin-top:0.4rem; color:var(--ink-2); font-size:0.95rem;">
                  Check-In: <b>${fmtTime(today.check_in)}</b> &bull; Check-Out: <b>${fmtTime(today.check_out)}</b> &bull; Working Hours: <b class="tabular">${today.working_hours} hrs</b>
                </p>
              </div>

              <div style="display: flex; gap: 12px;">
                <button class="btn btn-primary" id="btn-clock-in" ${today.is_checked_in ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                  <i data-icon="pin"></i> Clock In
                </button>
                <button class="btn btn-secondary" id="btn-clock-out" ${!today.is_checked_in ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                  <i data-icon="panel"></i> Clock Out
                </button>
              </div>
            </div>
          </div>

          <!-- Working Hours Metrics -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.75rem;">
            <div class="card" style="padding:1.25rem;">
              <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Hours This Week</span>
              <div style="font-size:2rem; font-weight:700; color:var(--cold); margin-top:0.25rem;" class="tabular">${summary.hours_this_week} hrs</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:2px;">Monday to Sunday</div>
            </div>

            <div class="card" style="padding:1.25rem;">
              <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Hours This Month</span>
              <div style="font-size:2rem; font-weight:700; color:var(--ok); margin-top:0.25rem;" class="tabular">${summary.hours_this_month} hrs</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:2px;">Cumulative monthly verified</div>
            </div>

            <div class="card" style="padding:1.25rem;">
              <span style="font-size:0.85rem; color:var(--ink-2); font-weight:600;">Days Present</span>
              <div style="font-size:2rem; font-weight:700; color:var(--ink); margin-top:0.25rem;" class="tabular">${summary.days_present_this_month} days</div>
              <div style="font-size:0.8rem; color:var(--ink-3); margin-top:2px;">Current billing cycle</div>
            </div>
          </div>

          <!-- Attendance History Table -->
          <div class="card" style="padding: 1.5rem;">
            <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Attendance History (Past 30 Days)</h3>
            ${history.length === 0 ? `
              <p style="color:var(--ink-3); font-size:0.9rem;">No past attendance records found.</p>
            ` : `
              <div class="wf-table-wrap">
                <table class="wf-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Total Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${history.map(r => `
                      <tr>
                        <td><b>${r.date}</b></td>
                        <td>${fmtTime(r.check_in)}</td>
                        <td>${fmtTime(r.check_out)}</td>
                        <td class="tabular"><b>${r.working_hours} hrs</b></td>
                        <td>${getStatusBadge(r.status)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;

      // Wire Clock In / Clock Out
      const cinBtn = container.querySelector('#btn-clock-in');
      const coutBtn = container.querySelector('#btn-clock-out');

      if (cinBtn && !cinBtn.disabled) {
        cinBtn.addEventListener('click', async () => {
          try {
            cinBtn.disabled = true;
            await api().checkIn();
            window.WF.toast('Checked in successfully.', 'ok');
            window.pages.employeeAttendance(container);
          } catch(e) {
            window.WF.toast(e.message || 'Check-in failed', 'bad');
            cinBtn.disabled = false;
          }
        });
      }

      if (coutBtn && !coutBtn.disabled) {
        coutBtn.addEventListener('click', async () => {
          try {
            coutBtn.disabled = true;
            await api().checkOut();
            window.WF.toast('Checked out successfully.', 'ok');
            window.pages.employeeAttendance(container);
          } catch(e) {
            window.WF.toast(e.message || 'Check-out failed', 'bad');
            coutBtn.disabled = false;
          }
        });
      }

    } catch(err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          Failed to load attendance records: ${err.message}
        </div>
      `;
    }
  };


  /* =====================================================================
     6. MY NOTIFICATIONS (#employee-notifications)
     ===================================================================== */
  window.pages.employeeNotifications = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align: center; padding: 40px;">Loading notifications...</div>
    `;

    try {
      const notifs = await api().getNotifications();

      container.innerHTML = `
        <div class="dt-container">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
            <div>
              <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink);">My Notifications</h1>
              <p style="margin-top: 0.25rem; color: var(--ink-2);">Job assignments, reassignment alerts, and warehouse directives.</p>
            </div>
            ${notifs.length > 0 ? `
              <button class="btn btn-secondary" id="btn-read-all-notifs">
                <i data-icon="check"></i> Mark All as Read
              </button>
            ` : ''}
          </div>

          <div class="card" style="padding: 1.5rem;">
            ${notifs.length === 0 ? `
              <div class="emptystate" style="padding: 3rem; text-align: center;">
                <i data-icon="bell" style="font-size: 3rem; color: #94a3b8; display: block; margin-bottom: 0.5rem;"></i>
                <h3 style="margin: 0; color: var(--ink);">No Notifications</h3>
                <p style="color: var(--ink-2); margin-top: 0.25rem;">You have no active notifications at this time.</p>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${notifs.map(n => `
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem; border-radius: var(--r-sm); background: ${n.is_read ? '#f8fafc' : '#eff6ff'}; border: 1px solid ${n.is_read ? 'var(--line-2)' : '#bfdbfe'};">
                    <div style="flex: 1;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="chip" style="font-size:0.75rem;">${n.type}</span>
                        <b style="font-size: 0.95rem; color: var(--ink);">${n.title}</b>
                        ${!n.is_read ? `<span style="width:8px; height:8px; border-radius:50%; background:#2563eb; display:inline-block;"></span>` : ''}
                      </div>
                      <p style="font-size: 0.875rem; color: var(--ink-2); margin-top: 6px;">${n.message}</p>
                      <div style="font-size: 0.75rem; color: var(--ink-3); margin-top: 6px;">${fmtDate(n.created_at)}</div>
                    </div>
                    <div>
                      ${!n.is_read ? `
                        <button class="btn btn-sm btn-ghost" onclick="window.pages.employeeNotifications.markRead(${n.id})">Mark as read</button>
                      ` : `
                        <span style="font-size:0.75rem; color:var(--ink-3);">Read</span>
                      `}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;

      const readAllBtn = container.querySelector('#btn-read-all-notifs');
      if (readAllBtn) {
        readAllBtn.addEventListener('click', async () => {
          try {
            await api().markAllNotificationsRead();
            window.WF.toast('All notifications marked as read', 'ok');
            window.pages.employeeNotifications(container);
          } catch(e) {
            window.WF.toast(e.message || 'Operation failed', 'bad');
          }
        });
      }

    } catch(err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          Failed to load notifications: ${err.message}
        </div>
      `;
    }
  };

  window.pages.employeeNotifications.markRead = async function(id) {
    try {
      await api().markNotificationRead(id);
      window.pages.employeeNotifications(document.getElementById('router-view'));
    } catch(e) {
      window.WF.toast(e.message || 'Failed to mark read', 'bad');
    }
  };


  /* =====================================================================
     7. MY PROFILE (#employee-profile)
     ===================================================================== */
  window.pages.employeeProfile = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align: center; padding: 40px;">Loading profile...</div>
    `;

    try {
      const p = await api().getMe();

      container.innerHTML = `
        <div class="dt-container">
          <div style="margin-bottom: 1.5rem;">
            <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink);">My Employee Profile</h1>
            <p style="margin-top: 0.25rem; color: var(--ink-2);">View your employment details, skills matrix, shift schedule, and company association.</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- Employment Details -->
            <div class="card" style="padding: 1.75rem;">
              <h3 style="margin: 0 0 1.25rem 0; font-size: 1.25rem;">Account & Employment</h3>
              <dl class="dl" style="font-size: 0.95rem;">
                <div><dt>Full Name</dt><dd><b>${p.full_name}</b></dd></div>
                <div><dt>Employee ID</dt><dd><code>${p.employee_code}</code></dd></div>
                <div><dt>Login Email</dt><dd>${p.email}</dd></div>
                <div><dt>Assigned Role</dt><dd><span class="chip">${p.role_type}</span></dd></div>
                <div><dt>Employment Status</dt><dd>${getStatusBadge(p.status)}</dd></div>
                <div><dt>Company / Facility</dt><dd>${p.company_name}</dd></div>
                <div><dt>Current Workload</dt><dd class="tabular">${p.current_workload} mins</dd></div>
                <div><dt>Enrolled Date</dt><dd>${fmtDate(p.created_at)}</dd></div>
              </dl>
            </div>

            <!-- Skills & Shifts -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div class="card" style="padding: 1.75rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Skills Matrix</h3>
                ${p.skills.length === 0 ? `
                  <p style="color:var(--ink-3); font-size:0.9rem;">No certified skills logged.</p>
                ` : `
                  <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    ${p.skills.map(s => `
                      <span class="status-badge status-new" style="font-size:0.85rem; padding:6px 12px;">
                        ${s.name} &bull; Lvl ${s.level}
                      </span>
                    `).join('')}
                  </div>
                `}
              </div>

              <div class="card" style="padding: 1.75rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Scheduled Shifts</h3>
                ${p.shifts.length === 0 ? `
                  <p style="color:var(--ink-3); font-size:0.9rem;">Standard rotational day shift (08:00 - 17:00).</p>
                ` : `
                  <div style="display:flex; flex-direction:column; gap:8px;">
                    ${p.shifts.map(sh => `
                      <div style="display:flex; justify-content:space-between; background:#f8fafc; padding:0.75rem; border-radius:var(--r-sm);">
                        <span>${fmtDate(sh.start_time)} &rarr; ${fmtDate(sh.end_time)}</span>
                        <span class="status-badge ${sh.is_active ? 'status-completed' : 'status-cancelled'}">${sh.is_active ? 'Active' : 'Archived'}</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch(err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          Failed to load profile: ${err.message}
        </div>
      `;
    }
  };


  /* =====================================================================
     8. AI WORK ASSISTANT (#employee-ai)
     ===================================================================== */
  window.pages.employeeAi = async function(container) {
    container.innerHTML = `
      <div class="panel" style="text-align: center; padding: 40px;">Generating AI work insights...</div>
    `;

    try {
      const data = await api().getAiInsights();
      const seq = data.job_sequence || [];
      const wl = data.workload_analysis || {};
      const perf = data.performance_insight || {};

      container.innerHTML = `
        <div class="dt-container">
          <div style="margin-bottom: 1.5rem;">
            <h1 style="margin: 0; font-size: 1.85rem; color: var(--ink); display: flex; align-items: center; gap: 8px;">
              <i data-icon="spark" style="color: var(--beam);"></i> AI Work Assistant
            </h1>
            <p style="margin-top: 0.25rem; color: var(--ink-2);">Personalized task sequencing, workload trajectory, and floor efficiency guidance.</p>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; align-items: start;">
            <!-- Left: Recommended Task Sequence -->
            <div class="card" style="padding: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.25rem;">Optimal Task Sequence</h3>
                <span class="chip" style="font-size: 0.75rem;">Shortest Transit Path</span>
              </div>
              <p style="font-size: 0.85rem; color: var(--ink-2); margin-bottom: 1rem;">
                The AI optimization engine suggests executing your assigned tasks in this sequence to minimize aisle backtracking:
              </p>

              ${seq.length === 0 ? `
                <div class="emptystate" style="padding: 2rem; text-align: center;">
                  <i data-icon="check" style="font-size: 2.5rem; color: #94a3b8; display: block; margin-bottom: 0.5rem;"></i>
                  <p style="color: var(--ink-2);">No active tasks to sequence right now.</p>
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${seq.map((s, idx) => `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid var(--line-2); border-radius: var(--r-sm); padding: 0.85rem 1rem;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="background: var(--cold); color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">
                          ${idx + 1}
                        </span>
                        <div>
                          <div style="font-weight: 600; font-size: 0.95rem;">Job #${s.job_id} &bull; ${s.type}</div>
                          <div style="font-size: 0.8rem; color: var(--ink-3);">Location: <b>${s.location}</b> &bull; Reason: ${s.recommendation_reason}</div>
                        </div>
                      </div>
                      <div>
                        ${getPriorityBadge(s.priority)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Right: Workload & Safety Tips -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <div class="card" style="padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Workload Assessment</h3>
                <div style="background: #f8fafc; padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--line-2); margin-bottom: 1rem;">
                  <span style="font-size: 0.8rem; color: var(--ink-2); font-weight: 600;">Current Load</span>
                  <div style="font-size: 1.6rem; font-weight: 700; color: var(--ink); margin-top: 4px;" class="tabular">
                    ${wl.current_workload_minutes} mins
                  </div>
                  <div style="font-size: 0.8rem; color: var(--ok); font-weight: 600; margin-top: 4px;">
                    ${wl.status}
                  </div>
                </div>
                <div style="font-size: 0.85rem; color: var(--ink-2);">
                  <b>Next Break Recommendation:</b><br>
                  ${wl.recommended_next_break}
                </div>
              </div>

              <div class="card" style="padding: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">Safety & Efficiency Tips</h3>
                <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.85rem; color: var(--ink-2); display: flex; flex-direction: column; gap: 8px;">
                  ${(perf.tips || []).map(tip => `<li>${tip}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch(err) {
      container.innerHTML = `
        <div class="panel" style="padding: 2rem; color: var(--bad);">
          Failed to load AI insights: ${err.message}
        </div>
      `;
    }
  };

  // Legacy fallback alias
  window.pages.employeePortal = window.pages.employeeOverview;

})();
