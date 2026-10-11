window.pages = window.pages || {};

window.pages.packing = async function(container) {
  const api = window.apiClient;
  
  try {
      const jobs = await api.jobs.getAll();
      const packingJobs = jobs.filter(j => j.job_type === 'PACKING');

      const rows = packingJobs.map(j => `
        <tr>
          <td><b>JOB-${j.id}</b></td>
          <td>ORD-${j.order_id}</td>
          <td>${j.employee_id || 'Unassigned'}</td>
          <td>${j.estimated_minutes || 15} min</td>
          <td><span class="status-badge status-${j.status.toLowerCase().replace(' ','-')}">${j.status}</span></td>
          <td>
            ${j.status === 'PENDING' ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.packing.assign('${j.id}')">Assign to me</button>` : ''}
            ${j.status === 'ASSIGNED' ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.packing.accept('${j.id}')">Accept</button>
                                         <button class="btn btn-ghost btn-sm" onclick="window.pages.packing.reject('${j.id}')" style="color:var(--text-error);">Reject</button>` : ''}
            ${(j.status === 'ACCEPTED' || j.status === 'STARTED') ? `<button class="btn btn-primary btn-sm" onclick="window.pages.packing.showCompleteForm('${j.id}')">Complete Packing</button>` : ''}
          </td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Packing Jobs</h1>
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
              ${rows.length ? rows : '<tr><td colspan="6" style="text-align:center">No packing jobs.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="packing-modal-container"></div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading jobs: ${e.message}</p>`;
  }
};

window.pages.packing.assign = async function(jobId) {
    window.showAssignModal(jobId, () => window.pages.packing(document.getElementById('router-view')));
};

window.pages.packing.accept = async function(jobId) {
    try {
        await window.apiClient.jobs.accept(jobId);
        window.WF.toast('Job accepted', 'good');
        window.pages.packing(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to accept job: ' + e.message, 'bad');
    }
};

window.pages.packing.reject = async function(jobId) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
        await window.apiClient.jobs.reject(jobId, reason || 'No reason');
        window.WF.toast('Job rejected', 'good');
        window.pages.packing(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to reject job: ' + e.message, 'bad');
    }
};

window.pages.packing.showCompleteForm = function(jobId) {
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="packing-form-scrim">
        <div class="card" style="width: 100%; max-width: 400px; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('packing-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Complete Packing</h3>
          </div>
          <form id="packing-form" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Package Type</label>
              <select id="p-type" class="wf-input" style="width:100%;">
                <option value="BOX">Standard Box</option>
                <option value="ENVELOPE">Envelope</option>
                <option value="PALLET">Pallet</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Weight (kg)</label>
              <input type="number" id="p-weight" step="0.1" class="wf-input" style="width:100%;" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('packing-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="p-submit-btn">Complete Job</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('packing-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('packing-modal-container'));
    
    document.getElementById('packing-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('p-submit-btn');
        btn.disabled = true;
        btn.textContent = "Processing...";
        
        try {
            await window.apiClient.jobs.complete(jobId);
            window.WF.toast('Packing completed successfully', 'good');
            document.getElementById('packing-form-scrim').remove();
            window.pages.packing(document.getElementById('router-view'));
        } catch(err) {
            window.WF.toast('Failed to complete job: ' + err.message, 'bad');
            btn.disabled = false;
            btn.textContent = "Complete Job";
        }
    });
};

window.pages.deliveries = async function(container) {
  const api = window.apiClient;
  
  try {
      const jobs = await api.jobs.getAll();
      const deliveryJobs = jobs.filter(j => j.job_type === 'DELIVERY');

      const rows = deliveryJobs.map(j => `
        <tr>
          <td><b>JOB-${j.id}</b></td>
          <td>ORD-${j.order_id}</td>
          <td>${j.employee_id || 'Unassigned'}</td>
          <td>${j.estimated_minutes || 60} min</td>
          <td><span class="status-badge status-${j.status.toLowerCase().replace(' ','-')}">${j.status}</span></td>
          <td>
            ${j.status === 'PENDING' ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.deliveries.assign('${j.id}')">Assign</button>` : ''}
            ${j.status === 'ASSIGNED' ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.deliveries.accept('${j.id}')">Accept</button>
                                         <button class="btn btn-ghost btn-sm" onclick="window.pages.deliveries.reject('${j.id}')" style="color:var(--text-error);">Reject</button>` : ''}
            ${(j.status === 'ACCEPTED' || j.status === 'STARTED') ? `<button class="btn btn-primary btn-sm" onclick="window.pages.deliveries.complete('${j.id}')">Complete Delivery</button>` : ''}
          </td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Deliveries</h1>
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
              ${rows.length ? rows : '<tr><td colspan="6" style="text-align:center">No delivery jobs.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading deliveries: ${e.message}</p>`;
  }
};

window.pages.deliveries.assign = async function(jobId) {
    window.showAssignModal(jobId, () => window.pages.deliveries(document.getElementById('router-view')));
};

window.showAssignModal = async function(jobId, refreshCallback) {
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="assign-form-scrim">
        <div class="card" style="width: 100%; max-width: 500px; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('assign-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Assign Job ${jobId}</h3>
          </div>
          <div id="ai-recs" style="margin-top:1rem; padding:1rem; background:#f0f4f8; border-radius:4px; font-size:14px;">
            Loading AI Recommendations...
          </div>
          <form id="assign-form" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Select Employee</label>
              <select id="assign-emp-id" class="wf-input" required style="width:100%;">
                <option value="">Loading...</option>
              </select>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('assign-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="assign-submit-btn">Assign</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    let container = document.getElementById('global-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'global-modal-container';
        document.body.appendChild(container);
    }
    container.innerHTML = modalHtml;
    
    try {
        const [emps, recs] = await Promise.all([
            window.apiClient.employees.getAll(),
            window.apiClient.ai.recommendEmployee(jobId).catch(() => ({ recommendations: [] }))
        ]);
        
        const select = document.getElementById('assign-emp-id');
        select.innerHTML = emps.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');
        
        const aiDiv = document.getElementById('ai-recs');
        if (recs && recs.employeeId) {
            const best = recs;
            const empName = emps.find(e => e.id == best.employeeId)?.name || best.name;
            aiDiv.innerHTML = `<strong>AI Suggests:</strong> ${empName} <br><span style="color:#5AA3C7">Confidence: ${best.confidence}%</span><br><small>${best.reason}</small>`;
            select.value = best.employeeId;
        } else {
            aiDiv.innerHTML = "No specific AI recommendations available right now.";
        }
    } catch (e) {
        document.getElementById('ai-recs').innerHTML = "Failed to load recommendations.";
    }
    
    document.getElementById('assign-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const empId = document.getElementById('assign-emp-id').value;
        if (!empId) return;
        const btn = document.getElementById('assign-submit-btn');
        btn.disabled = true;
        btn.textContent = "Assigning...";
        try {
            await window.apiClient.jobs.assign(jobId, empId);
            window.WF.toast('Job assigned successfully', 'good');
            document.getElementById('assign-form-scrim').remove();
            if (refreshCallback) refreshCallback();
        } catch(err) {
            window.WF.toast(err.message, 'bad');
            btn.disabled = false;
            btn.textContent = "Assign";
        }
    });
};

window.pages.deliveries.accept = async function(jobId) {
    try {
        await window.apiClient.jobs.accept(jobId);
        window.WF.toast('Job accepted', 'good');
        window.pages.deliveries(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to accept job: ' + e.message, 'bad');
    }
};

window.pages.deliveries.reject = async function(jobId) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
        await window.apiClient.jobs.reject(jobId, reason || 'No reason');
        window.WF.toast('Job rejected', 'good');
        window.pages.deliveries(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to reject job: ' + e.message, 'bad');
    }
};

window.pages.deliveries.complete = async function(jobId) {
    try {
        await window.apiClient.jobs.complete(jobId);
        window.WF.toast('Delivery completed successfully', 'good');
        window.pages.deliveries(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to complete delivery: ' + e.message, 'bad');
    }
};

window.pages.demand = async function(container) {
  try {
      const products = await window.apiClient.products.getAll();
      const options = products.map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');
      
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Demand Forecast</h1>
        </div>
        
        <div class="panel" style="margin-bottom:2rem;">
          <form id="demand-form" style="display:flex; gap:16px; align-items:flex-end;">
            <div class="form-group" style="flex:1;">
              <label style="display:block; margin-bottom:4px;">Select Product</label>
              <select id="demand-product" class="wf-input" style="width:100%;">
                ${options || '<option disabled>No products available</option>'}
              </select>
            </div>
            <button type="submit" class="btn btn-primary" ${!products.length ? 'disabled' : ''}>Generate Forecast</button>
          </form>
        </div>
        
        <div id="demand-results">
           <div class="emptystate"><h2>Select a product to view its AI demand forecast</h2></div>
        </div>
      `;
      
      const form = document.getElementById('demand-form');
      form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = form.querySelector('button[type="submit"]');
          const resultsDiv = document.getElementById('demand-results');
          const productId = document.getElementById('demand-product').value;
          
          if (!productId) return;
          
          btn.classList.add('loading');
          btn.disabled = true;
          resultsDiv.innerHTML = '<div class="panel" style="text-align:center;">Analyzing historical data and running RandomForest predictions...</div>';
          
          try {
              const forecast = await window.apiClient.ai.getDemand(productId);
              
              let rows = '';
              if (forecast.forecast && forecast.forecast.length > 0) {
                  rows = forecast.forecast.map(f => `
                      <tr>
                        <td>${f.date}</td>
                        <td><strong>${Math.round(f.predicted_demand)}</strong> units</td>
                      </tr>
                  `).join('');
              } else {
                  rows = '<tr><td colspan="2">No forecast available</td></tr>';
              }
              
              resultsDiv.innerHTML = `
                  <div class="panel">
                    <h3>Forecast Results for Product #${productId}</h3>
                    <p style="color:var(--text-dim); margin-bottom:1rem;">Model Version: ${forecast.model_version || 'N/A'}</p>
                    
                    <table class="wf-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Predicted Demand</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rows}
                      </tbody>
                    </table>
                  </div>
              `;
          } catch(err) {
              resultsDiv.innerHTML = `<div class="panel" style="color:red">Failed to generate forecast: ${err.message}. Not enough historical data to run ML model.</div>`;
          } finally {
              btn.classList.remove('loading');
              btn.disabled = false;
          }
      });
      
  } catch (err) {
      container.innerHTML = `<div class="panel" style="color:red">Error loading products: ${err.message}</div>`;
  }
};
