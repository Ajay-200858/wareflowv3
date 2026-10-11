window.pages = window.pages || {};

window.pages.products = async function(container) {
  const api = window.apiClient;
  
  try {
      const [products, inventory] = await Promise.all([
          api.products.getAll(),
          api.inventory.getAll()
      ]);

      const rows = await Promise.all(products.map(async p => {
        const inv = inventory.filter(i => i.product_id === p.id).reduce((sum, i) => sum + i.quantity, 0);
        let demand = { p7: 'N/A', trend: 'Insufficient Data' };
        try {
            const d = await api.ai.getDemand(p.id);
            if (d.forecast_7_day !== undefined && d.forecast_7_day !== null) {
                demand = { p7: d.forecast_7_day, trend: d.trend || 'N/A' };
            }
        } catch(e) {} // ignore demand fail
        
        return `
          <tr>
            <td><b>${p.id}</b></td>
            <td>${p.sku}</td>
            <td>${p.name}</td>
            <td><span class="pill">${p.category || 'Other'}</span></td>
            <td>${inv} ${p.unit}</td>
            <td>
              <span style="color:${demand.trend==='Increasing'?'#e5573f':(demand.trend==='Decreasing'?'#8FA9B8':'#F5B335')}">
                ${demand.p7 === 'N/A' ? 'N/A (Insufficient Data)' : demand.p7 + ' (' + demand.trend + ')'}
              </span>
            </td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="window.pages.products.showManageStock('${p.id}', '${p.sku}')">Receive Stock</button>
              <button class="btn btn-ghost btn-sm" onclick="window.pages.products.editProduct('${p.id}')">Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="window.pages.products.deleteProduct('${p.id}')" style="color:var(--text-error);">Delete</button>
            </td>
          </tr>
        `;
      }));

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <div>
            <h1 style="margin:0;">Incoming Products</h1>
            <p style="margin:4px 0 0 0; color:var(--text-dim); font-size:14px;">Register catalogue items, receive incoming stock, and manage ML storage put-away</p>
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-ghost" onclick="window.pages.products.showCSVForm()"><i data-icon="upload"></i> Import CSV</button>
            <button class="btn btn-primary" onclick="window.pages.products.showProductForm()"><i data-icon="plus"></i> Add Product</button>
          </div>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>7-Day Demand</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join('')}
            </tbody>
          </table>
        </div>
        <div id="product-modal-container"></div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading products: ${e.message}</p>`;
  }
};

window.pages.products.showProductForm = function(product = null) {
    const isEdit = !!product;
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="product-form-scrim">
        <div class="card" style="width: 100%; max-width: 500px; max-height: 90vh; overflow-y:auto; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('product-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          </div>
          <form id="product-form" style="margin-top:1rem;">
            ${isEdit ? `<input type="hidden" id="p-id" value="${product.id}" />` : ''}
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">SKU *</label>
              <input type="text" id="p-sku" class="wf-input" required value="${isEdit ? product.sku : ''}" style="width:100%; box-sizing:border-box;" />
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Name *</label>
              <input type="text" id="p-name" class="wf-input" required value="${isEdit ? product.name : ''}" style="width:100%; box-sizing:border-box;" />
            </div>
            <div class="form-group" style="margin-bottom:1rem; display:flex; gap:1rem;">
              <div style="flex:1;">
                  <label style="display:block; margin-bottom:4px;">Unit *</label>
                  <input type="text" id="p-unit" class="wf-input" required value="${isEdit ? product.unit : 'pcs'}" style="width:100%; box-sizing:border-box;" />
              </div>
              <div style="flex:1;">
                  <label style="display:block; margin-bottom:4px;">Weight (kg)</label>
                  <input type="number" step="0.01" id="p-weight" class="wf-input" value="${isEdit && product.weight ? product.weight : ''}" style="width:100%; box-sizing:border-box;" />
              </div>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Storage Type</label>
              <select id="p-storage" class="wf-input" style="width:100%; box-sizing:border-box;">
                  <option value="GENERAL" ${isEdit && product.storage_type==='GENERAL'?'selected':''}>General</option>
                  <option value="COLD" ${isEdit && product.storage_type==='COLD'?'selected':''}>Cold Storage</option>
                  <option value="HAZARDOUS" ${isEdit && product.storage_type==='HAZARDOUS'?'selected':''}>Hazardous</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="p-expiry" ${isEdit && product.expiry_required ? 'checked' : ''} />
                Requires Expiry Tracking
              </label>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('product-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="p-submit-btn">Save Product</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('product-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('product-modal-container'));
    
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('p-submit-btn');
        btn.disabled = true;
        btn.textContent = "Saving...";
        
        try {
            const payload = {
                sku: document.getElementById('p-sku').value,
                name: document.getElementById('p-name').value,
                category: "Other", // Simplified for now
                unit: document.getElementById('p-unit').value,
                price: 0,
                weight: parseFloat(document.getElementById('p-weight').value) || null,
                storage_type: document.getElementById('p-storage').value,
                minimum_stock: 0,
                expiry_required: document.getElementById('p-expiry').checked
            };
            
            if (isEdit) {
                const id = document.getElementById('p-id').value;
                await window.apiClient.products.update(id, payload);
                window.WF.toast('Product updated successfully', 'good');
            } else {
                await window.apiClient.products.create(payload);
                window.WF.toast('Product created successfully', 'good');
            }
            
            document.getElementById('product-form-scrim').remove();
            // Refresh
            window.pages.products(document.getElementById('router-view'));
        } catch (err) {
            window.WF.toast(err.message, 'bad');
            btn.disabled = false;
            btn.textContent = "Save Product";
        }
    });
};

window.pages.products.editProduct = async function(productId) {
    try {
        const p = await window.apiClient.products.getOne(productId);
        window.pages.products.showProductForm(p);
    } catch(e) {
        window.WF.toast('Failed to load product details: ' + e.message, 'bad');
    }
};

window.pages.products.deleteProduct = async function(productId) {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    try {
        await window.apiClient.products.delete(productId);
        window.WF.toast('Product deactivated successfully', 'good');
        window.pages.products(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to delete product: ' + e.message, 'bad');
    }
};


window.pages.products.showDetail = async function(productId) {
    const api = window.apiClient;
    try {
        const p = await api.products.getOne(productId);
        const inv = await api.inventory.getAll();
        const pInv = inv.filter(i => i.product_id == productId);
        const totalInv = pInv.reduce((sum, i) => sum + i.quantity, 0);
        const demand = await api.ai.getDemand(productId);
        
        // This is a simplified location representation
        const locs = pInv.map(i => `<div style="padding:4px 8px; background:#f0f4f8; border-radius:4px; margin-bottom:4px; font-family:monospace;">Position ID: ${i.position_id || 'Unknown'} (${i.quantity})</div>`).join('');
        
        const modalHtml = `
          <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" onclick="this.remove()">
            <div class="card" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y:auto; position:relative; pointer-events:auto;" onclick="event.stopPropagation()">
              <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="this.closest('.scrim').remove()"><i data-icon="x"></i></button>
              <div class="card-h">
                <h3>${p.name}</h3>
                <span class="pill">${p.category}</span>
              </div>
              
              <div class="dgrid" style="margin-top:1rem; grid-template-columns: 1fr 1fr;">
                 <div>
                   <dl class="dl">
                     <div><dt>ID</dt><dd>${p.id}</dd></div>
                     <div><dt>SKU</dt><dd>${p.sku}</dd></div>
                     <div><dt>Unit Type</dt><dd>${p.unit}</dd></div>
                     <div><dt>Price</dt><dd>₹${p.price}</dd></div>
                     <div><dt>Current Stock</dt><dd>${totalInv}</dd></div>
                   </dl>
                 </div>
                 <div>
                   <div style="background:#F7F9FA; padding:16px; border-radius:8px; margin-bottom:16px;">
                     <h4 style="margin:0 0 8px 0; color:#12202C;"><i data-icon="rank"></i> ${demand.confidence === 0 ? 'Rule-based Forecast' : 'AI Demand Forecast'}</h4>
                     <div style="font-size:24px; font-weight:700;">${demand.forecast_7_day} <small style="font-size:14px; font-weight:normal; color:#5AA3C7;">units next 7 days</small></div>
                     <div style="color:${demand.trend==='Increasing'?'#e5573f':'#F5B335'}; font-size:14px; margin-top:4px;">Trend: ${demand.trend} ${demand.confidence > 0 ? '(Confidence: ' + demand.confidence + '%)' : '(Insufficient Data)'}</div>
                   </div>
                   <div>
                     <h4 style="margin:0 0 8px 0;">Storage Locations</h4>
                     ${locs || '<span class="hint">Out of stock</span>'}
                   </div>
                 </div>
              </div>
            </div>
          </div>
        `;
        
        document.getElementById('product-modal-container').innerHTML = modalHtml;
        window.WF.hydrate(document.getElementById('product-modal-container'));
    } catch (e) {
        window.WF.toast('Error: ' + e.message, 'bad');
    }
};

window.pages.products.showCSVForm = function() {
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="csv-form-scrim">
        <div class="card" style="width: 100%; max-width: 500px; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('csv-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Import Products CSV</h3>
          </div>
          <form id="csv-form" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
              <p style="margin-bottom:1rem; color:var(--text-dim); font-size:14px;">
                Your CSV must include <code>sku</code>, <code>name</code>, <code>category</code>, <code>unit</code>, <code>dimensions</code>, <code>weight</code>, and <code>base_price</code> columns. 
              </p>
              <input type="file" id="csv-file" accept=".csv" required style="width:100%;" />
            </div>
            
            <div id="csv-results" style="margin-top:1rem; font-size:14px; max-height:200px; overflow-y:auto;"></div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('csv-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="csv-submit-btn">Upload</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('product-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('product-modal-container'));
    
    document.getElementById('csv-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('csv-file');
        const file = fileInput.files[0];
        if (!file) return;
        
        const btn = document.getElementById('csv-submit-btn');
        btn.disabled = true;
        btn.textContent = "Uploading...";
        const resultsDiv = document.getElementById('csv-results');
        resultsDiv.innerHTML = 'Uploading and processing...';
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const result = await window.apiClient.products.importCSV(formData);
            window.WF.toast(`Imported ${result.imported} products.`, 'good');
            
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
                document.getElementById('csv-form-scrim').remove();
                window.pages.products(document.getElementById('router-view'));
            };
        } catch(err) {
            resultsDiv.innerHTML = `<span style="color:red;">Error: ${err.message}</span>`;
            btn.disabled = false;
            btn.textContent = "Retry";
        }
    });
};

window.pages.products.showManageStock = async function(productId, productSku) {
    let inventory = [];
    let allEmployees = [];
    
    try {
        const [invRes, empRes] = await Promise.all([
            window.apiClient.inventory.getAll(),
            window.apiClient.employees.getAll()
        ]);
        inventory = invRes.filter(i => i.product_id === parseInt(productId));
        allEmployees = empRes || [];
    } catch(e) {
        console.warn("Failed to load initial data for stock modal", e);
    }
    
    let currentQty = inventory.reduce((s, i) => s + i.quantity, 0);
    
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="manage-stock-scrim">
        <div class="card" style="width: 100%; max-width: 640px; max-height: 90vh; overflow-y:auto; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('manage-stock-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Receive Incoming Stock: ${productSku}</h3>
          </div>
          <p style="margin-top:0.5rem; color:#666;">Current On-Hand Stock: <strong>${currentQty}</strong> units</p>
          
          <div id="ms-step-1">
            <form id="manage-stock-form" style="margin-top:1rem;">
              <input type="hidden" id="ms-product-id" value="${productId}" />
              
              <div class="form-group" style="margin-bottom:1rem;">
                <label style="display:block; margin-bottom:4px; font-weight:600;">Incoming Receipt Type *</label>
                <select id="ms-action" class="wf-input" style="width:100%;">
                  <option value="ADD">Receive Stock (Trained ML Placement & Workload Assignment)</option>
                </select>
              </div>
              
              <div class="form-group" style="margin-bottom:1rem;">
                <label style="display:block; margin-bottom:4px; font-weight:600;">Incoming Quantity *</label>
                <input type="number" id="ms-qty" class="wf-input" required min="1" placeholder="e.g. 100" style="width:100%; box-sizing:border-box;" />
                <small style="color:#666; display:block; margin-top:4px;">Large quantities will be evaluated and split across multiple feasible cells based on capacity.</small>
              </div>
              
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
                <button type="button" class="btn btn-ghost" onclick="document.getElementById('manage-stock-scrim').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="ms-next-btn">Generate ML Recommendations</button>
              </div>
            </form>
          </div>

          <div id="ms-step-2" style="display:none; margin-top:1rem;">
            <div style="padding: 1.2rem; background: var(--bg-soft); border-radius: 8px; border-left: 4px solid var(--brand-primary); margin-bottom: 1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
                    <h4 style="margin:0; display:flex; align-items:center; gap:0.5rem; color:var(--text-dark);">
                        <i data-icon="cpu"></i> ML Storage Allocation
                    </h4>
                    <span id="ai-model-tag" style="background:var(--brand-secondary); padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;"></span>
                </div>
                <p id="ai-reason" style="font-size: 0.85rem; color: #555; margin-bottom: 0.8rem;"></p>
                
                <div id="ai-allocations-box" style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:0.8rem; margin-bottom:1rem;">
                    <div id="ai-allocations"></div>
                </div>

                <div id="ai-shortage-alert" style="display:none; padding:8px 12px; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; color:#ef4444; font-size:0.85rem; margin-bottom:1rem;"></div>

                <!-- Employee Assignment Section -->
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:0.8rem; margin-bottom:1rem;">
                    <h5 style="margin:0 0 0.5rem 0; font-size:0.9rem; color:#334155;">Assigned Employee</h5>
                    <div id="ai-employee-reason" style="font-size:0.8rem; color:#64748b; margin-bottom:0.5rem;"></div>
                    <select id="ai-employee-select" class="wf-input" style="width:100%; font-size:0.9rem; padding:0.4rem;"></select>
                </div>

                <div>
                    <label style="font-size: 0.85rem; font-weight:600; display:block; margin-bottom:4px;">Manager Feedback / Override Reason (Optional)</label>
                    <input type="text" id="ai-feedback" class="wf-input" placeholder="Notes or justification for ML continuous training" style="width:100%;">
                </div>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:1.5rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('ms-step-2').style.display='none'; document.getElementById('ms-step-1').style.display='block';">Back</button>
              <button type="button" class="btn btn-primary" id="ms-confirm-btn">Accept & Create Put-Away Job</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('product-modal-container').innerHTML = modalHtml;
    
    if (window.WF && typeof window.WF.hydrate === 'function') {
        window.WF.hydrate(document.getElementById('manage-stock-scrim'));
    }
    
    let currentRecommendation = null;

    document.getElementById('manage-stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const qty = parseInt(document.getElementById('ms-qty').value);
        
        const btn = document.getElementById('ms-next-btn');
        btn.disabled = true;
        btn.textContent = "Analyzing Warehouse Grid...";
        
        try {
            const rec = await window.apiClient.ai.recommendStorage({
                product_id: parseInt(productId),
                quantity: qty
            });
            
            currentRecommendation = rec;
            
            document.getElementById('ms-step-1').style.display = 'none';
            document.getElementById('ms-step-2').style.display = 'block';
            
            document.getElementById('ai-model-tag').textContent = `${rec.model_version || 'ML v2.0'} | Match Score: ${(rec.score || 95).toFixed(0)}%`;
            document.getElementById('ai-reason').textContent = rec.reason;
            
            let allocHtml = `<strong style="font-size:0.85rem;">Allocated ${rec.total_allocated} of ${qty} units:</strong>`;
            allocHtml += '<ul style="margin:0.5rem 0 0 0; padding-left:1.2rem; font-size:0.85rem;">';
            rec.allocations.forEach(a => {
                allocHtml += `<li><strong>${a.quantity} units</strong> &rarr; Position <code>${a.position_code}</code> (Rack: ${a.rack}, Row: ${a.row}, Col: ${a.column})</li>`;
            });
            allocHtml += '</ul>';
            
            if (rec.alternative_positions && rec.alternative_positions.length > 0) {
                allocHtml += '<div style="margin-top:0.6rem; font-size:0.8rem; color:#64748b;"><strong>Feasible Alternative Positions:</strong> ' + 
                    rec.alternative_positions.map(p => `${p.position_code} (Avail: ${p.available_capacity})`).join(', ') + '</div>';
            }
            
            document.getElementById('ai-allocations').innerHTML = allocHtml;
            
            // Shortage alert
            const shortageDiv = document.getElementById('ai-shortage-alert');
            if (rec.unallocated > 0) {
                shortageDiv.style.display = 'block';
                shortageDiv.innerHTML = `<strong>⚠️ Capacity Shortage:</strong> ${rec.unallocated} units could not be accommodated within available warehouse capacity.`;
            } else {
                shortageDiv.style.display = 'none';
            }

            // Employee dropdown
            const empSelect = document.getElementById('ai-employee-select');
            const empReason = document.getElementById('ai-employee-reason');
            empSelect.innerHTML = '';

            let suggestedEmpId = rec.assigned_employee ? rec.assigned_employee.id : null;
            if (rec.assigned_employee) {
                empReason.innerHTML = `<strong>ML Suggested:</strong> ${rec.assigned_employee.name} (${rec.assigned_employee.reason || 'Optimal Workload & History'})`;
                const opt = document.createElement('option');
                opt.value = rec.assigned_employee.id;
                opt.textContent = `★ ${rec.assigned_employee.name} (ML Score: ${rec.assigned_employee.score || 90}/100)`;
                opt.selected = true;
                empSelect.appendChild(opt);
            } else {
                empReason.textContent = "Select an employee to handle physical put-away:";
            }

            // Add alternative and all other employees
            allEmployees.forEach(emp => {
                if (emp.id !== suggestedEmpId) {
                    const opt = document.createElement('option');
                    opt.value = emp.id;
                    const altMatch = (rec.alternative_employees || []).find(ae => ae.id === emp.id);
                    if (altMatch) {
                        opt.textContent = `${emp.first_name} ${emp.last_name} (${emp.role}) - ML Score: ${altMatch.score}/100`;
                    } else {
                        opt.textContent = `${emp.first_name} ${emp.last_name} (${emp.role || 'Staff'})`;
                    }
                    empSelect.appendChild(opt);
                }
            });
            
        } catch(err) {
            window.WF.toast(err.message || 'Failed to get recommendation', 'bad');
        } finally {
            btn.disabled = false;
            btn.textContent = "Generate ML Recommendations";
        }
    });

    document.getElementById('ms-confirm-btn').addEventListener('click', async () => {
        if (!currentRecommendation) return;
        
        const btn = document.getElementById('ms-confirm-btn');
        btn.disabled = true;
        btn.textContent = "Creating Put-Away Job...";
        
        const feedback = document.getElementById('ai-feedback').value;
        const selectedEmpId = document.getElementById('ai-employee-select').value;
        const defaultEmpId = currentRecommendation.assigned_employee ? currentRecommendation.assigned_employee.id : null;
        const isModified = (feedback.trim().length > 0) || (selectedEmpId && defaultEmpId && parseInt(selectedEmpId) !== parseInt(defaultEmpId));
        const decision = isModified ? "MODIFIED" : "ACCEPTED";
        
        try {
            const allocResult = await window.apiClient.inventory.allocate({
                product_id: parseInt(productId),
                allocations: currentRecommendation.allocations,
                recommendation_id: currentRecommendation.recommendation_id,
                manager_decision: decision,
                reason: feedback || (decision === "MODIFIED" ? "Manager modified employee assignment" : "Manager approved ML allocation")
            });
            
            const jobId = allocResult.job_id;
            if (jobId && selectedEmpId) {
                try {
                    await window.apiClient.jobs.assign(jobId, parseInt(selectedEmpId));
                } catch(assignErr) {
                    console.warn("Could not assign employee immediately:", assignErr);
                }
            }
            
            window.WF.toast('Put-away job created and stock assigned!', 'good');
            document.getElementById('manage-stock-scrim').remove();
            window.pages.products(document.getElementById('router-view'));
        } catch(err) {
            window.WF.toast(err.message || 'Allocation failed', 'bad');
            btn.disabled = false;
            btn.textContent = "Accept & Create Put-Away Job";
        }
    });
};

