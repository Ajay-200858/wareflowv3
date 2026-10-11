window.pages = window.pages || {};

window.pages.import = async function(container) {
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
      <h1 style="margin:0;">CSV Import Center</h1>
    </div>
    
    <div class="dgrid">
      <div class="card" style="padding: 1.5rem;">
        <h3><i data-icon="warehouse"></i> Warehouse Structure</h3>
        <p style="margin-top:0.5rem; color:#666;">Import Zone, Rack, Row, and Position details.</p>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 1rem;"><strong>Required columns:</strong> warehouse, zone, rack, row, position, capacity</p>
        <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
          <input type="file" id="wh-csv" accept=".csv" style="display:block; margin-bottom:1rem;" />
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <button class="btn btn-primary btn-sm" onclick="window.pages.import.previewWarehouse()">Preview & Import</button>
             <a href="data:text/csv;charset=utf-8,warehouse,zone,rack,row,position,capacity%0AMain%20WH,A,1,1,A1-01,100" download="warehouse_sample.csv" class="hint" style="color:var(--brand-primary); text-decoration:underline;">Download Sample CSV</a>
          </div>
        </div>
        
        <!-- Preview Container -->
        <div id="wh-preview-container" style="display: none; margin-top: 1rem; background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0;">
        </div>
      </div>
      
      <div class="card" style="padding: 1.5rem;">
        <h3><i data-icon="users"></i> Employees</h3>
        <p style="margin-top:0.5rem; color:#666;">Bulk import your operational team.</p>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 1rem;"><strong>Required columns:</strong> first_name, last_name, email, role, skills</p>
        <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
          <input type="file" id="emp-csv" accept=".csv" style="display:block; margin-bottom:1rem;" />
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <button class="btn btn-primary btn-sm" onclick="window.pages.import.doImport('emp-csv', window.apiClient.employees.importCSV)">Upload & Import</button>
             <a href="data:text/csv;charset=utf-8,first_name,last_name,email,role,skills%0AJohn,Doe,john@example.com,WORKER,FORKLIFT" download="employees_sample.csv" class="hint" style="color:var(--brand-primary); text-decoration:underline;">Download Sample CSV</a>
          </div>
        </div>
      </div>
      
      <div class="card" style="padding: 1.5rem;">
        <h3><i data-icon="chip"></i> Products</h3>
        <p style="margin-top:0.5rem; color:#666;">Import product catalogue.</p>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 1rem;"><strong>Required columns:</strong> sku, name, category, unit, dimensions, weight, base_price</p>
        <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
          <input type="file" id="prod-csv" accept=".csv" style="display:block; margin-bottom:1rem;" />
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <button class="btn btn-primary btn-sm" onclick="window.pages.import.doImport('prod-csv', window.apiClient.products.importCSV)">Upload & Import</button>
             <a href="data:text/csv;charset=utf-8,sku,name,category,unit,dimensions,weight,base_price%0AITEM-001,Widget,Tools,pcs,10x10x10,1.5,10.0" download="products_sample.csv" class="hint" style="color:var(--brand-primary); text-decoration:underline;">Download Sample CSV</a>
          </div>
        </div>
      </div>

      <div class="card" style="padding: 1.5rem;">
        <h3><i data-icon="snow"></i> Initial Inventory</h3>
        <p style="margin-top:0.5rem; color:#666;">Set initial stock levels for imported products.</p>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 1rem;"><strong>Required columns:</strong> sku, quantity, warehouse_code, receipt_ref</p>
        <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
          <input type="file" id="inv-csv" accept=".csv" style="display:block; margin-bottom:1rem;" />
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <button class="btn btn-primary btn-sm" onclick="window.pages.import.doImport('inv-csv', window.apiClient.inventory.importCSV)">Upload & Import</button>
             <a href="data:text/csv;charset=utf-8,sku,quantity,warehouse_code,receipt_ref%0AITEM-001,50,Main,REF-1" download="inventory_sample.csv" class="hint" style="color:var(--brand-primary); text-decoration:underline;">Download Sample CSV</a>
          </div>
        </div>
      </div>
      
      <div class="card" style="padding: 1.5rem;">
        <h3><i data-icon="rank"></i> Historical Sales</h3>
        <p style="margin-top:0.5rem; color:#666;">Upload historical data for ML Demand Forecasting.</p>
        <p style="font-size: 0.85rem; color: #888; margin-bottom: 1rem;"><strong>Required columns:</strong> date, product_sku, quantity, total_value</p>
        <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
          <input type="file" id="hist-csv" accept=".csv" style="display:block; margin-bottom:1rem;" />
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <button class="btn btn-primary btn-sm" onclick="window.pages.import.doImport('hist-csv', window.apiClient.ai.importHistorical)">Upload & Import</button>
             <a href="data:text/csv;charset=utf-8,date,product_sku,quantity,total_value%0A2023-01-01,ITEM-001,10,100" download="history_sample.csv" class="hint" style="color:var(--brand-primary); text-decoration:underline;">Download Sample CSV</a>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.pages.import.doImport = async function(inputId, importMethod) {
    const input = document.getElementById(inputId);
    if (!input.files || input.files.length === 0) {
        window.WF.toast('Please select a file first.', 'bad');
        return;
    }
    
    const file = input.files[0];
    const fd = new FormData();
    fd.append("file", file);
    
    try {
        window.WF.toast('Importing...', 'info');
        const res = await importMethod(fd);
        
        let totalCreated = 0;
        let createdDetails = "";
        
        if (res.created) {
            totalCreated = Object.values(res.created).reduce((a, b) => a + b, 0);
            createdDetails = Object.entries(res.created)
                                   .filter(([k,v]) => v > 0)
                                   .map(([k,v]) => `${v} ${k}`)
                                   .join(', ');
        } else if (res.imported !== undefined) {
            totalCreated = res.imported;
            createdDetails = `${totalCreated} records`;
        }
        
        if (totalCreated === 0) {
            let msg = `No records were inserted. (Skipped: ${res.skipped || 0})`;
            if (res.errors && res.errors.length > 0) {
                msg += `\nFailed rows: ${res.errors.length}. Check console.`;
                console.warn("Import errors:", res.errors);
                window.WF.toast(msg, 'bad');
            } else {
                window.WF.toast(msg, 'info');
            }
        } else {
            let msg = `Import successful! Created: ${createdDetails}.`;
            if (res.skipped) msg += ` (Skipped: ${res.skipped})`;
            if (res.errors && res.errors.length > 0) {
                msg += `\n(${res.errors.length} rows failed, check console)`;
                console.warn("Import errors:", res.errors);
                window.WF.toast(msg, 'info'); // show info with warnings
            } else {
                window.WF.toast(msg, 'good');
                input.value = ''; // clear on full success
            }
            // Trigger UI refresh (e.g. map or dashboard)
            window.dispatchEvent(new Event('db_updated'));
        }
    } catch (err) {
        window.WF.toast(`Import failed: ${err.message}`, 'bad');
    }
};

window.pages.import.previewWarehouse = async function() {
    const input = document.getElementById('wh-csv');
    if (!input.files || input.files.length === 0) {
        window.WF.toast('Please select a file first.', 'bad');
        return;
    }
    
    const file = input.files[0];
    const fd = new FormData();
    fd.append("file", file);
    
    try {
        window.WF.toast('Generating preview...', 'info');
        // Call import with preview=true
        const res = await window.apiClient.warehouses.importCSV(fd, true);
        
        const previewEl = document.getElementById('wh-preview-container');
        previewEl.style.display = 'block';
        
        let errorsHtml = '';
        if (res.errors && res.errors.length > 0) {
            errorsHtml = `<div style="color: #ef4444; font-size: 0.85rem; margin-top: 0.5rem; max-height: 100px; overflow-y: auto;">
                <strong>Conflicts/Errors:</strong><br/>
                ${res.errors.join('<br/>')}
            </div>`;
        }
        
        const c = res.created || {};
        
        previewEl.innerHTML = `
            <h4 style="margin: 0 0 0.5rem 0; color: #334155;">STRUCTURE IMPORT PREVIEW</h4>
            <div style="font-size: 0.85rem; color: #475569; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div>
                    <strong>New Items Added:</strong><br/>
                    + ${c.warehouses || 0} warehouses<br/>
                    + ${c.zones || 0} zones<br/>
                    + ${c.racks || 0} racks<br/>
                    + ${c.rows || 0} rows<br/>
                    + ${c.positions || 0} positions
                </div>
                <div>
                    <strong>Existing Structure:</strong><br/>
                    ~ ${c.updated || 0} positions updated<br/>
                    = ${res.skipped || 0} records skipped (unchanged)
                </div>
            </div>
            ${errorsHtml}
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('wh-preview-container').style.display='none'">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="window.pages.import.commitWarehouseImport()">Commit Import</button>
            </div>
        `;
        
        // Store form data for commit
        window.pages.import.pendingFormData = fd;
        
    } catch (err) {
        window.WF.toast(`Preview failed: ${err.message}`, 'bad');
    }
};

window.pages.import.commitWarehouseImport = async function() {
    if (!window.pages.import.pendingFormData) return;
    
    try {
        window.WF.toast('Committing import...', 'info');
        const res = await window.apiClient.warehouses.importCSV(window.pages.import.pendingFormData, false);
        
        window.WF.toast('Warehouse structure imported successfully!', 'good');
        document.getElementById('wh-preview-container').style.display = 'none';
        document.getElementById('wh-csv').value = '';
        window.pages.import.pendingFormData = null;
        
        // Trigger UI refresh
        window.dispatchEvent(new Event('db_updated'));
    } catch (err) {
        window.WF.toast(`Import failed: ${err.message}`, 'bad');
    }
};

