window.pages = window.pages || {};

window.pages.employees = async function(container) {
  const api = window.apiClient;
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <h1 style="margin:0; font-size:1.75rem; font-weight:700;">Employee Directory & Operations</h1>
        <p style="margin:4px 0 0 0; color:var(--ink-2); font-size:0.9rem;">
          Provision staff, manage warehouse assignments, track workload, and monitor operational performance.
        </p>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button id="btn-invite-emp" class="btn btn-primary">
          <i data-icon="spark"></i> Invite Employee
        </button>
        <button id="btn-new-emp" class="btn btn-secondary">
          <i data-icon="plus"></i> Add Employee
        </button>
        <a href="#salary-management" class="btn btn-ghost">
          <i data-icon="file"></i> Payroll Hub
        </a>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
      <div class="card" style="padding:1.25rem;">
        <div style="font-size:0.8rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Total Workforce</div>
        <div id="stat-total-emp" style="font-size:1.8rem; font-weight:700; margin-top:0.25rem;">...</div>
        <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">Active in database</div>
      </div>
      <div class="card" style="padding:1.25rem;">
        <div style="font-size:0.8rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">On Duty / Active</div>
        <div id="stat-active-emp" style="font-size:1.8rem; font-weight:700; margin-top:0.25rem; color:var(--good);">...</div>
        <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">Available for task dispatch</div>
      </div>
      <div class="card" style="padding:1.25rem;">
        <div style="font-size:0.8rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Active Jobs Assigned</div>
        <div id="stat-active-jobs" style="font-size:1.8rem; font-weight:700; margin-top:0.25rem; color:var(--brand);">...</div>
        <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">In progress right now</div>
      </div>
      <div class="card" style="padding:1.25rem;">
        <div style="font-size:0.8rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Average Workload</div>
        <div id="stat-avg-workload" style="font-size:1.8rem; font-weight:700; margin-top:0.25rem; color:var(--warn);">...</div>
        <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">Capacity utilization</div>
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="card" style="padding:1rem; margin-bottom:1.5rem; display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
      <div style="flex:2; min-width:240px; position:relative;">
        <input id="emp-search" type="text" class="input" placeholder="Search by name, employee code, or email..." style="width:100%;">
      </div>
      <div style="flex:1; min-width:140px;">
        <select id="filter-role" class="input" style="width:100%;">
          <option value="ALL">All Roles</option>
          <option value="Picker">Picker</option>
          <option value="Packer">Packer</option>
          <option value="Driver">Driver</option>
          <option value="EMPLOYEE">General Employee</option>
          <option value="MANAGER">Manager</option>
        </select>
      </div>
      <div style="flex:1; min-width:140px;">
        <select id="filter-status" class="input" style="width:100%;">
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>
      </div>
      <div style="flex:1; min-width:140px;">
        <select id="filter-wh" class="input" style="width:100%;">
          <option value="ALL">All Warehouses</option>
        </select>
      </div>
    </div>

    <!-- Main Employees Table -->
    <div class="panel" style="overflow-x:auto;">
      <table class="wf-table" id="emp-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Code</th>
            <th>Role</th>
            <th>Warehouse</th>
            <th style="min-width:130px;">Workload</th>
            <th>Active Jobs</th>
            <th>Completed</th>
            <th>Payroll</th>
            <th>Status</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="emp-table-body">
          <tr><td colspan="10" style="text-align:center; padding:2rem;">Loading employee directory...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Container for Dialogs / Drawers -->
    <div id="emp-modal-container"></div>
  `;

  window.WF.hydrate(container);

  let allEmployees = [];
  let allWarehouses = [];

  async function loadData() {
    try {
      const [emps, whs] = await Promise.all([
        api.employees.getAll(),
        api.warehouses.getAll().catch(() => [])
      ]);
      allEmployees = emps;
      allWarehouses = whs;

      // Populate warehouse filter
      const whSelect = container.querySelector('#filter-wh');
      if (whSelect) {
        whSelect.innerHTML = '<option value="ALL">All Warehouses</option>' + 
          whs.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
      }

      updateStats();
      renderTable();
    } catch(err) {
      container.querySelector('#emp-table-body').innerHTML = `
        <tr><td colspan="10" style="color:var(--bad); text-align:center; padding:2rem;">
          Failed to load employees: ${err.message}
        </td></tr>
      `;
    }
  }

  function updateStats() {
    const total = allEmployees.length;
    const active = allEmployees.filter(e => e.status === 'ACTIVE').length;
    const totalActiveJobs = allEmployees.reduce((acc, e) => acc + (e.active_jobs_count || 0), 0);
    const avgWorkload = total > 0 
      ? Math.round(allEmployees.reduce((acc, e) => acc + (e.current_workload || 0), 0) / total) 
      : 0;

    container.querySelector('#stat-total-emp').textContent = total;
    container.querySelector('#stat-active-emp').textContent = active;
    container.querySelector('#stat-active-jobs').textContent = totalActiveJobs;
    container.querySelector('#stat-avg-workload').textContent = `${avgWorkload}%`;
  }

  function renderTable() {
    const searchVal = container.querySelector('#emp-search').value.trim().toLowerCase();
    const roleVal = container.querySelector('#filter-role').value;
    const statusVal = container.querySelector('#filter-status').value;
    const whVal = container.querySelector('#filter-wh').value;

    const filtered = allEmployees.filter(e => {
      const name = `${e.first_name} ${e.last_name}`.toLowerCase();
      const code = (e.employee_code || '').toLowerCase();
      const email = (e.email || '').toLowerCase();

      const matchesSearch = !searchVal || name.includes(searchVal) || code.includes(searchVal) || email.includes(searchVal);
      const matchesRole = roleVal === 'ALL' || e.role_type === roleVal;
      const matchesStatus = statusVal === 'ALL' || e.status === statusVal;
      const matchesWh = whVal === 'ALL' || String(e.warehouse_id) === String(whVal);

      return matchesSearch && matchesRole && matchesStatus && matchesWh;
    });

    const tbody = container.querySelector('#emp-table-body');
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2.5rem; color:var(--ink-2);">No employees found matching filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(e => {
      const workload = Math.round(e.current_workload || 0);
      const isOverloaded = workload > 85;
      const initial = (e.first_name || 'E').charAt(0).toUpperCase();
      const statusBadge = e.status === 'ACTIVE' 
        ? `<span class="status-badge" style="background:#e6f4ea; color:#137333;">ACTIVE</span>`
        : `<span class="status-badge" style="background:#fce8e6; color:#c5221f;">INACTIVE</span>`;

      const salaryBadge = e.salary_status === 'PAID'
        ? `<span class="status-badge" style="background:#e6f4ea; color:#137333;">PAID</span>`
        : e.salary_status === 'FINALIZED'
        ? `<span class="status-badge" style="background:#e8f0fe; color:#1a73e8;">FINALIZED</span>`
        : `<span class="status-badge" style="background:#f1f3f4; color:#5f6368;">${e.salary_status || 'UNBILLED'}</span>`;

      return `
        <tr data-emp-id="${e.id}">
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:34px; height:34px; border-radius:50%; background:var(--brand-surface, #e0f2fe); color:var(--brand); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85rem;">
                ${initial}
              </div>
              <div>
                <div style="font-weight:600; color:var(--ink);">${e.first_name} ${e.last_name}</div>
                <div style="font-size:0.75rem; color:var(--ink-2);">${e.email || 'No login linked'}</div>
              </div>
            </div>
          </td>
          <td><code style="font-weight:600; color:var(--ink);">${e.employee_code || `EMP-${e.id}`}</code></td>
          <td><span style="font-size:0.85rem;">${e.role_type || 'Staff'}</span></td>
          <td><span style="font-size:0.85rem; color:var(--ink-2);">${e.warehouse_name || 'Unassigned'}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                <div style="width:${Math.min(workload, 100)}%; background:${isOverloaded ? 'var(--bad)' : 'var(--brand)'}; height:100%;"></div>
              </div>
              <span style="font-size:0.8rem; font-weight:600; min-width:32px;">${workload}%</span>
            </div>
          </td>
          <td>
            <span style="font-weight:700; color:${(e.active_jobs_count || 0) > 0 ? 'var(--brand)' : 'var(--ink-2)'};">
              ${e.active_jobs_count || 0}
            </span>
          </td>
          <td><span style="font-weight:600;">${e.completed_jobs_count || 0}</span></td>
          <td>${salaryBadge}</td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">
            <button class="btn btn-ghost btn-sm btn-manage-emp" data-id="${e.id}" style="padding:4px 10px;">
              Inspect &rarr;
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind inspect buttons
    tbody.querySelectorAll('.btn-manage-emp').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        openEmployeeDetailModal(id);
      });
    });

    // Row clicks also open details
    tbody.querySelectorAll('tr[data-emp-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = parseInt(tr.dataset.empId, 10);
        openEmployeeDetailModal(id);
      });
    });
  }

  // Search & filter events
  container.querySelector('#emp-search').addEventListener('input', renderTable);
  container.querySelector('#filter-role').addEventListener('change', renderTable);
  container.querySelector('#filter-status').addEventListener('change', renderTable);
  container.querySelector('#filter-wh').addEventListener('change', renderTable);

  // Invite Employee Action Modal
  container.querySelector('#btn-invite-emp').addEventListener('click', () => openInviteModal());

  // Add Employee Direct Modal
  container.querySelector('#btn-new-emp').addEventListener('click', () => openCreateModal());

  // --- DETAILS MODAL / DRAWER ---
  async function openEmployeeDetailModal(empId) {
    const modalHost = container.querySelector('#emp-modal-container');
    modalHost.innerHTML = `
      <div class="scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
        <div class="card" style="width:100%; max-width:850px; max-height:90vh; overflow-y:auto; padding:2rem; position:relative; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
          <div style="text-align:center; padding:3rem;">Loading employee details...</div>
        </div>
      </div>
    `;

    try {
      const details = await api.employees.getDetails(empId);
      const emp = details.employee;
      const perf = details.performance;
      const activeJobs = details.active_jobs || [];
      const completedJobs = details.completed_jobs || [];
      const attendance = details.attendance || [];
      const skills = details.skills || [];

      const initial = (emp.first_name || 'E').charAt(0).toUpperCase();

      modalHost.innerHTML = `
        <div class="scrim" id="modal-emp-details-scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
          <div class="card" style="width:100%; max-width:850px; max-height:92vh; overflow-y:auto; padding:2rem; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <button id="btn-close-emp-modal" class="icon-btn" style="position:absolute; top:1.25rem; right:1.25rem; font-size:1.25rem;">&times;</button>
            
            <!-- Employee Profile Header -->
            <div style="display:flex; gap:1.25rem; align-items:center; margin-bottom:1.5rem; padding-bottom:1.5rem; border-bottom:1px solid var(--border);">
              <div style="width:58px; height:58px; border-radius:50%; background:var(--brand-surface, #e0f2fe); color:var(--brand); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.5rem;">
                ${initial}
              </div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <h2 style="margin:0; font-size:1.4rem;">${emp.first_name} ${emp.last_name}</h2>
                  <span class="status-badge" style="background:${emp.status==='ACTIVE'?'#e6f4ea':'#fce8e6'}; color:${emp.status==='ACTIVE'?'#137333':'#c5221f'};">
                    ${emp.status}
                  </span>
                </div>
                <div style="color:var(--ink-2); font-size:0.85rem; margin-top:4px;">
                  <code>${emp.employee_code}</code> &bull; ${emp.email || 'No email login attached'} &bull; ${emp.role_type}
                </div>
              </div>
              <div>
                ${emp.status === 'ACTIVE' 
                  ? `<button id="btn-deactivate-emp" class="btn btn-sm" style="color:var(--bad); border:1px solid var(--bad); background:transparent;">Deactivate Staff</button>`
                  : `<button id="btn-activate-emp" class="btn btn-sm btn-primary">Reactivate Staff</button>`
                }
              </div>
            </div>

            <!-- Tab Navigation inside Modal -->
            <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
              <button class="btn btn-ghost btn-sm emp-modal-tab on" data-tab="tab-overview" style="border-bottom:2px solid var(--brand); border-radius:0;">Overview & Assignment</button>
              <button class="btn btn-ghost btn-sm emp-modal-tab" data-tab="tab-jobs" style="border-radius:0;">Active & Past Jobs (${activeJobs.length})</button>
              <button class="btn btn-ghost btn-sm emp-modal-tab" data-tab="tab-attendance" style="border-radius:0;">Attendance & Shifts</button>
              <button class="btn btn-ghost btn-sm emp-modal-tab" data-tab="tab-skills" style="border-radius:0;">Skills (${skills.length})</button>
            </div>

            <!-- Tab 1: Overview & Assignment -->
            <div id="tab-overview" class="emp-modal-pane">
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                <div class="panel" style="padding:1rem;">
                  <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Workload</div>
                  <div style="font-size:1.5rem; font-weight:700; margin-top:4px;">${Math.round(emp.current_workload)}%</div>
                </div>
                <div class="panel" style="padding:1rem;">
                  <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Accuracy Rate</div>
                  <div style="font-size:1.5rem; font-weight:700; margin-top:4px; color:var(--good);">${Math.round(perf.accuracy * 100)}%</div>
                </div>
                <div class="panel" style="padding:1rem;">
                  <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">On-Time Delivery</div>
                  <div style="font-size:1.5rem; font-weight:700; margin-top:4px; color:var(--brand);">${Math.round(perf.on_time_rate * 100)}%</div>
                </div>
              </div>

              <form id="form-edit-emp" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div>
                  <label class="field-label">First Name</label>
                  <input id="edit-fn" class="input" style="width:100%;" value="${emp.first_name}">
                </div>
                <div>
                  <label class="field-label">Last Name</label>
                  <input id="edit-ln" class="input" style="width:100%;" value="${emp.last_name}">
                </div>
                <div>
                  <label class="field-label">Role Type</label>
                  <select id="edit-role" class="input" style="width:100%;">
                    <option value="Picker" ${emp.role_type==='Picker'?'selected':''}>Picker</option>
                    <option value="Packer" ${emp.role_type==='Packer'?'selected':''}>Packer</option>
                    <option value="Driver" ${emp.role_type==='Driver'?'selected':''}>Driver</option>
                    <option value="EMPLOYEE" ${emp.role_type==='EMPLOYEE'?'selected':''}>EMPLOYEE</option>
                  </select>
                </div>
                <div>
                  <label class="field-label">Assigned Warehouse</label>
                  <select id="edit-wh" class="input" style="width:100%;">
                    <option value="">Unassigned</option>
                    ${allWarehouses.map(w => `<option value="${w.id}" ${emp.warehouse_id===w.id?'selected':''}>${w.name} (${w.location||'Main'})</option>`).join('')}
                  </select>
                </div>
                <div style="grid-column:1 / -1; display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                  <a href="#salary-management" class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-emp-details-scrim').remove();">
                    &rarr; Manage Payroll in Salary Hub
                  </a>
                  <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>

            <!-- Tab 2: Jobs -->
            <div id="tab-jobs" class="emp-modal-pane" style="display:none;">
              <h4 style="margin:0 0 0.5rem 0;">Active Work Orders</h4>
              ${activeJobs.length === 0 ? '<p style="color:var(--ink-2); font-size:0.9rem;">No jobs currently in progress.</p>' : `
                <table class="wf-table" style="font-size:0.85rem; margin-bottom:1.5rem;">
                  <thead>
                    <tr><th>Job ID</th><th>Type</th><th>Priority</th><th>Status</th><th>Duration</th></tr>
                  </thead>
                  <tbody>
                    ${activeJobs.map(j => `
                      <tr>
                        <td><b>#${j.id}</b></td>
                        <td>${j.type}</td>
                        <td><span style="font-weight:700; color:${j.priority===1?'var(--bad)':'var(--brand)'};">P${j.priority}</span></td>
                        <td><span class="status-badge" style="background:#e8f0fe; color:#1a73e8;">${j.status}</span></td>
                        <td>${j.estimated_duration}m</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}

              <h4 style="margin:1rem 0 0.5rem 0;">Recent Completed Work (${completedJobs.length})</h4>
              ${completedJobs.length === 0 ? '<p style="color:var(--ink-2); font-size:0.9rem;">No completed work recorded yet.</p>' : `
                <table class="wf-table" style="font-size:0.85rem;">
                  <thead>
                    <tr><th>Job ID</th><th>Type</th><th>Completed Timestamp</th></tr>
                  </thead>
                  <tbody>
                    ${completedJobs.map(j => `
                      <tr>
                        <td>#${j.id}</td>
                        <td>${j.type}</td>
                        <td style="color:var(--ink-2);">${j.completed_at ? new Date(j.completed_at).toLocaleString() : 'Done'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Tab 3: Attendance -->
            <div id="tab-attendance" class="emp-modal-pane" style="display:none;">
              <h4 style="margin:0 0 0.5rem 0;">Recent Clock-In Records</h4>
              ${attendance.length === 0 ? '<p style="color:var(--ink-2); font-size:0.9rem;">No attendance records found.</p>' : `
                <table class="wf-table" style="font-size:0.85rem;">
                  <thead>
                    <tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    ${attendance.map(a => `
                      <tr>
                        <td>${new Date(a.date).toLocaleDateString()}</td>
                        <td>${a.check_in ? new Date(a.check_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}</td>
                        <td>${a.check_out ? new Date(a.check_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--'}</td>
                        <td><b>${a.working_hours || 0} hrs</b></td>
                        <td><span class="status-badge" style="background:#e6f4ea; color:#137333;">${a.status}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Tab 4: Skills -->
            <div id="tab-skills" class="emp-modal-pane" style="display:none;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h4 style="margin:0;">Certifications & Capabilities</h4>
              </div>
              <div id="skills-list-wrap" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:1.5rem;">
                ${skills.length === 0 ? '<p style="color:var(--ink-2);">No skill tags assigned.</p>' : skills.map(s => `
                  <span class="status-badge" style="background:#f1f5f9; color:#334155; padding:6px 12px; font-size:0.85rem; display:flex; align-items:center; gap:6px;">
                    ${s.skill_name} (L${s.level})
                    <button class="btn-del-skill" data-skill-id="${s.id}" style="background:none; border:none; cursor:pointer; color:var(--bad);">&times;</button>
                  </span>
                `).join('')}
              </div>

              <div class="panel" style="padding:1rem;">
                <h5 style="margin:0 0 0.5rem 0;">Add Verified Skill</h5>
                <div style="display:flex; gap:8px;">
                  <input id="input-new-skill" class="input" style="flex:1;" placeholder="e.g. FORKLIFT, COLD_STORAGE, HAZMAT">
                  <select id="select-skill-lvl" class="input" style="width:80px;">
                    <option value="1">L1</option>
                    <option value="2">L2</option>
                    <option value="3">L3</option>
                  </select>
                  <button id="btn-add-skill-action" class="btn btn-secondary btn-sm">Add Skill</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      `;

      // Tab switcher inside modal
      modalHost.querySelectorAll('.emp-modal-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
          modalHost.querySelectorAll('.emp-modal-tab').forEach(t => {
            t.classList.remove('on');
            t.style.borderBottom = 'none';
          });
          modalHost.querySelectorAll('.emp-modal-pane').forEach(p => p.style.display = 'none');
          tabBtn.classList.add('on');
          tabBtn.style.borderBottom = '2px solid var(--brand)';
          const target = modalHost.querySelector(`#${tabBtn.dataset.tab}`);
          if (target) target.style.display = 'block';
        });
      });

      // Close handler
      modalHost.querySelector('#btn-close-emp-modal').addEventListener('click', () => modalHost.innerHTML = '');
      modalHost.querySelector('#modal-emp-details-scrim').addEventListener('click', (e) => {
        if (e.target.id === 'modal-emp-details-scrim') modalHost.innerHTML = '';
      });

      // Save Profile Edit
      const formEdit = modalHost.querySelector('#form-edit-emp');
      if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = formEdit.querySelector('button[type="submit"]');
          submitBtn.classList.add('loading');
          try {
            const fn = modalHost.querySelector('#edit-fn').value.trim();
            const ln = modalHost.querySelector('#edit-ln').value.trim();
            const role = modalHost.querySelector('#edit-role').value;
            const wh = modalHost.querySelector('#edit-wh').value;

            await api.employees.update(empId, {
              first_name: fn,
              last_name: ln,
              role_type: role,
              warehouse_id: wh ? parseInt(wh, 10) : null
            });

            window.WF.toast('Employee updated successfully.', 'ok');
            modalHost.innerHTML = '';
            loadData();
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          } finally {
            submitBtn.classList.remove('loading');
          }
        });
      }

      // Deactivate
      const btnDeact = modalHost.querySelector('#btn-deactivate-emp');
      if (btnDeact) {
        btnDeact.addEventListener('click', async () => {
          if (!confirm(`Are you sure you want to deactivate ${emp.first_name}? Historical attendance, jobs, and salary will be preserved.`)) return;
          try {
            await api.employees.deactivate(empId);
            window.WF.toast(`Employee ${emp.first_name} deactivated.`, 'ok');
            modalHost.innerHTML = '';
            loadData();
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          }
        });
      }

      // Reactivate
      const btnAct = modalHost.querySelector('#btn-activate-emp');
      if (btnAct) {
        btnAct.addEventListener('click', async () => {
          try {
            await api.employees.activate(empId);
            window.WF.toast(`Employee ${emp.first_name} reactivated.`, 'ok');
            modalHost.innerHTML = '';
            loadData();
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          }
        });
      }

      // Add Skill
      const btnAddSkill = modalHost.querySelector('#btn-add-skill-action');
      if (btnAddSkill) {
        btnAddSkill.addEventListener('click', async () => {
          const input = modalHost.querySelector('#input-new-skill');
          const lvl = parseInt(modalHost.querySelector('#select-skill-lvl').value, 10);
          if (!input.value.trim()) return;
          try {
            await api.employees.addSkill(empId, input.value.trim(), lvl);
            window.WF.toast('Skill added.', 'ok');
            openEmployeeDetailModal(empId); // reload modal
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          }
        });
      }

      // Delete Skill
      modalHost.querySelectorAll('.btn-del-skill').forEach(btn => {
        btn.addEventListener('click', async () => {
          const sId = btn.dataset.skillId;
          try {
            await api.employees.deleteSkill(empId, sId);
            window.WF.toast('Skill removed.', 'ok');
            openEmployeeDetailModal(empId);
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          }
        });
      });

    } catch(err) {
      modalHost.innerHTML = `
        <div class="scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
          <div class="card" style="padding:2rem; max-width:400px; text-align:center;">
            <p style="color:var(--bad);">Error loading details: ${err.message}</p>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.scrim').remove();">Close</button>
          </div>
        </div>
      `;
    }
  }

  // --- INVITATION MANAGEMENT MODAL ---
  async function openInviteModal() {
    const modalHost = container.querySelector('#emp-modal-container');
    modalHost.innerHTML = `
      <div class="scrim" id="modal-inv-scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
        <div class="card" style="width:100%; max-width:620px; max-height:90vh; overflow-y:auto; padding:2rem; position:relative;">
          <button id="btn-close-inv" class="icon-btn" style="position:absolute; top:1.25rem; right:1.25rem; font-size:1.25rem;">&times;</button>
          <h2 style="margin:0 0 0.5rem 0;">Invite New Employee</h2>
          <p style="color:var(--ink-2); font-size:0.9rem; margin-bottom:1.5rem;">
            Generate an encrypted, single-use invitation code that allows a warehouse operator to join your company.
          </p>

          <form id="form-create-inv" style="display:flex; flex-direction:column; gap:1rem; margin-bottom:2rem;">
            <div>
              <label class="field-label">Role Type</label>
              <select id="inv-role" class="input" style="width:100%;">
                <option value="Picker">Picker</option>
                <option value="Packer">Packer</option>
                <option value="Driver">Driver</option>
                <option value="EMPLOYEE">General Employee</option>
              </select>
            </div>
            <div>
              <label class="field-label">Target Email Address (Optional)</label>
              <input id="inv-email" class="input" style="width:100%;" placeholder="e.g. employee@example.com (Locks code to this email)">
            </div>
            <div>
              <label class="field-label">Assign Warehouse</label>
              <select id="inv-wh" class="input" style="width:100%;">
                <option value="">Company Default / None</option>
                ${allWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="field-label">Expires In</label>
              <select id="inv-days" class="input" style="width:100%;">
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
                <option value="1">24 Hours</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;">Generate Invitation Code</button>
          </form>

          <div id="inv-result-box" style="display:none; background:var(--brand-surface, #e0f2fe); border:1px solid var(--brand); padding:1rem; border-radius:6px; margin-bottom:1.5rem;">
            <div style="font-size:0.85rem; color:var(--brand); font-weight:700;">INVITATION CODE READY</div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
              <code id="inv-generated-code" style="font-size:1.25rem; font-weight:700; letter-spacing:1px; background:#fff; padding:6px 12px; border-radius:4px; flex:1;"></code>
              <button id="btn-copy-code" class="btn btn-sm btn-secondary">Copy Code</button>
            </div>
            <p style="font-size:0.8rem; color:var(--ink-2); margin:8px 0 0 0;">
              Share this code with the employee. They can enter it under <strong>"Join as Employee"</strong> on the WareFlow login page.
            </p>
          </div>

          <h4 style="margin:1rem 0 0.5rem 0;">Active Company Invitations</h4>
          <div id="inv-list-wrap" style="max-height:180px; overflow-y:auto; font-size:0.85rem;">
            Loading active invitations...
          </div>
        </div>
      </div>
    `;

    // Load active invitations
    async function loadInvitations() {
      const wrap = modalHost.querySelector('#inv-list-wrap');
      try {
        const list = await api.employees.getInvitations();
        if (list.length === 0) {
          wrap.innerHTML = '<p style="color:var(--ink-2);">No pending invitations.</p>';
          return;
        }
        wrap.innerHTML = `
          <table class="wf-table">
            <thead>
              <tr><th>Code</th><th>Role</th><th>Target</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              ${list.map(i => `
                <tr>
                  <td><code>${i.invitation_code}</code></td>
                  <td>${i.role_type}</td>
                  <td>${i.email || 'Any email'}</td>
                  <td>${i.is_used ? '<span style="color:var(--good); font-weight:600;">Used</span>' : i.is_revoked ? '<span style="color:var(--bad);">Revoked</span>' : '<span style="color:var(--brand); font-weight:600;">Active</span>'}</td>
                  <td>
                    ${!i.is_used && !i.is_revoked ? `<button class="btn btn-ghost btn-sm btn-revoke-inv" data-id="${i.id}" style="color:var(--bad); padding:2px 6px;">Revoke</button>` : '--'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        wrap.querySelectorAll('.btn-revoke-inv').forEach(b => {
          b.addEventListener('click', async () => {
            await api.employees.revokeInvitation(b.dataset.id);
            window.WF.toast('Invitation revoked.', 'ok');
            loadInvitations();
          });
        });
      } catch(e) {
        wrap.innerHTML = `<span style="color:var(--bad);">Failed to load invitations: ${e.message}</span>`;
      }
    }

    loadInvitations();

    modalHost.querySelector('#btn-close-inv').addEventListener('click', () => modalHost.innerHTML = '');
    modalHost.querySelector('#modal-inv-scrim').addEventListener('click', (e) => {
      if (e.target.id === 'modal-inv-scrim') modalHost.innerHTML = '';
    });

    const form = modalHost.querySelector('#form-create-inv');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.classList.add('loading');
      try {
        const role = modalHost.querySelector('#inv-role').value;
        const email = modalHost.querySelector('#inv-email').value.trim();
        const wh = modalHost.querySelector('#inv-wh').value;
        const days = parseInt(modalHost.querySelector('#inv-days').value, 10);

        const res = await api.employees.createInvitation({
          role_type: role,
          email: email || null,
          warehouse_id: wh ? parseInt(wh, 10) : null,
          expires_in_days: days
        });

        const box = modalHost.querySelector('#inv-result-box');
        const codeEl = modalHost.querySelector('#inv-generated-code');
        codeEl.textContent = res.invitation_code;
        box.style.display = 'block';

        modalHost.querySelector('#btn-copy-code').onclick = () => {
          navigator.clipboard.writeText(res.invitation_code);
          window.WF.toast('Invitation code copied to clipboard!', 'ok');
        };

        window.WF.toast('Invitation code created.', 'ok');
        loadInvitations();
      } catch(err) {
        window.WF.toast(err.message, 'bad');
      } finally {
        btn.classList.remove('loading');
      }
    });
  }

  // --- QUICK CREATE MODAL ---
  function openCreateModal() {
    const modalHost = container.querySelector('#emp-modal-container');
    modalHost.innerHTML = `
      <div class="scrim" id="modal-create-scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
        <div class="card" style="width:100%; max-width:480px; padding:2rem; position:relative;">
          <button id="btn-close-create" class="icon-btn" style="position:absolute; top:1.25rem; right:1.25rem; font-size:1.25rem;">&times;</button>
          <h2 style="margin:0 0 0.5rem 0;">Add Employee Record</h2>
          <p style="color:var(--ink-2); font-size:0.85rem; margin-bottom:1.5rem;">
            Directly register an employee profile in the warehouse management system.
          </p>

          <form id="form-create-direct" style="display:flex; flex-direction:column; gap:1rem;">
            <div>
              <label class="field-label">First Name *</label>
              <input id="create-fn" class="input" style="width:100%;" required placeholder="e.g. Priya">
            </div>
            <div>
              <label class="field-label">Last Name *</label>
              <input id="create-ln" class="input" style="width:100%;" required placeholder="e.g. Sharma">
            </div>
            <div>
              <label class="field-label">Role Type</label>
              <select id="create-role" class="input" style="width:100%;">
                <option value="Picker">Picker</option>
                <option value="Packer">Packer</option>
                <option value="Driver">Driver</option>
                <option value="EMPLOYEE">General Employee</option>
              </select>
            </div>
            <div>
              <label class="field-label">Warehouse</label>
              <select id="create-wh" class="input" style="width:100%;">
                <option value="">Unassigned</option>
                ${allWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;">Create Employee</button>
          </form>
        </div>
      </div>
    `;

    modalHost.querySelector('#btn-close-create').addEventListener('click', () => modalHost.innerHTML = '');
    modalHost.querySelector('#modal-create-scrim').addEventListener('click', (e) => {
      if (e.target.id === 'modal-create-scrim') modalHost.innerHTML = '';
    });

    const form = modalHost.querySelector('#form-create-direct');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.classList.add('loading');
      try {
        const fn = modalHost.querySelector('#create-fn').value.trim();
        const ln = modalHost.querySelector('#create-ln').value.trim();
        const role = modalHost.querySelector('#create-role').value;
        const wh = modalHost.querySelector('#create-wh').value;

        await api.employees.create({
          first_name: fn,
          last_name: ln,
          role_type: role,
          warehouse_id: wh ? parseInt(wh, 10) : null,
          status: 'ACTIVE'
        });

        window.WF.toast('Employee record created.', 'ok');
        modalHost.innerHTML = '';
        loadData();
      } catch(err) {
        window.WF.toast(err.message, 'bad');
      } finally {
        btn.classList.remove('loading');
      }
    });
  }

  // Initial Load
  loadData();
};
