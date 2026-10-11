window.pages = window.pages || {};
window.pages.jobs = async function(container) {
  const api = window.apiClient;
  
  try {
      const jobs = await api.jobs.getAll();

      const rows = jobs.map(j => `
        <tr>
          <td><b>${j.id}</b></td>
          <td>${j.job_type}</td>
          <td>${j.order_id ? 'Order #' + j.order_id : 'Inventory'}</td>
          <td><span class="pill ${j.priority === 'HIGH' || j.priority === '1' ? 'pill-high' : ''}">Priority ${j.priority}</span></td>
          <td>${j.estimated_minutes || '-'} mins</td>
          <td><span class="status-badge status-${j.status.toLowerCase()}">${j.status}</span></td>
          <td>
            ${j.job_type === 'PICKING' && j.order_id ? `
              <button class="btn btn-ghost btn-sm" onclick="window.pages.jobs.route('${j.order_id}')"><i data-icon="activity"></i> Route</button>
            ` : ''}
            ${j.status === 'PENDING' || j.status === 'REJECTED' ? `
              <button class="btn btn-ghost btn-sm" onclick="window.pages.jobs.assign('${j.id}')">Assign</button>
              <button class="btn btn-primary btn-sm" onclick="window.pages.jobs.recommend('${j.id}')"><i data-icon="spark"></i> AI Recommend</button>
            ` : ''}
            ${j.status === 'ASSIGNED' ? `
              <span class="hint" style="margin-right: 8px;">Emp ID: ${j.employee_id}</span>
              <button class="btn btn-ghost btn-sm" onclick="window.pages.jobs.accept('${j.id}')">Accept</button>
              <button class="btn btn-ghost btn-sm" onclick="window.pages.jobs.reject('${j.id}')" style="color:var(--text-error);">Reject</button>
            ` : ''}
            ${(j.status === 'ACCEPTED' || j.status === 'STARTED') ? `
              <span class="hint" style="margin-right: 8px;">Emp ID: ${j.employee_id}</span>
              <button class="btn btn-primary btn-sm" onclick="window.pages.jobs.complete('${j.id}')">Complete</button>
            ` : ''}
            ${j.status === 'COMPLETED' ? `
              <span class="hint">Done by: ${j.employee_id}</span>
            ` : ''}
          </td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Active Jobs</h1>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Type</th>
                <th>Context</th>
                <th>Priority</th>
                <th>Est. Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length > 0 ? rows : '<tr><td colspan="7" style="text-align:center">No active jobs.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading jobs: ${e.message}</p>`;
  }
};

window.pages.jobs.assign = async function(jobId) {
    try {
        const employees = await window.apiClient.employees.getAll();
        const activeEmps = employees.filter(e => e.status === 'ACTIVE');
        
        if (activeEmps.length === 0) {
            window.WF.toast('No active employees available to assign.', 'bad');
            return;
        }

        const options = activeEmps.map(e => `<option value="${e.id}">${e.first_name} ${e.last_name} (ID: ${e.id})</option>`).join('');

        const modalHtml = `
          <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="assign-modal-scrim">
            <div class="card" style="width: 100%; max-width: 400px; position:relative; pointer-events:auto;">
              <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('assign-modal-scrim').remove()"><i data-icon="x"></i></button>
              <div class="card-h">
                <h3>Assign Employee</h3>
              </div>
              <div style="padding-top: 1rem;">
                  <div class="form-group">
                      <label style="font-size: 0.85rem; font-weight: 600;">Select Employee</label>
                      <select id="assign-emp-select" class="wf-input" style="width:100%; margin-top:0.5rem; padding: 0.5rem;">
                          ${options}
                      </select>
                  </div>
              </div>
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
                  <button class="btn btn-ghost" onclick="document.getElementById('assign-modal-scrim').remove()">Cancel</button>
                  <button class="btn btn-primary" onclick="window.pages.jobs.submitAssign('${jobId}')">Assign</button>
              </div>
            </div>
          </div>
        `;
        
        const container = document.body;
        const temp = document.createElement('div');
        temp.innerHTML = modalHtml;
        container.appendChild(temp.firstElementChild);
        
        if (window.WF && typeof window.WF.hydrate === 'function') {
            window.WF.hydrate(document.getElementById('assign-modal-scrim'));
        }
    } catch(e) {
        window.WF.toast('Error fetching employees: ' + e.message, 'bad');
    }
};

window.pages.jobs.submitAssign = async function(jobId) {
    const empId = document.getElementById('assign-emp-select').value;
    if (!empId) return;
    try {
        await window.apiClient.jobs.assign(jobId, parseInt(empId));
        document.getElementById('assign-modal-scrim').remove();
        window.WF.toast('Job assigned successfully.', 'good');
        window.pages.jobs(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Error assigning job: ' + e.message, 'bad');
    }
};

window.pages.jobs.recommend = async function(jobId) {
    try {
        await window.apiClient.ai.recommendEmployee(jobId);
        window.WF.toast('Recommendation generated! Check AI Decision Center.', 'ok');
    } catch(e) {
        window.WF.toast('Error generating recommendation: ' + e.message, 'bad');
    }
};

window.pages.jobs.accept = async function(jobId) {
    try {
        await window.apiClient.jobs.accept(jobId);
        window.WF.toast('Job accepted.', 'good');
        window.pages.jobs(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Error accepting job: ' + e.message, 'bad');
    }
};

window.pages.jobs.reject = async function(jobId) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
        await window.apiClient.jobs.reject(jobId, reason || 'No reason');
        window.WF.toast('Job rejected.', 'good');
        window.pages.jobs(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Error rejecting job: ' + e.message, 'bad');
    }
};

window.pages.jobs.complete = async function(jobId) {
    try {
        await window.apiClient.jobs.complete(jobId);
        window.WF.toast('Job completed. Inventory updated.', 'good');
        window.pages.jobs(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Error completing job: ' + e.message, 'bad');
    }
};

window.pages.jobs.route = async function(orderId) {
    try {
        const routeData = await window.apiClient.ai.recommendRoute(orderId);
        const steps = routeData.route.map((r, i) => `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${i+1}. Go to ${r.position_code}</strong><br>
                <span class="hint">Pick ${r.quantity} units of Product ${r.product_id}</span>
            </div>
        `).join('');
        
        const modalHtml = `
          <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="route-modal-scrim">
            <div class="card" style="width: 100%; max-width: 500px; position:relative; pointer-events:auto;">
              <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('route-modal-scrim').remove()"><i data-icon="x"></i></button>
              <div class="card-h">
                <h3>Optimized Picking Route</h3>
              </div>
              <p style="margin-top:0.5rem; color:#666;">Estimated Time: <strong>${routeData.estimated_time_minutes.toFixed(1)} min</strong></p>
              <div style="max-height: 300px; overflow-y: auto; margin-top: 1rem; border: 1px solid #eee; border-radius: 4px;">
                ${steps}
              </div>
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
                  <button class="btn btn-primary" onclick="document.getElementById('route-modal-scrim').remove()">Close</button>
              </div>
            </div>
          </div>
        `;
        const temp = document.createElement('div');
        temp.innerHTML = modalHtml;
        document.body.appendChild(temp.firstElementChild);
        window.WF.hydrate(document.getElementById('route-modal-scrim'));
    } catch(e) {
        window.WF.toast('Error fetching route: ' + e.message, 'bad');
    }
};
