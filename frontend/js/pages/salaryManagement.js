window.pages = window.pages || {};

window.pages.salaryManagement = async function(container) {
  const api = window.apiClient;
  const formatCurrency = window.formatCurrency || function(amount) {
    const num = Number(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(isNaN(num) ? 0 : num);
  };

  // Periods: current month + past 4 months
  const now = new Date();
  const periods = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    periods.push(`${yr}-${mo}`);
  }

  let selectedPeriod = periods[0];
  let currentTab = 'payroll';
  let allEmployees = [];
  let salarySummary = null;
  let salaryRecords = [];
  let salaryRules = [];

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <h1 style="margin:0; font-size:1.75rem; font-weight:700;">Salary & Payroll Hub</h1>
        <p style="margin:4px 0 0 0; color:var(--ink-2); font-size:0.9rem;">
          Configure wage models, review task-based piece rates, authorize payroll adjustments, and finalize payouts.
        </p>
      </div>
      <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
        <label style="font-size:0.85rem; font-weight:600; color:var(--ink-2);">Payroll Period:</label>
        <select id="select-period" class="input" style="font-weight:600; min-width:140px;">
          ${periods.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
        <button id="btn-refresh-salary" class="btn btn-secondary btn-sm">
          <i data-icon="refresh"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div style="display:flex; gap:1rem; border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
      <button class="btn btn-ghost btn-sm salary-nav-tab on" data-tab="payroll" style="border-bottom:2px solid var(--brand); border-radius:0;">
        Payroll Roster & Records
      </button>
      <button class="btn btn-ghost btn-sm salary-nav-tab" data-tab="rules" style="border-radius:0;">
        Salary Rules & Wage Formulas
      </button>
    </div>

    <div id="salary-tab-content">
      <div style="text-align:center; padding:3rem;">Loading payroll telemetry...</div>
    </div>

    <!-- Modal Host -->
    <div id="salary-modal-host"></div>
  `;

  window.WF.hydrate(container);

  // Switch tabs
  container.querySelectorAll('.salary-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.salary-nav-tab').forEach(b => {
        b.classList.remove('on');
        b.style.borderBottom = 'none';
      });
      btn.classList.add('on');
      btn.style.borderBottom = '2px solid var(--brand)';
      currentTab = btn.dataset.tab;
      renderCurrentTab();
    });
  });

  const periodSelect = container.querySelector('#select-period');
  periodSelect.addEventListener('change', () => {
    selectedPeriod = periodSelect.value;
    loadPayrollData();
  });

  container.querySelector('#btn-refresh-salary').addEventListener('click', () => loadPayrollData());

  async function loadPayrollData() {
    const content = container.querySelector('#salary-tab-content');
    content.innerHTML = '<div style="text-align:center; padding:3rem;">Refreshing payroll data...</div>';

    try {
      const [emps, summary, records, rules] = await Promise.all([
        api.employees.getAll(),
        api.employees.getSalarySummary(selectedPeriod),
        api.employees.getSalaryRecords(selectedPeriod),
        api.employees.getSalaryRules()
      ]);

      allEmployees = emps;
      salarySummary = summary;
      salaryRecords = records;
      salaryRules = rules;

      renderCurrentTab();
    } catch(err) {
      content.innerHTML = `<div class="panel" style="color:var(--bad); padding:2rem; text-align:center;">Failed to load payroll: ${err.message}</div>`;
    }
  }

  function renderCurrentTab() {
    const content = container.querySelector('#salary-tab-content');
    if (currentTab === 'payroll') {
      renderPayrollRoster(content);
    } else {
      renderSalaryRules(content);
    }
  }

  function renderPayrollRoster(content) {
    const s = salarySummary || {};
    content.innerHTML = `
      <!-- KPI Metric Cards -->
      <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        <div class="card" style="padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Total Payout (${selectedPeriod})</div>
          <div style="font-size:1.8rem; font-weight:700; margin-top:0.25rem; color:var(--brand);">${window.formatCurrency(s.total_payout || 0)}</div>
          <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">Base: ${window.formatCurrency(s.total_base || 0)} &bull; Piece: ${window.formatCurrency(s.total_piece_rate || 0)}</div>
        </div>
        <div class="card" style="padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Processed Staff</div>
          <div style="font-size:1.8rem; font-weight:700; margin-top:0.25rem; color:var(--good);">${s.processed_count || 0} / ${s.total_employees || 0}</div>
          <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">${s.finalized_count || 0} finalized &bull; ${s.paid_count || 0} paid</div>
        </div>
        <div class="card" style="padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Pending / Unbilled</div>
          <div style="font-size:1.8rem; font-weight:700; margin-top:0.25rem; color:${(s.unbilled_count||0) > 0 ? 'var(--warn)' : 'var(--ink)'};">${s.unbilled_count || 0}</div>
          <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">Staff awaiting payroll closure</div>
        </div>
        <div class="card" style="padding:1.25rem;">
          <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Adjustments Total</div>
          <div style="font-size:1.8rem; font-weight:700; margin-top:0.25rem;">${window.formatCurrency(s.total_adjustments || 0)}</div>
          <div style="font-size:0.75rem; color:var(--ink-2); margin-top:0.25rem;">Authorized bonuses & adjustments</div>
        </div>
      </div>

      <!-- Employee Roster Table -->
      <div class="panel" style="overflow-x:auto;">
        <table class="wf-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Code</th>
              <th>Role</th>
              <th>Base Salary</th>
              <th>Piece Earnings</th>
              <th>Adjustments</th>
              <th>Total Calculated</th>
              <th>Payroll Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allEmployees.length === 0 ? '<tr><td colspan="9" style="text-align:center;">No employees found.</td></tr>' : allEmployees.map(emp => {
              const rec = salaryRecords.find(r => r.employee_id === emp.id);
              const status = rec ? rec.status : 'UNBILLED';
              const total = rec ? rec.total_amount : 0.0;
              const base = rec ? rec.base_amount : 0.0;
              const piece = rec ? rec.piece_rate_amount : 0.0;
              const adj = rec ? rec.adjustments : 0.0;

              const statusBadge = status === 'PAID'
                ? `<span class="status-badge" style="background:#e6f4ea; color:#137333;">PAID</span>`
                : status === 'FINALIZED'
                ? `<span class="status-badge" style="background:#e8f0fe; color:#1a73e8;">FINALIZED</span>`
                : status === 'DRAFT' || status === 'PENDING'
                ? `<span class="status-badge" style="background:#fef7e0; color:#b06000;">DRAFT</span>`
                : `<span class="status-badge" style="background:#f1f3f4; color:#5f6368;">UNBILLED</span>`;

              return `
                <tr>
                  <td>
                    <strong>${emp.first_name} ${emp.last_name}</strong>
                    <div style="font-size:0.75rem; color:var(--ink-2);">${emp.email || 'No login'}</div>
                  </td>
                  <td><code>${emp.employee_code || `EMP-${emp.id}`}</code></td>
                  <td>${emp.role_type}</td>
                  <td>${rec ? window.formatCurrency(base) : '--'}</td>
                  <td>${rec ? window.formatCurrency(piece) : '--'}</td>
                  <td>${rec ? (adj !== 0 ? (adj > 0 ? `+${window.formatCurrency(adj)}` : window.formatCurrency(adj)) : window.formatCurrency(0)) : '--'}</td>
                  <td><strong style="color:var(--brand);">${rec ? window.formatCurrency(total) : '--'}</strong></td>
                  <td>${statusBadge}</td>
                  <td style="text-align:right;">
                    <button class="btn btn-ghost btn-sm btn-inspect-salary" data-emp-id="${emp.id}" style="padding:4px 10px;">
                      Inspect &rarr;
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    content.querySelectorAll('.btn-inspect-salary').forEach(btn => {
      btn.addEventListener('click', () => {
        const empId = parseInt(btn.dataset.empId, 10);
        openSalaryInspectModal(empId);
      });
    });
  }

  function renderSalaryRules(content) {
    content.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <div>
          <h3 style="margin:0;">Company Wage Formulas</h3>
          <p style="color:var(--ink-2); font-size:0.85rem; margin:2px 0 0 0;">
            Define fixed baseline pay and task piece-rates (Picking, Packing, Delivery) per role type.
          </p>
        </div>
        <button id="btn-add-rule" class="btn btn-primary btn-sm">
          <i data-icon="plus"></i> Add Role Rule
        </button>
      </div>

      <div class="panel" style="overflow-x:auto;">
        <table class="wf-table">
          <thead>
            <tr>
              <th>Role Type</th>
              <th>Wage Model</th>
              <th>Fixed Base</th>
              <th>Picking Rate</th>
              <th>Packing Rate</th>
              <th>Delivery Rate</th>
              <th>Overtime / Hr</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${salaryRules.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding:2rem;">No salary rules defined yet.</td></tr>' : salaryRules.map(r => `
              <tr>
                <td><strong>${r.role_type}</strong></td>
                <td><span class="status-badge" style="background:#f1f5f9;">${r.salary_model}</span></td>
                <td>${window.formatCurrency(r.base_salary || 0)}</td>
                <td>${window.formatCurrency(r.picking_rate || 0)}</td>
                <td>${window.formatCurrency(r.packing_rate || 0)}</td>
                <td>${window.formatCurrency(r.delivery_rate || 0)}</td>
                <td>${window.formatCurrency(r.overtime_rate || 0)}</td>
                <td style="text-align:right;">
                  <button class="btn btn-ghost btn-sm btn-edit-rule" data-role="${r.role_type}" data-model="${r.salary_model}" data-base="${r.base_salary}" data-pick="${r.picking_rate}" data-pack="${r.packing_rate}" data-del="${r.delivery_rate}" data-ot="${r.overtime_rate}">
                    Edit
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    content.querySelector('#btn-add-rule').addEventListener('click', () => openRuleEditModal());
    content.querySelectorAll('.btn-edit-rule').forEach(b => {
      b.addEventListener('click', () => {
        openRuleEditModal({
          role_type: b.dataset.role,
          salary_model: b.dataset.model,
          base_salary: parseFloat(b.dataset.base),
          picking_rate: parseFloat(b.dataset.pick),
          packing_rate: parseFloat(b.dataset.pack),
          delivery_rate: parseFloat(b.dataset.del),
          overtime_rate: parseFloat(b.dataset.ot)
        });
      });
    });
  }

  // --- INSPECT & CALCULATE PAYROLL MODAL ---
  async function openSalaryInspectModal(empId) {
    const modalHost = container.querySelector('#salary-modal-host');
    modalHost.innerHTML = `
      <div class="scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
        <div class="card" style="padding:2.5rem; text-align:center; max-width:400px;">Calculating live breakdown...</div>
      </div>
    `;

    try {
      const breakdown = await api.employees.getSalaryBreakdown(empId, selectedPeriod);
      const jobs = breakdown.completed_jobs || {};
      const rates = breakdown.rates || {};
      const record = breakdown.existing_record;
      const adjs = breakdown.adjustments || [];

      modalHost.innerHTML = `
        <div class="scrim" id="salary-inspect-scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
          <div class="card" style="width:100%; max-width:680px; max-height:92vh; overflow-y:auto; padding:2rem; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <button id="btn-close-inspect" class="icon-btn" style="position:absolute; top:1.25rem; right:1.25rem; font-size:1.25rem;">&times;</button>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:1rem;">
              <div>
                <h2 style="margin:0;">${breakdown.employee_name}</h2>
                <div style="font-size:0.85rem; color:var(--ink-2); margin-top:2px;">
                  <code>${breakdown.employee_code}</code> &bull; Role: <strong>${breakdown.role_type}</strong> &bull; Period: <strong>${breakdown.period}</strong>
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.75rem; color:var(--ink-2); text-transform:uppercase; font-weight:600;">Status</div>
                <span class="status-badge" style="background:#e8f0fe; color:#1a73e8; font-size:0.9rem;">
                  ${record ? record.status : 'UNBILLED DRAFT'}
                </span>
              </div>
            </div>

            <!-- Breakdown Summary Card -->
            <div class="panel" style="background:var(--brand-surface, #e0f2fe); border:1px solid var(--brand); padding:1.25rem; border-radius:6px; margin-bottom:1.5rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:0.8rem; text-transform:uppercase; font-weight:700; color:var(--brand);">Calculated Total Payout</div>
                  <div style="font-size:2rem; font-weight:800; color:var(--ink); margin-top:2px;">
                    ${window.formatCurrency(breakdown.calculated_total)}
                  </div>
                </div>
                <div style="text-align:right; font-size:0.85rem; color:var(--ink-2);">
                  Wage Model: <strong>${breakdown.salary_model}</strong>
                </div>
              </div>
            </div>

            <!-- Task Piece-rate breakdown -->
            <h4 style="margin:0 0 0.5rem 0;">Completed Work & Task Rates</h4>
            <table class="wf-table" style="font-size:0.85rem; margin-bottom:1.5rem;">
              <thead>
                <tr><th>Component</th><th>Units Completed</th><th>Rate</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base Salary Component</td>
                  <td>--</td>
                  <td>--</td>
                  <td><strong>${window.formatCurrency(breakdown.base_salary || 0)}</strong></td>
                </tr>
                <tr>
                  <td>Picking Tasks</td>
                  <td>${jobs.picking || 0} jobs</td>
                  <td>${window.formatCurrency(rates.picking || 0)} / job</td>
                  <td><strong>${window.formatCurrency((jobs.picking || 0) * (rates.picking || 0))}</strong></td>
                </tr>
                <tr>
                  <td>Packing Tasks</td>
                  <td>${jobs.packing || 0} jobs</td>
                  <td>${window.formatCurrency(rates.packing || 0)} / job</td>
                  <td><strong>${window.formatCurrency((jobs.packing || 0) * (rates.packing || 0))}</strong></td>
                </tr>
                <tr>
                  <td>Delivery Tasks</td>
                  <td>${jobs.delivery || 0} jobs</td>
                  <td>${window.formatCurrency(rates.delivery || 0)} / job</td>
                  <td><strong>${window.formatCurrency((jobs.delivery || 0) * (rates.delivery || 0))}</strong></td>
                </tr>
              </tbody>
            </table>

            <!-- Authorized Adjustments -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <h4 style="margin:0;">Authorized Adjustments (${adjs.length})</h4>
              <button id="btn-toggle-add-adj" class="btn btn-ghost btn-sm" style="font-size:0.8rem;">+ Add Adjustment</button>
            </div>

            <div id="adj-add-form-wrap" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; padding:1rem; border-radius:6px; margin-bottom:1rem;">
              <h5 style="margin:0 0 0.5rem 0;">Add Authorized Adjustment</h5>
              <div style="display:flex; gap:8px; margin-bottom:8px;">
                <input id="adj-amount-input" type="number" step="0.01" class="input" placeholder="Amount (+/-) e.g. 50.00" style="width:140px;">
                <input id="adj-reason-input" type="text" class="input" placeholder="Mandatory reason e.g. Performance bonus" style="flex:1;">
              </div>
              <div style="text-align:right;">
                <button id="btn-submit-adj" class="btn btn-secondary btn-sm">Save Adjustment</button>
              </div>
            </div>

            <div style="margin-bottom:1.5rem;">
              ${adjs.length === 0 ? '<p style="color:var(--ink-2); font-size:0.85rem;">No adjustments added.</p>' : `
                <table class="wf-table" style="font-size:0.85rem;">
                  <thead><tr><th>Amount</th><th>Recorded Reason</th><th>Timestamp</th></tr></thead>
                  <tbody>
                    ${adjs.map(a => `
                      <tr>
                        <td style="font-weight:700; color:${a.amount>=0?'var(--good)':'var(--bad)'};">${a.amount >= 0 ? `+${window.formatCurrency(a.amount)}` : window.formatCurrency(a.amount)}</td>
                        <td>${a.reason}</td>
                        <td style="color:var(--ink-2);">${new Date(a.created_at).toLocaleDateString()}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Action Controls -->
            <div style="display:flex; gap:0.5rem; justify-content:flex-end; border-top:1px solid var(--border); padding-top:1.25rem; flex-wrap:wrap;">
              <button id="btn-calc-generate" class="btn btn-secondary">Calculate & Update Draft</button>
              <button id="btn-finalize-rec" class="btn btn-primary">Finalize Payroll</button>
              ${record && record.status === 'FINALIZED' ? `<button id="btn-mark-paid" class="btn" style="background:#137333; color:#fff;">Mark as Paid</button>` : ''}
            </div>

          </div>
        </div>
      `;

      modalHost.querySelector('#btn-close-inspect').addEventListener('click', () => modalHost.innerHTML = '');
      modalHost.querySelector('#salary-inspect-scrim').addEventListener('click', (e) => {
        if (e.target.id === 'salary-inspect-scrim') modalHost.innerHTML = '';
      });

      // Toggle Add Adjustment Form
      const toggleBtn = modalHost.querySelector('#btn-toggle-add-adj');
      const formWrap = modalHost.querySelector('#adj-add-form-wrap');
      if (toggleBtn && formWrap) {
        toggleBtn.addEventListener('click', () => {
          formWrap.style.display = formWrap.style.display === 'none' ? 'block' : 'none';
        });
      }

      // Submit Adjustment
      const submitAdjBtn = modalHost.querySelector('#btn-submit-adj');
      if (submitAdjBtn) {
        submitAdjBtn.addEventListener('click', async () => {
          const amt = parseFloat(modalHost.querySelector('#adj-amount-input').value);
          const reason = modalHost.querySelector('#adj-reason-input').value.trim();

          if (isNaN(amt) || amt === 0) {
            window.WF.toast('Please enter a valid non-zero adjustment amount.', 'bad');
            return;
          }
          if (!reason) {
            window.WF.toast('A recorded reason is mandatory for financial adjustments.', 'bad');
            return;
          }

          submitAdjBtn.classList.add('loading');
          try {
            // Ensure record exists first
            let recId = record ? record.id : null;
            if (!recId) {
              const gen = await api.employees.finalizeSalary(empId, selectedPeriod, 'DRAFT');
              recId = gen.record_id;
            }
            await api.employees.addSalaryAdjustment(recId, amt, reason);
            window.WF.toast('Adjustment recorded.', 'ok');
            openSalaryInspectModal(empId); // reload modal
            loadPayrollData();
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          } finally {
            submitAdjBtn.classList.remove('loading');
          }
        });
      }

      // Calculate & Generate Draft
      modalHost.querySelector('#btn-calc-generate').addEventListener('click', async () => {
        try {
          await api.employees.finalizeSalary(empId, selectedPeriod, 'DRAFT');
          window.WF.toast('Draft payroll record calculated and updated.', 'ok');
          openSalaryInspectModal(empId);
          loadPayrollData();
        } catch(err) {
          window.WF.toast(err.message, 'bad');
        }
      });

      // Finalize Record
      modalHost.querySelector('#btn-finalize-rec').addEventListener('click', async () => {
        if (!confirm(`Finalize payroll of ${window.formatCurrency(breakdown.calculated_total)} for ${breakdown.employee_name}?`)) return;
        try {
          await api.employees.finalizeSalary(empId, selectedPeriod, 'FINALIZED');
          window.WF.toast('Payroll record finalized.', 'ok');
          openSalaryInspectModal(empId);
          loadPayrollData();
        } catch(err) {
          window.WF.toast(err.message, 'bad');
        }
      });

      // Mark Paid
      const btnMarkPaid = modalHost.querySelector('#btn-mark-paid');
      if (btnMarkPaid && record) {
        btnMarkPaid.addEventListener('click', async () => {
          if (!confirm(`Confirm that payment of ${window.formatCurrency(breakdown.calculated_total)} was disbursed to ${breakdown.employee_name}?`)) return;
          try {
            await api.employees.updateSalaryStatus(record.id, 'PAID');
            window.WF.toast('Payroll marked as PAID.', 'ok');
            openSalaryInspectModal(empId);
            loadPayrollData();
          } catch(err) {
            window.WF.toast(err.message, 'bad');
          }
        });
      }

    } catch(err) {
      modalHost.innerHTML = `
        <div class="scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
          <div class="card" style="padding:2rem; max-width:400px; text-align:center;">
            <p style="color:var(--bad);">Error: ${err.message}</p>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.scrim').remove();">Close</button>
          </div>
        </div>
      `;
    }
  }

  // --- SALARY RULE EDIT MODAL ---
  function openRuleEditModal(existingRule = null) {
    const modalHost = container.querySelector('#salary-modal-host');
    const isEdit = !!existingRule;
    modalHost.innerHTML = `
      <div class="scrim" id="modal-rule-scrim" style="position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:1000; display:flex; justify-content:center; align-items:center; padding:1.5rem;">
        <div class="card" style="width:100%; max-width:500px; padding:2rem; position:relative;">
          <button id="btn-close-rule" class="icon-btn" style="position:absolute; top:1.25rem; right:1.25rem; font-size:1.25rem;">&times;</button>
          <h2 style="margin:0 0 0.5rem 0;">${isEdit ? 'Edit Salary Rule' : 'Configure Salary Rule'}</h2>
          <p style="color:var(--ink-2); font-size:0.85rem; margin-bottom:1.5rem;">
            Set the calculation parameters for this role type across the company.
          </p>

          <form id="form-salary-rule" style="display:flex; flex-direction:column; gap:1rem;">
            <div>
              <label class="field-label">Role Type</label>
              <select id="rule-role" class="input" style="width:100%;" ${isEdit ? 'disabled' : ''}>
                <option value="Picker" ${existingRule?.role_type==='Picker'?'selected':''}>Picker</option>
                <option value="Packer" ${existingRule?.role_type==='Packer'?'selected':''}>Packer</option>
                <option value="Driver" ${existingRule?.role_type==='Driver'?'selected':''}>Driver</option>
                <option value="EMPLOYEE" ${existingRule?.role_type==='EMPLOYEE'?'selected':''}>General Employee</option>
              </select>
            </div>
            <div>
              <label class="field-label">Wage Model</label>
              <select id="rule-model" class="input" style="width:100%;">
                <option value="WORK_BASED" ${existingRule?.salary_model==='WORK_BASED'?'selected':''}>WORK_BASED (Piece Rate + Base)</option>
                <option value="FIXED" ${existingRule?.salary_model==='FIXED'?'selected':''}>FIXED (Monthly Flat Salary)</option>
              </select>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
              <div>
                <label class="field-label">Fixed Base Salary (₹)</label>
                <input id="rule-base" type="number" step="0.5" class="input" style="width:100%;" value="${existingRule?.base_salary || 0}">
              </div>
              <div>
                <label class="field-label">Picking Task Rate (₹)</label>
                <input id="rule-pick" type="number" step="0.5" class="input" style="width:100%;" value="${existingRule?.picking_rate || 0}">
              </div>
              <div>
                <label class="field-label">Packing Task Rate (₹)</label>
                <input id="rule-pack" type="number" step="0.5" class="input" style="width:100%;" value="${existingRule?.packing_rate || 0}">
              </div>
              <div>
                <label class="field-label">Delivery Task Rate (₹)</label>
                <input id="rule-del" type="number" step="0.5" class="input" style="width:100%;" value="${existingRule?.delivery_rate || 0}">
              </div>
            </div>
            <div>
              <label class="field-label">Overtime Rate (₹ / Hr)</label>
              <input id="rule-ot" type="number" step="0.5" class="input" style="width:100%;" value="${existingRule?.overtime_rate || 0}">
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;">Save Salary Rule</button>
          </form>
        </div>
      </div>
    `;

    modalHost.querySelector('#btn-close-rule').addEventListener('click', () => modalHost.innerHTML = '');
    modalHost.querySelector('#modal-rule-scrim').addEventListener('click', (e) => {
      if (e.target.id === 'modal-rule-scrim') modalHost.innerHTML = '';
    });

    const form = modalHost.querySelector('#form-salary-rule');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.classList.add('loading');
      try {
        const role = modalHost.querySelector('#rule-role').value;
        const model = modalHost.querySelector('#rule-model').value;
        const base = parseFloat(modalHost.querySelector('#rule-base').value) || 0;
        const pick = parseFloat(modalHost.querySelector('#rule-pick').value) || 0;
        const pack = parseFloat(modalHost.querySelector('#rule-pack').value) || 0;
        const del = parseFloat(modalHost.querySelector('#rule-del').value) || 0;
        const ot = parseFloat(modalHost.querySelector('#rule-ot').value) || 0;

        await api.employees.createSalaryRule({
          role_type: role,
          salary_model: model,
          base_salary: base,
          picking_rate: pick,
          packing_rate: pack,
          delivery_rate: del,
          overtime_rate: ot
        });

        window.WF.toast('Salary rule saved successfully.', 'ok');
        modalHost.innerHTML = '';
        loadPayrollData();
      } catch(err) {
        window.WF.toast(err.message, 'bad');
      } finally {
        btn.classList.remove('loading');
      }
    });
  }

  // Initial Data Load
  loadPayrollData();
};
