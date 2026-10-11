window.pages = window.pages || {};

window.pages.orders = async function(container) {
  const api = window.apiClient;
  
  try {
      const orders = await api.orders.getAll();

      const rows = orders.map(o => `
        <tr>
          <td><b>ORD-${o.id}</b></td>
          <td>${o.customer_id || 'Walk-in'}</td>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td><span class="status-badge status-${o.status.toLowerCase().replace(' ', '-')}">${o.status}</span></td>
          <td>
            ${(o.status !== 'COMPLETED' && o.status !== 'CANCELLED') ? 
                `<button class="btn btn-ghost btn-sm" onclick="window.pages.orders.cancel('${o.id}')" style="color:var(--text-error);">Cancel</button>`
                : ''
            }
          </td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Orders</h1>
          <div style="display:flex; gap:1rem;">
            <button class="btn btn-secondary" onclick="window.pages.orders.showImportModal()"><i data-icon="upload"></i> Upload Orders CSV</button>
            <button class="btn btn-primary" onclick="window.pages.orders.showOrderForm()"><i data-icon="plus"></i> Create Order Manually</button>
          </div>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer ID</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length > 0 ? rows : '<tr><td colspan="5" style="text-align:center">No active orders.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div id="order-modal-container"></div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading orders: ${e.message}</p>`;
  }
};

window.pages.orders.showOrderForm = async function() {
    let products = [];
    try {
        products = await window.apiClient.products.getAll();
    } catch(e) {
        window.WF.toast('Failed to load products', 'bad');
        return;
    }
    
    const prodOptions = products.map(p => `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`).join('');

    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="order-form-scrim">
        <div class="card" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y:auto; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('order-form-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Create New Order</h3>
          </div>
          <form id="order-form" style="margin-top:1rem;">
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Customer ID / Name (Optional)</label>
              <input type="text" id="o-customer" class="wf-input" style="width:100%; box-sizing:border-box;" placeholder="e.g. CUST-001 or Walk-in" />
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Delivery Address</label>
              <input type="text" id="o-address" class="wf-input" style="width:100%; box-sizing:border-box;" />
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="display:block; margin-bottom:4px;">Priority</label>
              <select id="o-priority" class="wf-input" style="width:100%; box-sizing:border-box;">
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
              </select>
            </div>
            
            <div style="background:#F7F9FA; padding:16px; border-radius:8px; margin-bottom:1rem;">
                <h4 style="margin:0 0 8px 0;">Order Items</h4>
                <div id="o-items-container">
                    <div class="o-item-row" style="display:flex; gap:8px; margin-bottom:8px;">
                        <select class="wf-input o-item-prod" required style="flex:2;">
                            <option value="">Select Product...</option>
                            ${prodOptions}
                        </select>
                        <input type="number" class="wf-input o-item-qty" placeholder="Qty" required min="1" style="flex:1;" />
                    </div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" onclick="window.pages.orders.addOrderItemRow()">+ Add Item</button>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('order-form-scrim').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="o-submit-btn">Place Order</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('order-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('order-modal-container'));
    
    // Store prodOptions in a global or closure so addOrderItemRow can use it
    window.pages.orders.currentProdOptions = prodOptions;
    
    document.getElementById('order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('o-submit-btn');
        btn.disabled = true;
        btn.textContent = "Processing...";
        
        try {
            const itemRows = document.querySelectorAll('.o-item-row');
            const items = [];
            itemRows.forEach(row => {
                const pid = parseInt(row.querySelector('.o-item-prod').value);
                const qty = parseInt(row.querySelector('.o-item-qty').value);
                if (pid && qty) {
                    items.push({ product_id: pid, quantity: qty });
                }
            });
            
            if (items.length === 0) throw new Error('Add at least one item');
            
            let custVal = document.getElementById('o-customer').value.trim();
            let custId = parseInt(custVal);
            
            const payload = {
                customer_id: isNaN(custId) ? null : custId,
                delivery_address: document.getElementById('o-address').value || "Store Pickup",
                priority: document.getElementById('o-priority').value,
                items: items
            };
            
            await window.apiClient.orders.create(payload);
            window.WF.toast('Order placed successfully. Jobs automatically generated.', 'good');
            
            document.getElementById('order-form-scrim').remove();
            // Refresh
            window.pages.orders(document.getElementById('router-view'));
        } catch (err) {
            window.WF.toast(err.message, 'bad');
            btn.disabled = false;
            btn.textContent = "Place Order";
        }
    });
};

window.pages.orders.addOrderItemRow = function() {
    const container = document.getElementById('o-items-container');
    const div = document.createElement('div');
    div.className = 'o-item-row';
    div.style = 'display:flex; gap:8px; margin-bottom:8px;';
    div.innerHTML = `
        <select class="wf-input o-item-prod" required style="flex:2;">
            <option value="">Select Product...</option>
            ${window.pages.orders.currentProdOptions}
        </select>
        <input type="number" class="wf-input o-item-qty" placeholder="Qty" required min="1" style="flex:1;" />
        <button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()"><i data-icon="x"></i></button>
    `;
    container.appendChild(div);
    window.WF.hydrate(div);
};

window.pages.orders.cancel = async function(orderId) {
    if (!confirm('Are you sure you want to cancel this order? This will release reserved inventory.')) return;
    try {
        await window.apiClient.orders.cancel(orderId);
        window.WF.toast('Order cancelled and inventory released.', 'good');
        window.pages.orders(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Error cancelling order: ' + e.message, 'bad');
    }
};

window.pages.orders.showImportModal = function() {
    const modalHtml = `
      <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="order-import-scrim">
        <div class="card" style="width: 100%; max-width: 500px; position:relative; pointer-events:auto;">
          <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('order-import-scrim').remove()"><i data-icon="x"></i></button>
          <div class="card-h">
            <h3>Import Orders from CSV</h3>
          </div>
          <div style="margin-top:1rem;">
            <p style="margin-bottom:1rem; color:var(--text-secondary);">Upload a CSV containing your orders. Group items into the same order using the <code>order_reference</code> column.</p>
            <div class="form-group" style="margin-bottom:1.5rem;">
                <input type="file" id="o-import-file" class="wf-input" accept=".csv" style="width:100%; box-sizing:border-box;" />
            </div>
            
            <div id="o-import-feedback" style="margin-bottom:1rem;"></div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2rem;">
                <a href="/api/orders/sample-csv" onclick="event.preventDefault(); window.pages.orders.downloadSampleCSV();" style="color:var(--primary);"><i data-icon="download"></i> Download Sample CSV</a>
                <div style="display:flex; gap:8px;">
                  <button type="button" class="btn btn-ghost" onclick="document.getElementById('order-import-scrim').remove()">Cancel</button>
                  <button type="button" class="btn btn-primary" id="o-import-btn" onclick="window.pages.orders.processImport()">Upload & Import</button>
                </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('order-modal-container').innerHTML = modalHtml;
    window.WF.hydrate(document.getElementById('order-modal-container'));
};

window.pages.orders.downloadSampleCSV = function() {
    const csvContent = "order_reference,customer_name,delivery_address,priority,product_sku,quantity\n" +
                       "ORD-1001,Walk-in Customer,12 Market Road,NORMAL,ITEM-001,2\n" +
                       "ORD-1001,Walk-in Customer,12 Market Road,NORMAL,ITEM-002,1\n" +
                       "ORD-1002,ABC Stores,45 Industrial Road,HIGH,ITEM-001,3\n" +
                       "ORD-1003,XYZ Traders,8 Lake Road,LOW,ITEM-003,5";
                       
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'orders_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.pages.orders.processImport = async function() {
    const fileInput = document.getElementById('o-import-file');
    const btn = document.getElementById('o-import-btn');
    const feedback = document.getElementById('o-import-feedback');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        window.WF.toast('Please select a CSV file first.', 'bad');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Importing...';
    feedback.innerHTML = '';
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const result = await window.apiClient.orders.importCSV(formData);
        
        let feedbackHtml = `<div style="padding:12px; background:#e0f2fe; color:#0369a1; border-radius:6px; margin-bottom:8px;">
            <strong>Import Complete</strong><br/>
            Created ${result.created_orders || 0} orders containing ${result.created_items || 0} items.<br/>
            Skipped ${result.skipped || 0} rows.
        </div>`;
        
        if (result.errors && result.errors.length > 0) {
            feedbackHtml += `<div style="padding:12px; background:#fee2e2; color:#b91c1c; border-radius:6px; max-height:150px; overflow-y:auto; font-size:0.9em;">
                <strong>Errors:</strong><ul style="margin:4px 0 0; padding-left:20px;">`;
            result.errors.forEach(e => {
                feedbackHtml += `<li>${e}</li>`;
            });
            feedbackHtml += `</ul></div>`;
        }
        
        feedback.innerHTML = feedbackHtml;
        
        if (result.created_orders > 0) {
            window.WF.toast(`Successfully imported ${result.created_orders} orders.`, 'good');
            setTimeout(() => {
                window.pages.orders(document.getElementById('router-view'));
            }, 2000);
        }
    } catch (e) {
        feedback.innerHTML = `<div style="padding:12px; background:#fee2e2; color:#b91c1c; border-radius:6px;">
            <strong>Import Failed:</strong> ${e.message}
        </div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload & Import';
    }
};
