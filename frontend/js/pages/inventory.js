window.pages = window.pages || {};

window.pages.inventory = async function(container) {
  const api = window.apiClient;
  
  try {
      const [inventory, products] = await Promise.all([
          api.inventory.getAll(),
          api.products.getAll()
      ]);

      const rows = inventory.map(i => {
        const p = products.find(prod => prod.id === i.product_id);
        return `
          <tr>
            <td><b>${i.id}</b></td>
            <td>${p ? p.name : i.product_id}</td>
            <td>${i.quantity} ${p ? p.unit : ''}</td>
            <td>Pos: ${i.position_id || 'N/A'}</td>
            <td><span class="status-badge ${i.quantity < 50 ? 'status-delayed' : 'status-completed'}">${i.quantity < 50 ? 'Low Stock' : 'Healthy'}</span></td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Inventory</h1>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-ghost" onclick="window.pages.inventory.showCSVForm()"><i data-icon="upload"></i> Import CSV</button>
            <button class="btn btn-primary" onclick="window.pages.inventory.showMovementForm()"><i data-icon="refresh"></i> Adjust Stock</button>
          </div>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows : '<tr><td colspan="5">No inventory found.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="inventory-modal-container"></div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading inventory: ${e.message}</p>`;
  }
};

window.pages.inventory.showMovementForm = async function() {
    const products = await window.apiClient.products.getAll();
    const prodOptions = products.map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');

    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="inv-form-scrim">
        <div class="card" style="width: 100%; max-width: 500px; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('inv-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Adjust Stock / Receive</h3>
          </div>
          <form id="inv-form" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Product *</label>
              <select id="inv-product" class="wf-input" required style="width:100%;">
                ${prodOptions}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Type *</label>
              <select id="inv-type" class="wf-input" required style="width:100%;" onchange="
                const isMove = this.value === 'MOVE';
                document.getElementById('from-pos-container').style.display = isMove ? 'block' : 'none';
                document.getElementById('to-pos-container').style.display = isMove ? 'block' : 'none';
                document.getElementById('warehouse-container').style.display = isMove ? 'none' : 'block';
              ">
                <option value="RECEIVE">Receive Stock</option>
                <option value="MOVE">Move Stock</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Quantity *</label>
              <input type="number" id="inv-qty" class="wf-input" required min="1" style="width:100%;" />
            </div>
            <div class="form-group" id="from-pos-container" style="display:none; margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">From Position ID</label>
              <input type="number" id="inv-from-pos" class="wf-input" style="width:100%;" />
            </div>
            <div class="form-group" id="to-pos-container" style="display:none; margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">To Position ID</label>
              <input type="number" id="inv-to-pos" class="wf-input" style="width:100%;" />
            </div>
            <div class="form-group" id="warehouse-container" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Warehouse ID</label>
              <input type="number" id="inv-warehouse-id" class="wf-input" style="width:100%;" />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('inv-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="inv-submit-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('inventory-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('inventory-modal-container'));
    
    document.getElementById('inv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('inv-submit-btn');
        btn.disabled = true;
        btn.textContent = "Saving...";
        
        try {
            const mType = document.getElementById('inv-type').value;
            if (mType === 'RECEIVE') {
                await window.apiClient.inventory.receive({
                    product_id: parseInt(document.getElementById('inv-product').value),
                    warehouse_id: parseInt(document.getElementById('inv-warehouse-id').value) || 1,
                    quantity: parseInt(document.getElementById('inv-qty').value),
                    receipt_reference: 'MANUAL-RECEIPT'
                });
                window.WF.toast('Stock received successfully. AI Recommendation pending.', 'good');
            } else {
                await window.apiClient.inventory.move({
                    product_id: parseInt(document.getElementById('inv-product').value),
                    quantity: parseInt(document.getElementById('inv-qty').value),
                    movement_type: 'MOVE',
                    from_position: parseInt(document.getElementById('inv-from-pos').value),
                    to_position: parseInt(document.getElementById('inv-to-pos').value)
                });
                window.WF.toast('Inventory moved successfully', 'good');
            }
            
            document.getElementById('inv-form-scrim').remove();
            // Refresh
            window.pages.inventory(document.getElementById('router-view'));
        } catch (err) {
            window.WF.toast(err.message, 'bad');
            btn.disabled = false;
            btn.textContent = "Save";
        }
    });
};

window.pages.inventory.showCSVForm = function() {
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="inv-csv-form-scrim">
        <div class="card" style="width: 100%; max-width: 500px; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('inv-csv-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Import Inventory CSV</h3>
          </div>
          <form id="inv-csv-form" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
              <p style="margin-bottom:1rem; color:var(--text-dim); font-size:14px;">
                Your CSV must include <code>sku</code>, <code>warehouse_code</code>, and <code>quantity</code> columns.<br>
                Optional: <code>receipt_reference</code>.
              </p>
              <input type="file" id="inv-csv-file" accept=".csv" required style="width:100%;" />
            </div>
            
            <div id="inv-csv-results" style="margin-top:1rem; font-size:14px; max-height:200px; overflow-y:auto;"></div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('inv-csv-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="inv-csv-submit-btn">Upload</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('inventory-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('inventory-modal-container'));
    
    document.getElementById('inv-csv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('inv-csv-file');
        const file = fileInput.files[0];
        if (!file) return;
        
        const btn = document.getElementById('inv-csv-submit-btn');
        btn.disabled = true;
        btn.textContent = "Uploading...";
        const resultsDiv = document.getElementById('inv-csv-results');
        resultsDiv.innerHTML = 'Uploading and processing...';
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const result = await window.apiClient.inventory.importCSV(formData);
            window.WF.toast(`Imported ${result.imported} inventory records.`, 'good');
            
            let html = `<strong style="color:green;">Successfully imported: ${result.imported} rows.</strong><br>`;
            if (result.errors && result.errors.length > 0) {
                html += `<br><strong style="color:red;">Errors (${result.errors.length}):</strong><ul style="margin:4px 0 0 16px; color:red;">`;
                result.errors.forEach(err => {
                    html += `<li>${err}</li>`;
                });
                html += '</ul>';
            }
            resultsDiv.innerHTML = html;
            
            btn.textContent = "Done";
            btn.disabled = false;
            btn.onclick = () => {
                document.getElementById('inv-csv-form-scrim').remove();
                window.pages.inventory(document.getElementById('router-view'));
            };
        } catch(err) {
            resultsDiv.innerHTML = `<span style="color:red;">Error: ${err.message}</span>`;
            btn.disabled = false;
            btn.textContent = "Retry";
        }
    });
};


window.pages.picking = async function(container) {
  const api = window.apiClient;
  
  try {
      const jobs = await api.jobs.getAll();
      const pickingJobs = jobs.filter(j => j.job_type === 'PICKING');

      const rows = pickingJobs.map(j => `
        <tr>
          <td><b>JOB-${j.id}</b></td>
          <td>ORD-${j.order_id}</td>
          <td>${j.employee_id || 'Unassigned'}</td>
          <td>${j.estimated_minutes || 0} min</td>
          <td><span class="status-badge status-${j.status.toLowerCase().replace(' ','-')}">${j.status}</span></td>
          <td>
            ${j.status === 'PENDING' ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.picking.assign('${j.id}')">Assign</button>` : ''}
            ${j.status === 'ASSIGNED' ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.picking.accept('${j.id}')">Accept</button>
                                         <button class="btn btn-ghost btn-sm" onclick="window.pages.picking.reject('${j.id}')" style="color:var(--text-error);">Reject</button>` : ''}
            ${(j.status === 'ACCEPTED' || j.status === 'STARTED') ? `<button class="btn btn-primary btn-sm" onclick="window.pages.picking.complete('${j.id}')">Complete</button>` : ''}
          </td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Picking Jobs</h1>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Order ID</th>
                <th>Employee</th>
                <th>Est. Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows : '<tr><td colspan="6" style="text-align:center">No picking jobs.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading jobs: ${e.message}</p>`;
  }
};

window.pages.picking.assign = async function(jobId) {
    window.showAssignModal(jobId, () => window.pages.picking(document.getElementById('router-view')));
};

window.pages.picking.accept = async function(jobId) {
    try {
        await window.apiClient.jobs.accept(jobId);
        window.WF.toast('Job accepted', 'good');
        window.pages.picking(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to accept job: ' + e.message, 'bad');
    }
};

window.pages.picking.reject = async function(jobId) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
        await window.apiClient.jobs.reject(jobId, reason || 'No reason');
        window.WF.toast('Job rejected', 'good');
        window.pages.picking(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to reject job: ' + e.message, 'bad');
    }
};

window.pages.picking.complete = async function(jobId) {
    try {
        await window.apiClient.jobs.complete(jobId);
        window.WF.toast('Job completed successfully', 'good');
        window.pages.picking(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to complete job: ' + e.message, 'bad');
    }
};

window.pages.employees = async function(container) {
  const api = window.apiClient;
  try {
      const emps = await api.employees.getAll();

      const rows = emps.map(e => `
        <tr>
          <td><b>${e.id}</b></td>
          <td>${e.first_name} ${e.last_name}</td>
          <td>${e.role_type || e.role || '-'}</td>
          <td>${e.shift_start ? e.shift_start + '-' + e.shift_end : 'No shift'}</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="bar" style="width:100px; background:#DCE6EC; height:6px; border-radius:3px;">
                <i style="--w:${e.current_workload || 0}%; background: ${(e.current_workload || 0) > 80 ? '#e5573f' : '#388E3C'}; display:block; height:100%; border-radius:3px;"></i>
              </div>
              <span style="font-size:12px;">${e.current_workload || 0}%</span>
            </div>
          </td>
          <td>${e.performance_score || 0}%</td>
          <td>${e.completed_jobs || 0}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Employees</h1>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Shift</th>
                <th>Workload</th>
                <th>Performance</th>
                <th>Completed Jobs</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length > 0 ? rows : '<tr><td colspan="7" style="text-align:center">No employees found.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
  } catch (err) {
      container.innerHTML = `<p>Error loading employees: ${err.message}</p>`;
  }
};
