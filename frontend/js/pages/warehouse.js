window.pages = window.pages || {};

window.pages.warehouse = async function(container) {
    const api = window.apiClient;
    if (!window.pages.warehouse.filters) {
        window.pages.warehouse.filters = { search: '', status: '' };
    }
    if (!window.pages.warehouse.viewState) {
        window.pages.warehouse.viewState = { level: 1, zoneId: null, rackId: null };
    }
    
    try {
        const allWarehouses = await api.warehouses.getAll();
        
        if (!allWarehouses || allWarehouses.length === 0) {
            container.innerHTML = `
              <div class="emptystate" style="padding: 4rem 2rem; text-align: center;">
                <i data-icon="warehouse" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem; display: block;"></i>
                <h2 style="color: #0f172a; margin-bottom: 0.5rem;">No Warehouses Found</h2>
                <p style="color: #64748b; max-width: 440px; margin: 0 auto 1.5rem auto;">
                  Import your physical warehouse layout to initialize regions, racks, and 2D storage grids.
                </p>
                <button class="btn btn-primary" onclick="window.router.navigate('#import')">
                  Import Warehouse Layout CSV
                </button>
              </div>
            `;
            return;
        }

        let selectedId = window.pages.warehouse.currentWarehouseId || allWarehouses[0].id;
        if (!allWarehouses.find(w => w.id == selectedId)) {
            selectedId = allWarehouses[0].id;
        }
        window.pages.warehouse.currentWarehouseId = selectedId;

        // Render main shell
        container.innerHTML = `
          <div class="dt-container">
            <!-- Top Controls Header -->
            <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap: 1rem;">
              <div>
                <h1 style="margin:0; font-size: 1.8rem; color: var(--text-dark, #0f172a); font-family: 'Bricolage Grotesque', sans-serif;">
                  Warehouse Digital Twin
                </h1>
                <p style="margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.95rem;">
                  Interactive 2D Spatial Layout: Regions &rarr; Racks &rarr; 2D Storage Grids
                </p>
              </div>
              
              <div style="display:flex; gap: 10px; align-items:center; flex-wrap: wrap;">
                ${allWarehouses.length > 1 ? `
                  <div style="display:flex; align-items:center; gap: 6px;">
                    <label style="font-size:0.85rem; font-weight:600; color:#475569;">Facility:</label>
                    <select id="warehouse-selector" class="wf-input" style="min-width: 200px; font-weight: 600;" onchange="window.pages.warehouse.changeWarehouse(this.value)">
                      ${allWarehouses.map(w => `<option value="${w.id}" ${w.id == selectedId ? 'selected' : ''}>${w.name}</option>`).join('')}
                    </select>
                  </div>
                ` : `
                  <div style="font-weight:600; padding: 0.5rem 1rem; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; color: #0f172a;">
                    <i data-icon="warehouse"></i> ${allWarehouses[0].name}
                  </div>
                `}
                <button class="btn btn-secondary" onclick="window.pages.warehouse.refreshMap()" title="Refresh live telemetry">
                  <i data-icon="refresh"></i> Refresh
                </button>
              </div>
            </div>
            
            <!-- Warehouse Top Statistics Bar -->
            <div id="warehouse-stats-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem;"></div>

            <!-- Breadcrumbs and Drilldown Navigation Bar -->
            <div class="card" style="padding: 0.85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
               <div class="dt-breadcrumbs" id="warehouse-breadcrumbs">
                  <!-- Breadcrumbs rendered dynamically -->
               </div>
               <div style="display: flex; gap: 0.75rem; align-items: center;">
                  <button class="btn btn-secondary btn-sm" id="btn-back-level" style="display:none;" onclick="window.pages.warehouse.navigateUp()">
                    &larr; Back
                  </button>
                  <div style="font-size: 0.8rem; color: #64748b; background: #f8fafc; padding: 5px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span id="drilldown-hint">Single-click to inspect | Double-click to open</span>
                  </div>
               </div>
            </div>

            <!-- Filters & Legend Toolbar -->
            <div class="card" style="padding: 0.9rem 1.25rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
               <div style="display:flex; align-items:center; gap: 0.5rem;">
                   <label style="font-size:0.85rem; font-weight:600; color: #334155;">Search:</label>
                   <input type="text" id="map-search" class="wf-input" placeholder="Cell code or SKU..." style="width: 170px; padding: 0.45rem 0.65rem;" oninput="window.pages.warehouse.updateFilters('search', this.value)">
               </div>
               <div style="display:flex; align-items:center; gap: 0.5rem;">
                   <label style="font-size:0.85rem; font-weight:600; color: #334155;">Status:</label>
                   <select id="map-status-filter" class="wf-input" style="padding: 0.45rem 0.65rem;" onchange="window.pages.warehouse.updateFilters('status', this.value)">
                       <option value="">All Statuses</option>
                       <option value="EMPTY">Empty</option>
                       <option value="PARTIAL">Partially Occupied</option>
                       <option value="NEAR_FULL">Nearly Full</option>
                       <option value="FULL">Full</option>
                       <option value="INACTIVE">Inactive / Maintenance</option>
                   </select>
               </div>
               <button class="btn btn-secondary btn-sm" onclick="window.pages.warehouse.resetFilters()">Clear Filters</button>

               <!-- Legend -->
               <div class="dt-legend" style="margin-left: auto;">
                  <span style="font-weight: 700; color: #1e293b; margin-right: 2px;">Legend:</span>
                  <div class="dt-legend-item"><div class="dt-legend-dot status-empty-dot"></div> Empty</div>
                  <div class="dt-legend-item"><div class="dt-legend-dot status-partial-dot"></div> Partial</div>
                  <div class="dt-legend-item"><div class="dt-legend-dot status-nearfull-dot"></div> Near Full</div>
                  <div class="dt-legend-item"><div class="dt-legend-dot status-full-dot"></div> Full</div>
                  <div class="dt-legend-item"><div class="dt-legend-dot status-inactive-dot"></div> Inactive</div>
               </div>
               
               <button class="btn btn-secondary btn-sm" id="btn-edit-layout" onclick="window.pages.warehouse.toggleEditMode()">
                  <i data-icon="edit"></i> Edit Layout
               </button>
               <button class="btn btn-secondary btn-sm" onclick="window.pages.warehouse.runDiagnostics()" title="Validate inventory vs cell integrity">
                  <i data-icon="activity"></i> Diagnostics
               </button>
            </div>
            
            <!-- Main Content Area: Left Spatial Canvas + Right Detail Panel -->
            <div class="dt-main-grid" id="map-main-area">
               <!-- Left Canvas -->
               <div id="map-render-container">
                  <div style="padding: 3rem; text-align: center; color: #64748b;">
                    Loading 2D digital twin...
                  </div>
               </div>
               
               <!-- Right Sidebar -->
               <div>
                  <div class="dt-sidebar-panel" id="warehouse-sidebar">
                      <div class="emptystate" style="padding: 2.5rem 1rem; text-align:center;">
                          <i data-icon="mouse-pointer" style="font-size: 2.2rem; color: #cbd5e1; margin-bottom: 1rem; display:block;"></i>
                          <h4 style="margin:0 0 0.4rem 0; color:#334155;">Selection Inspector</h4>
                          <p style="color:#64748b; font-size:0.85rem; margin:0; line-height: 1.4;">
                            Click any Region, Rack, or Storage Cell to inspect live inventory, SKU distributions, and capacity allocations.
                          </p>
                      </div>
                  </div>
               </div>
            </div>
          </div>
        `;
        
        await window.pages.warehouse.fetchAndRenderMap();
        
    } catch (e) {
        container.innerHTML = `
          <div class="card" style="padding:2rem; border-left: 4px solid #ef4444; background: #fff;">
            <h3 style="color: #ef4444; margin-top:0;">Failed to load Warehouse Digital Twin</h3>
            <p style="color: #475569;">${e.message}</p>
            <button class="btn btn-primary" onclick="window.pages.warehouse.refreshMap()">Retry</button>
          </div>
        `;
    }
};

// Global State
window.pages.warehouse.currentWarehouseId = null;
window.pages.warehouse.mapData = null;
window.pages.warehouse.selectedPosition = null;
window.pages.warehouse.selectedZone = null;
window.pages.warehouse.selectedRack = null;
window.pages.warehouse.isEditMode = false;
window.pages.warehouse.clickTimer = null;

// View state: level 1 (Regions), level 2 (Racks), level 3 (2D Grid)
window.pages.warehouse.viewState = {
    level: 1,
    zoneId: null,
    rackId: null
};

window.pages.warehouse.filters = {
    search: '',
    status: ''
};

window.pages.warehouse.changeWarehouse = async function(id) {
    window.pages.warehouse.currentWarehouseId = id;
    window.pages.warehouse.viewState = { level: 1, zoneId: null, rackId: null };
    window.pages.warehouse.selectedPosition = null;
    window.pages.warehouse.selectedZone = null;
    window.pages.warehouse.selectedRack = null;
    window.pages.warehouse.resetFilters(false);
    await window.pages.warehouse.fetchAndRenderMap();
};

window.pages.warehouse.refreshMap = async function() {
    await window.pages.warehouse.fetchAndRenderMap();
};

window.pages.warehouse.updateFilters = function(key, value) {
    if (!window.pages.warehouse.filters) {
        window.pages.warehouse.filters = { search: '', status: '' };
    }
    window.pages.warehouse.filters[key] = (value || '').trim().toLowerCase();
    window.pages.warehouse.renderMapOnly();
};

window.pages.warehouse.resetFilters = function(render = true) {
    window.pages.warehouse.filters = { search: '', status: '' };
    const searchInput = document.getElementById('map-search');
    const statusInput = document.getElementById('map-status-filter');
    if (searchInput) searchInput.value = '';
    if (statusInput) statusInput.value = '';
    if (render) window.pages.warehouse.renderMapOnly();
};

window.pages.warehouse.toggleEditMode = function() {
    window.pages.warehouse.isEditMode = !window.pages.warehouse.isEditMode;
    const btn = document.getElementById('btn-edit-layout');
    if (btn) {
        if (window.pages.warehouse.isEditMode) {
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-secondary');
            btn.innerHTML = `<i data-icon="check"></i> Exit Edit Mode`;
        } else {
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-primary');
            btn.innerHTML = `<i data-icon="edit"></i> Edit Layout`;
        }
    }
    window.pages.warehouse.renderMapOnly();
};

window.pages.warehouse.navigateUp = function() {
    const vs = window.pages.warehouse.viewState;
    if (vs.level === 3) {
        vs.level = 2;
        vs.rackId = null;
        window.pages.warehouse.selectedPosition = null;
    } else if (vs.level === 2) {
        vs.level = 1;
        vs.zoneId = null;
        vs.rackId = null;
        window.pages.warehouse.selectedRack = null;
    }
    window.pages.warehouse.renderMapOnly();
};

window.pages.warehouse.fetchAndRenderMap = async function() {
    try {
        const id = window.pages.warehouse.currentWarehouseId;
        const mapData = await window.apiClient.warehouses.getMap(id);
        window.pages.warehouse.mapData = mapData;
        
        window.pages.warehouse.renderStats();
        window.pages.warehouse.renderMapOnly();
        
        // Re-hydrate any active selection
        if (window.pages.warehouse.selectedPosition) {
            const found = window.pages.warehouse.findPositionById(window.pages.warehouse.selectedPosition.id);
            if (found) {
                window.pages.warehouse.selectPosition(found.posJson, found.hierarchy, false);
            }
        }
    } catch (e) {
        const el = document.getElementById('map-render-container');
        if (el) el.innerHTML = `<p style="color:#ef4444;">Error loading warehouse layout: ${e.message}</p>`;
    }
};

/* -------------------------------------------------------------
   CALCULATE STATUS AND COLOR FOR POSITION
------------------------------------------------------------- */
window.pages.warehouse.getPositionColorAndStatus = function(pos) {
    if (pos.status === 'MAINTENANCE' || pos.status === 'INACTIVE') {
        return { 
            state: 'INACTIVE', 
            color: '#94a3b8', 
            badge: 'INACTIVE', 
            cellClass: 'cell-inactive',
            miniClass: 'occ-inactive'
        };
    }
    const cap = pos.capacity || 0;
    const occ = pos.current_occupancy || 0;
    if (cap === 0) {
        return { 
            state: 'INACTIVE', 
            color: '#94a3b8', 
            badge: 'INACTIVE', 
            cellClass: 'cell-inactive',
            miniClass: 'occ-inactive'
        };
    }
    
    const pct = (occ / cap) * 100;
    if (pct <= 0) {
        return { 
            state: 'EMPTY', 
            color: '#10b981', 
            badge: 'EMPTY', 
            cellClass: 'cell-empty',
            miniClass: 'occ-empty'
        };
    }
    if (pct < 80) {
        return { 
            state: 'PARTIAL', 
            color: '#3b82f6', 
            badge: 'PARTIAL', 
            cellClass: 'cell-partial',
            miniClass: 'occ-partial'
        };
    }
    if (pct < 100) {
        return { 
            state: 'NEAR_FULL', 
            color: '#f59e0b', 
            badge: 'NEAR FULL', 
            cellClass: 'cell-nearfull',
            miniClass: 'occ-nearfull'
        };
    }
    return { 
        state: 'FULL', 
        color: '#ef4444', 
        badge: 'FULL', 
        cellClass: 'cell-full',
        miniClass: 'occ-full'
    };
};

/* -------------------------------------------------------------
   AGGREGATE CALCULATIONS & TOP METRICS
   Available = Total Capacity - Total Occupied
------------------------------------------------------------- */
window.pages.warehouse.renderStats = function() {
    const mapData = window.pages.warehouse.mapData;
    if (!mapData) return;
    
    let totalZones = mapData.zones.length;
    let totalRacks = 0;
    let totalRows = 0;
    let totalPositions = 0;
    let totalCapacity = 0;
    let totalOccupied = 0;
    let distinctSkus = new Set();
    
    mapData.zones.forEach(z => {
        totalRacks += z.racks.length;
        z.racks.forEach(rk => {
            totalRows += rk.rows.length;
            rk.rows.forEach(rw => {
                totalPositions += rw.positions.length;
                rw.positions.forEach(p => {
                    totalCapacity += (p.capacity || 0);
                    totalOccupied += (p.current_occupancy || 0);
                    if (p.inventory) {
                        p.inventory.forEach(inv => {
                            if (inv.product_sku) distinctSkus.add(inv.product_sku);
                        });
                    }
                });
            });
        });
    });
    
    const freeCapacity = Math.max(0, totalCapacity - totalOccupied);
    const utilization = totalCapacity > 0 ? ((totalOccupied / totalCapacity) * 100).toFixed(1) : 0;
    
    const statsContainer = document.getElementById('warehouse-stats-container');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="card" style="padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b;">Spatial Hierarchy</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-top: 2px;">
                   ${totalZones} Regions / ${totalRacks} Racks
                </div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">${totalRows} Rows configured</div>
            </div>
            <div class="card" style="padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b;">Storage Cells</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-top: 2px;">
                   ${totalPositions.toLocaleString()} Cells
                </div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">${distinctSkus.size} Active SKUs</div>
            </div>
            <div class="card" style="padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b;">Warehouse Capacity</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: #0f172a; margin-top: 2px;">
                   ${totalCapacity.toLocaleString()} Units
                </div>
                <div style="font-size: 0.8rem; color: #10b981; font-weight: 600; margin-top: 2px;">${freeCapacity.toLocaleString()} Units Available</div>
            </div>
            <div class="card" style="padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 600; color: #64748b;">Live Occupancy</div>
                <div style="font-size: 1.3rem; font-weight: 700; color: ${utilization > 85 ? '#ef4444' : '#0284c7'}; margin-top: 2px;">
                   ${utilization}%
                </div>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">${totalOccupied.toLocaleString()} Units Occupied</div>
            </div>
        `;
    }
};

/* -------------------------------------------------------------
   ROUTER FOR LEVEL 1, LEVEL 2, LEVEL 3
------------------------------------------------------------- */
window.pages.warehouse.renderMapOnly = function() {
    const container = document.getElementById('map-render-container');
    const mapData = window.pages.warehouse.mapData;
    const vs = window.pages.warehouse.viewState;
    const isEdit = window.pages.warehouse.isEditMode;
    const breadcrumbs = document.getElementById('warehouse-breadcrumbs');
    const backBtn = document.getElementById('btn-back-level');
    const hint = document.getElementById('drilldown-hint');
    
    if (!mapData || !container) return;

    if (vs.level === 1) {
        if (backBtn) backBtn.style.display = 'none';
        if (hint) hint.textContent = "Single-click region to inspect | Double-click to open racks";
        if (breadcrumbs) {
            breadcrumbs.innerHTML = `
              <span><i data-icon="warehouse"></i> <strong>${mapData.name}</strong></span>
              <span class="sep">&rarr;</span>
              <span class="active-crumb">Level 1: Warehouse Regions</span>
            `;
        }
        window.pages.warehouse.renderLevel1Regions(container, mapData, isEdit);
        
    } else if (vs.level === 2) {
        if (backBtn) backBtn.style.display = 'inline-flex';
        const zone = mapData.zones.find(z => z.id === vs.zoneId) || mapData.zones[0];
        if (hint) hint.textContent = "Single-click rack to inspect | Double-click to open 2D storage grid";
        if (breadcrumbs) {
            breadcrumbs.innerHTML = `
              <a href="javascript:void(0)" onclick="window.pages.warehouse.viewState={level:1,zoneId:null,rackId:null}; window.pages.warehouse.renderMapOnly();">${mapData.name}</a> 
              <span class="sep">&rarr;</span>
              <strong>${zone.name}</strong>
              <span class="sep">&rarr;</span>
              <span class="active-crumb">Level 2: Racks</span>
            `;
        }
        window.pages.warehouse.renderLevel2Racks(container, zone, isEdit);
        
    } else if (vs.level === 3) {
        if (backBtn) backBtn.style.display = 'inline-flex';
        const zone = mapData.zones.find(z => z.id === vs.zoneId) || mapData.zones[0];
        const rack = zone.racks.find(r => r.id === vs.rackId) || zone.racks[0];
        if (hint) hint.textContent = "Click any storage cell to inspect inventory and capacity";
        if (breadcrumbs) {
            breadcrumbs.innerHTML = `
              <a href="javascript:void(0)" onclick="window.pages.warehouse.viewState={level:1,zoneId:null,rackId:null}; window.pages.warehouse.renderMapOnly();">${mapData.name}</a> 
              <span class="sep">&rarr;</span>
              <a href="javascript:void(0)" onclick="window.pages.warehouse.viewState={level:2,zoneId:${zone.id},rackId:null}; window.pages.warehouse.renderMapOnly();">${zone.name}</a>
              <span class="sep">&rarr;</span>
              <strong>${rack.name}</strong>
              <span class="sep">&rarr;</span>
              <span class="active-crumb">Level 3: 2D Row-and-Column Grid</span>
            `;
        }
        window.pages.warehouse.renderLevel3Grid(container, zone, rack, isEdit);
    }
};

/* -------------------------------------------------------------
   LEVEL 1: WAREHOUSE REGIONS (ZONES)
   Responsive 2x2 desktop grid layout of clean rectangular boxes
   Single-click: inspect details in side panel
   Double-click: drill-down into Level 2 racks
   Open Region button for accessibility
------------------------------------------------------------- */
window.pages.warehouse.renderLevel1Regions = function(container, mapData, isEdit) {
    if (!mapData.zones || mapData.zones.length === 0) {
        container.innerHTML = `
          <div class="card" style="padding: 3rem; text-align: center; background: #fff;">
            <h3>No Regions Configured</h3>
            <p style="color: #64748b;">This warehouse has no storage regions yet.</p>
          </div>
        `;
        return;
    }

    let html = `<div class="dt-regions-grid">`;

    mapData.zones.forEach((z, idx) => {
        let rackCount = z.racks.length;
        let totalCap = 0;
        let totalOcc = 0;
        let productsSet = new Set();
        let totalCells = 0;

        z.racks.forEach(rk => {
            rk.rows.forEach(rw => {
                totalCells += rw.positions.length;
                rw.positions.forEach(p => {
                    totalCap += (p.capacity || 0);
                    totalOcc += (p.current_occupancy || 0);
                    if (p.inventory) {
                        p.inventory.forEach(inv => {
                            if (inv.product_sku) productsSet.add(inv.product_sku);
                        });
                    }
                });
            });
        });

        const freeCap = Math.max(0, totalCap - totalOcc);
        const occPct = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : 0;
        const isSelected = window.pages.warehouse.selectedZone?.id === z.id;

        // Determine occupancy state
        let stateClass = 'state-empty';
        let badgeClass = 'dt-badge-empty';
        let stateLabel = 'Empty';
        let progressColor = '#10b981';

        if (totalCap === 0 || totalCells === 0) {
            stateClass = 'state-inactive';
            badgeClass = 'dt-badge-inactive';
            stateLabel = 'Inactive';
            progressColor = '#94a3b8';
        } else if (occPct >= 100) {
            stateClass = 'state-full';
            badgeClass = 'dt-badge-full';
            stateLabel = 'Full';
            progressColor = '#ef4444';
        } else if (occPct >= 80) {
            stateClass = 'state-nearfull';
            badgeClass = 'dt-badge-nearfull';
            stateLabel = 'Nearly Full';
            progressColor = '#f59e0b';
        } else if (occPct > 0) {
            stateClass = 'state-partial';
            badgeClass = 'dt-badge-partial';
            stateLabel = 'Partially Occupied';
            progressColor = '#3b82f6';
        }

        const regionCode = `REG-${String.fromCharCode(65 + (idx % 26))}${Math.floor(idx / 26) || ''}`;

        html += `
          <div class="dt-region-box ${stateClass} ${isSelected ? 'selected' : ''}"
               onclick="window.pages.warehouse.handleRegionClick(${z.id})"
               ondblclick="window.pages.warehouse.handleRegionDblClick(${z.id})"
               title="Region: ${z.name} (${regionCode})">
            
            <div>
              <div class="dt-box-header">
                <div>
                  <h3 class="dt-box-title">
                    <i data-icon="grid"></i> ${z.name}
                    <span class="dt-box-code">${regionCode}</span>
                  </h3>
                  <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                    ${rackCount} ${rackCount === 1 ? 'Rack' : 'Racks'} &bull; ${totalCells} Storage Cells
                  </div>
                </div>
                <span class="dt-badge ${badgeClass}">${stateLabel}</span>
              </div>

              <!-- Metrics -->
              <div class="dt-metrics-grid">
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Total Capacity</div>
                  <div class="dt-metric-value">${totalCap.toLocaleString()}</div>
                </div>
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Available Free</div>
                  <div class="dt-metric-value" style="color: #10b981;">${freeCap.toLocaleString()}</div>
                </div>
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Occupied Units</div>
                  <div class="dt-metric-value" style="color: #0284c7;">${totalOcc.toLocaleString()}</div>
                </div>
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Products Stored</div>
                  <div class="dt-metric-value" style="color: #6366f1;">${productsSet.size} SKUs</div>
                </div>
              </div>

              <!-- Occupancy Progress Bar -->
              <div class="dt-progress-container">
                <div class="dt-progress-header">
                  <span style="color: #64748b;">Occupancy Utilization:</span>
                  <span style="color: ${progressColor}; font-weight: 700;">${occPct}%</span>
                </div>
                <div class="dt-progress-bar">
                  <div class="dt-progress-fill" style="width: ${Math.min(occPct, 100)}%; background: ${progressColor};"></div>
                </div>
              </div>
            </div>

            <!-- Action Footer -->
            <div class="dt-box-footer">
              <span class="dt-box-hint">Double-click to view racks &rarr;</span>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.pages.warehouse.handleRegionDblClick(${z.id})">
                Open Region Racks
              </button>
            </div>
          </div>
        `;
    });

    html += `</div>`;

    if (isEdit) {
        html += `
          <div style="margin-top: 1.5rem; text-align: center;">
            <button class="btn btn-secondary" onclick="window.pages.warehouse.showAddZoneModal()">
              + Add New Region
            </button>
          </div>
        `;
    }

    container.innerHTML = html;
};

window.pages.warehouse.handleRegionClick = function(zoneId) {
    clearTimeout(window.pages.warehouse.clickTimer);
    window.pages.warehouse.clickTimer = setTimeout(() => {
        const zone = window.pages.warehouse.mapData.zones.find(z => z.id === zoneId);
        if (!zone) return;
        window.pages.warehouse.selectedZone = zone;
        window.pages.warehouse.selectedRack = null;
        window.pages.warehouse.selectedPosition = null;
        window.pages.warehouse.renderRegionSidebar(zone);
        window.pages.warehouse.renderMapOnly();
    }, 250);
};

window.pages.warehouse.handleRegionDblClick = function(zoneId) {
    clearTimeout(window.pages.warehouse.clickTimer);
    const zone = window.pages.warehouse.mapData.zones.find(z => z.id === zoneId);
    if (!zone) return;
    window.pages.warehouse.viewState = { level: 2, zoneId: zoneId, rackId: null };
    window.pages.warehouse.selectedZone = zone;
    window.pages.warehouse.selectedRack = null;
    window.pages.warehouse.selectedPosition = null;
    window.pages.warehouse.renderRegionSidebar(zone);
    window.pages.warehouse.renderMapOnly();
};

window.pages.warehouse.renderRegionSidebar = function(zone) {
    const sb = document.getElementById('warehouse-sidebar');
    if (!sb) return;

    let totalCap = 0, totalOcc = 0, products = [], totalCells = 0;
    zone.racks.forEach(rk => {
        rk.rows.forEach(rw => {
            totalCells += rw.positions.length;
            rw.positions.forEach(p => {
                totalCap += (p.capacity || 0);
                totalOcc += (p.current_occupancy || 0);
                if (p.inventory) {
                    p.inventory.forEach(inv => {
                        const existing = products.find(pr => pr.sku === inv.product_sku);
                        if (existing) {
                            existing.qty += inv.quantity;
                        } else if (inv.product_name) {
                            products.push({ name: inv.product_name, sku: inv.product_sku, qty: inv.quantity });
                        }
                    });
                }
            });
        });
    });

    const freeCap = Math.max(0, totalCap - totalOcc);
    const occPct = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : 0;

    sb.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <h2 style="margin:0; font-size: 1.4rem; color: #0f172a;">${zone.name}</h2>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                ${window.pages.warehouse.mapData.name} &bull; Region Telemetry
              </div>
            </div>
            <span class="dt-badge dt-badge-partial">REGION LEVEL</span>
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
            Contains ${zone.racks.length} operational racks &bull; ${totalCells} storage cells
        </div>

        <div class="dt-metrics-grid" style="margin-bottom: 1.25rem;">
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Total Capacity</div>
                <div class="dt-metric-value">${totalCap.toLocaleString()}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Available Free</div>
                <div class="dt-metric-value" style="color: #10b981;">${freeCap.toLocaleString()}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Occupied Units</div>
                <div class="dt-metric-value" style="color: #0284c7;">${totalOcc.toLocaleString()}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Occupancy Rate</div>
                <div class="dt-metric-value" style="color: ${occPct > 85 ? '#ef4444' : '#0f172a'};">${occPct}%</div>
            </div>
        </div>

        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #334155;">Active SKUs in Region (${products.length})</h4>
        ${products.length > 0 ? `
            <div style="max-height: 200px; overflow-y: auto; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1.25rem;">
                <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                   <thead>
                     <tr style="border-bottom: 1px solid #e2e8f0; background: #f1f5f9; color: #475569;">
                       <th style="padding: 6px 10px; text-align: left;">Product</th>
                       <th style="padding: 6px 10px; text-align: right;">Qty</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${products.map(pr => `
                       <tr style="border-bottom: 1px solid #f1f5f9;">
                         <td style="padding: 6px 10px;">
                           <strong>${pr.name}</strong><br>
                           <code style="color: #64748b; font-size: 0.75rem;">${pr.sku}</code>
                         </td>
                         <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">
                           ${pr.qty}
                         </td>
                       </tr>
                     `).join('')}
                   </tbody>
                </table>
            </div>
        ` : `<div style="font-size:0.85rem; color:#64748b; padding: 1rem; background: #f8fafc; border-radius: 6px; text-align: center; border: 1px dashed #cbd5e1; margin-bottom: 1.25rem;">No inventory stored in this region.</div>`}

        <button class="btn btn-primary" style="width: 100%;" onclick="window.pages.warehouse.handleRegionDblClick(${zone.id})">
            Open Region Racks &rarr;
        </button>
    `;
};

/* -------------------------------------------------------------
   LEVEL 2: RACKS WITHIN SELECTED REGION
   Clean grid of rectangular rack boxes with:
   - Rows × Columns
   - Total capacity, occupied, available
   - Stored products count
   - Compact visual preview of storage cells (mini 2D shelf preview)
   - Single click: side panel details
   - Double click: drill-down into Level 3
   - Open Rack button
------------------------------------------------------------- */
window.pages.warehouse.renderLevel2Racks = function(container, zone, isEdit) {
    if (!zone.racks || zone.racks.length === 0) {
        container.innerHTML = `
          <div class="card" style="padding: 3rem; text-align: center; background: #fff;">
            <h3>No Racks in ${zone.name}</h3>
            <p style="color: #64748b;">This region has no configured racks.</p>
            ${isEdit ? `
              <button class="btn btn-primary" onclick="window.pages.warehouse.showAddRackModal(${zone.id})">
                + Add Rack to ${zone.name}
              </button>
            ` : ''}
          </div>
        `;
        return;
    }

    let html = `<div class="dt-racks-grid">`;

    zone.racks.forEach((rk, rkIdx) => {
        let totalCap = 0;
        let totalOcc = 0;
        let maxCols = Math.max(rk.positions_per_row || 0, 1);
        let products = new Set();
        let totalCells = 0;

        rk.rows.forEach(rw => {
            if (rw.positions.length > maxCols) maxCols = rw.positions.length;
            totalCells += rw.positions.length;
            rw.positions.forEach(p => {
                totalCap += (p.capacity || 0);
                totalOcc += (p.current_occupancy || 0);
                if (p.inventory) {
                    p.inventory.forEach(inv => {
                        if (inv.product_sku) products.add(inv.product_sku);
                    });
                }
            });
        });

        const freeCap = Math.max(0, totalCap - totalOcc);
        const occPct = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : 0;
        const isSelected = window.pages.warehouse.selectedRack?.id === rk.id;

        // Determine occupancy state
        let stateClass = 'state-empty';
        let badgeClass = 'dt-badge-empty';
        let stateLabel = 'Empty';
        let progressColor = '#10b981';

        if (totalCap === 0 || totalCells === 0) {
            stateClass = 'state-inactive';
            badgeClass = 'dt-badge-inactive';
            stateLabel = 'Inactive';
            progressColor = '#94a3b8';
        } else if (occPct >= 100) {
            stateClass = 'state-full';
            badgeClass = 'dt-badge-full';
            stateLabel = 'Full';
            progressColor = '#ef4444';
        } else if (occPct >= 80) {
            stateClass = 'state-nearfull';
            badgeClass = 'dt-badge-nearfull';
            stateLabel = 'Nearly Full';
            progressColor = '#f59e0b';
        } else if (occPct > 0) {
            stateClass = 'state-partial';
            badgeClass = 'dt-badge-partial';
            stateLabel = 'Partially Occupied';
            progressColor = '#3b82f6';
        }

        const rackCode = `RK-${rk.id}`;

        // Build compact visual preview of storage cells (mini 2D shelf preview)
        let miniPreviewHtml = '';
        if (rk.rows.length > 0) {
            miniPreviewHtml = `
              <div class="dt-rack-preview-wrapper" title="Mini preview of storage cell tiers">
                <div class="dt-rack-preview-title">Cell Matrix Preview (${rk.rows.length}R &times; ${maxCols}C)</div>
                <div class="dt-mini-shelf" style="grid-template-rows: repeat(${Math.min(rk.rows.length, 6)}, 1fr);">
                  ${rk.rows.slice(0, 6).map((rw, rIdx) => `
                    <div style="display:grid; grid-template-columns: repeat(${maxCols}, 1fr); gap: 2px;">
                      ${Array.from({ length: maxCols }).map((_, cIdx) => {
                          const p = rw.positions[cIdx];
                          if (!p) return `<div class="dt-mini-cell occ-unconfigured"></div>`;
                          const meta = window.pages.warehouse.getPositionColorAndStatus(p);
                          return `<div class="dt-mini-cell ${meta.miniClass}"></div>`;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
        }

        html += `
          <div class="dt-rack-box ${stateClass} ${isSelected ? 'selected' : ''}"
               onclick="window.pages.warehouse.handleRackClick(${zone.id}, ${rk.id})"
               ondblclick="window.pages.warehouse.handleRackDblClick(${zone.id}, ${rk.id})"
               title="Rack: ${rk.name} (${rackCode})">
            
            <div>
              <div class="dt-box-header">
                <div>
                  <h3 class="dt-box-title" style="font-size: 1.15rem;">
                    <i data-icon="layers"></i> ${rk.name}
                    <span class="dt-box-code">${rackCode}</span>
                  </h3>
                  <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                    ${rk.rows.length} Rows &times; ${maxCols} Columns &bull; ${totalCells} Cells
                  </div>
                </div>
                <span class="dt-badge ${badgeClass}">${stateLabel}</span>
              </div>

              <!-- Compact Visual Preview of Cells -->
              ${miniPreviewHtml}

              <!-- Metrics -->
              <div class="dt-metrics-grid">
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Total Capacity</div>
                  <div class="dt-metric-value" style="font-size: 1.05rem;">${totalCap.toLocaleString()}</div>
                </div>
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Available Free</div>
                  <div class="dt-metric-value" style="font-size: 1.05rem; color: #10b981;">${freeCap.toLocaleString()}</div>
                </div>
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Occupied Qty</div>
                  <div class="dt-metric-value" style="font-size: 1.05rem; color: #0284c7;">${totalOcc.toLocaleString()}</div>
                </div>
                <div class="dt-metric-tile">
                  <div class="dt-metric-label">Products Stored</div>
                  <div class="dt-metric-value" style="font-size: 1.05rem; color: #6366f1;">${products.size} SKUs</div>
                </div>
              </div>

              <!-- Occupancy Progress Bar -->
              <div class="dt-progress-container">
                <div class="dt-progress-header">
                  <span style="color: #64748b;">Utilization:</span>
                  <span style="color: ${progressColor}; font-weight: 700;">${occPct}%</span>
                </div>
                <div class="dt-progress-bar">
                  <div class="dt-progress-fill" style="width: ${Math.min(occPct, 100)}%; background: ${progressColor};"></div>
                </div>
              </div>
            </div>

            <!-- Action Footer -->
            <div class="dt-box-footer">
              <span class="dt-box-hint">Double-click to open grid &rarr;</span>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.pages.warehouse.handleRackDblClick(${zone.id}, ${rk.id})">
                Open 2D Grid
              </button>
            </div>
          </div>
        `;
    });

    html += `</div>`;

    if (isEdit) {
        html += `
          <div style="margin-top: 1.5rem; text-align: center;">
            <button class="btn btn-secondary" onclick="window.pages.warehouse.showAddRackModal(${zone.id})">
              + Add New Rack to ${zone.name}
            </button>
          </div>
        `;
    }

    container.innerHTML = html;
};

window.pages.warehouse.handleRackClick = function(zoneId, rackId) {
    clearTimeout(window.pages.warehouse.clickTimer);
    window.pages.warehouse.clickTimer = setTimeout(() => {
        const zone = window.pages.warehouse.mapData.zones.find(z => z.id === zoneId);
        const rack = zone?.racks.find(r => r.id === rackId);
        if (!rack) return;
        window.pages.warehouse.selectedRack = rack;
        window.pages.warehouse.selectedPosition = null;
        window.pages.warehouse.renderRackSidebar(zone, rack);
        window.pages.warehouse.renderMapOnly();
    }, 250);
};

window.pages.warehouse.handleRackDblClick = function(zoneId, rackId) {
    clearTimeout(window.pages.warehouse.clickTimer);
    const zone = window.pages.warehouse.mapData.zones.find(z => z.id === zoneId);
    const rack = zone?.racks.find(r => r.id === rackId);
    if (!rack) return;
    window.pages.warehouse.viewState = { level: 3, zoneId: zoneId, rackId: rackId };
    window.pages.warehouse.selectedRack = rack;
    window.pages.warehouse.selectedPosition = null;
    window.pages.warehouse.renderRackSidebar(zone, rack);
    window.pages.warehouse.renderMapOnly();
};

window.pages.warehouse.renderRackSidebar = function(zone, rack) {
    const sb = document.getElementById('warehouse-sidebar');
    if (!sb) return;

    let totalCap = 0, totalOcc = 0, products = [], positionsList = [];
    rack.rows.forEach(rw => {
        rw.positions.forEach(p => {
            totalCap += (p.capacity || 0);
            totalOcc += (p.current_occupancy || 0);
            positionsList.push(p);
            if (p.inventory) {
                p.inventory.forEach(inv => {
                    const existing = products.find(pr => pr.sku === inv.product_sku);
                    if (existing) {
                        existing.qty += inv.quantity;
                        if (!existing.positions.includes(p.code)) existing.positions.push(p.code);
                    } else if (inv.product_name) {
                        products.push({ 
                            name: inv.product_name, 
                            sku: inv.product_sku, 
                            qty: inv.quantity, 
                            positions: [p.code] 
                        });
                    }
                });
            }
        });
    });

    const freeCap = Math.max(0, totalCap - totalOcc);
    const occPct = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : 0;

    sb.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <h2 style="margin:0; font-size: 1.4rem; color: #0f172a;">${rack.name}</h2>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                Located in ${zone.name} &bull; Rack Telemetry
              </div>
            </div>
            <span class="dt-badge dt-badge-partial">RACK LEVEL</span>
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
            ${rack.rows.length} rows &bull; ${positionsList.length} total cells configured
        </div>

        <div class="dt-metrics-grid" style="margin-bottom: 1.25rem;">
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Capacity</div>
                <div class="dt-metric-value">${totalCap.toLocaleString()}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Available Free</div>
                <div class="dt-metric-value" style="color: #10b981;">${freeCap.toLocaleString()}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Occupied Qty</div>
                <div class="dt-metric-value" style="color: #0284c7;">${totalOcc.toLocaleString()}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Occupancy Rate</div>
                <div class="dt-metric-value" style="color: ${occPct > 85 ? '#ef4444' : '#0f172a'};">${occPct}%</div>
            </div>
        </div>

        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #334155;">Stored Products & Positions (${products.length})</h4>
        ${products.length > 0 ? `
            <div style="max-height: 220px; overflow-y: auto; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1.25rem;">
                <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                   <thead>
                     <tr style="border-bottom: 1px solid #e2e8f0; background: #f1f5f9; color: #475569;">
                       <th style="padding: 6px 10px; text-align: left;">Product / SKU</th>
                       <th style="padding: 6px 10px; text-align: left;">Positions</th>
                       <th style="padding: 6px 10px; text-align: right;">Qty</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${products.map(pr => `
                       <tr style="border-bottom: 1px solid #f1f5f9;">
                         <td style="padding: 6px 10px;">
                           <strong>${pr.name}</strong><br>
                           <code style="color: #64748b; font-size: 0.75rem;">${pr.sku}</code>
                         </td>
                         <td style="padding: 6px 10px; color: #475569; font-size: 0.75rem;">
                           ${pr.positions.slice(0, 3).join(', ')}${pr.positions.length > 3 ? '...' : ''}
                         </td>
                         <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">
                           ${pr.qty}
                         </td>
                       </tr>
                     `).join('')}
                   </tbody>
                </table>
            </div>
        ` : `<div style="font-size:0.85rem; color:#64748b; padding: 1rem; background: #f8fafc; border-radius: 6px; text-align: center; border: 1px dashed #cbd5e1; margin-bottom: 1.25rem;">No inventory stored in this rack.</div>`}

        <button class="btn btn-primary" style="width: 100%;" onclick="window.pages.warehouse.handleRackDblClick(${zone.id}, ${rack.id})">
            Open 2D Storage Grid &rarr;
        </button>
    `;
};

/* -------------------------------------------------------------
   LEVEL 3: PROPER 2D ROW-AND-COLUMN STORAGE GRID
   Pure CSS Grid implementation:
   - Dynamic rows R01..Rn and columns C01..Cm based on real database configuration
   - Every column track has identical width; vertically aligned across all rows
   - Final row renders correctly: unconfigured slots render an empty placeholder
     without collapsing or separating labels from capacity values
   - Each cell is ONE complete visual unit:
     * Position Code (e.g. A1-01)
     * Occupied / Capacity (e.g. 20 / 100)
     * Status Badge (e.g. PARTIAL)
   - Single click: detailed inspection in side panel
------------------------------------------------------------- */
window.pages.warehouse.renderLevel3Grid = function(container, zone, rack, isEdit) {
    const filters = window.pages.warehouse.filters || { search: '', status: '' };
    const selectedId = window.pages.warehouse.selectedPosition ? window.pages.warehouse.selectedPosition.id : null;
    
    // Calculate total columns across all rows in this rack
    let maxCols = Math.max(rack.positions_per_row || 0, 1);
    rack.rows.forEach(rw => {
        if (rw.positions.length > maxCols) maxCols = rw.positions.length;
    });

    if (maxCols === 0 && !isEdit) {
        container.innerHTML = `
          <div class="card dt-storage-card" style="text-align: center; padding: 3rem;">
            <h3>No positions found in ${rack.name}</h3>
            <p style="color:#64748b;">This rack has no configured storage cells.</p>
          </div>
        `;
        return;
    }

    // Column header labels
    let colHeaders = [];
    for (let c = 1; c <= maxCols; c++) {
        colHeaders.push(`C${c < 10 ? '0' + c : c}`);
    }

    let gridHtml = `
      <div class="dt-storage-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="margin:0; font-size: 1.25rem; color: #0f172a;">
                ${zone.name} &rarr; ${rack.name} &mdash; 2D Storage Matrix
              </h3>
              <p style="margin:2px 0 0 0; color:#64748b; font-size:0.85rem;">
                ${rack.rows.length} Rows &times; ${maxCols} Columns &bull; Click any cell to inspect live stock and capacity limits
              </p>
            </div>
            ${isEdit ? `<button class="btn btn-secondary btn-sm" onclick="window.pages.warehouse.showAddRowModal(${rack.id})">+ Add Row</button>` : ''}
        </div>

        <!-- Scrollable CSS Grid Pane -->
        <div class="dt-grid-scroll-pane">
          <div class="dt-storage-matrix" style="grid-template-columns: 80px repeat(${maxCols}, minmax(105px, 120px));">
             <!-- Corner Header: Row \ Col -->
             <div class="dt-corner-header">ROW \\ COL</div>

             <!-- Column Headers: C01, C02, ... -->
             ${colHeaders.map((ch, cIdx) => `
                <div class="dt-col-header" style="grid-column: ${cIdx + 2};">
                  ${ch}
                </div>
             `).join('')}

             <!-- Row Labels and Aligned 2D Storage Cells -->
    `;

    rack.rows.forEach((rw, rIdx) => {
        const gridRowIndex = rIdx + 2; // Row 1 is headers, so rows start at 2
        let rowLabel = rw.name || `R${rIdx < 9 ? '0' + (rIdx + 1) : (rIdx + 1)}`;

        // Row Header Label (R01, R02, etc.)
        gridHtml += `
            <div class="dt-row-header" style="grid-row: ${gridRowIndex};">
              ${rowLabel}
            </div>
        `;

        // Render exactly maxCols cells in this row to maintain vertical alignment
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            const gridColIndex = colIdx + 2;
            const pos = rw.positions[colIdx];

            if (!pos) {
                // Aligned Unconfigured Slot in shorter rows (e.g. final row with fewer positions)
                gridHtml += `
                  <div class="dt-storage-cell-unconfigured" style="grid-row: ${gridRowIndex}; grid-column: ${gridColIndex};" title="Unconfigured Position Slot">
                    <span>&mdash;</span>
                    <div>Not Configured</div>
                  </div>
                `;
                continue;
            }

            const meta = window.pages.warehouse.getPositionColorAndStatus(pos);
            const occ = pos.current_occupancy || 0;
            const cap = pos.capacity || 0;
            const occPct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
            const isSelected = (pos.id === selectedId);

            // Filter logic
            let isDimmed = false;
            if (filters.search) {
                const searchTxt = filters.search.toLowerCase();
                const codeMatch = pos.code.toLowerCase().includes(searchTxt);
                const prodMatch = pos.inventory && pos.inventory.some(inv => 
                    (inv.product_name && inv.product_name.toLowerCase().includes(searchTxt)) ||
                    (inv.product_sku && inv.product_sku.toLowerCase().includes(searchTxt))
                );
                if (!codeMatch && !prodMatch) isDimmed = true;
            }
            if (filters.status && meta.state !== filters.status) {
                isDimmed = true;
            }

            const hierarchy = `${window.pages.warehouse.mapData.name} > ${zone.name} > ${rack.name} > ${rowLabel} > Column ${colIdx + 1}`;
            const posJson = encodeURIComponent(JSON.stringify(pos));
            const hierarchyJson = encodeURIComponent(hierarchy);

            // Storage Cell: ONE complete visual unit containing code, capacity, and badge
            gridHtml += `
              <div class="dt-storage-cell ${meta.cellClass} ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}" 
                   style="grid-row: ${gridRowIndex}; grid-column: ${gridColIndex};"
                   title="${pos.code} | Cap: ${cap} | Occ: ${occ} (${occPct}%)"
                   onclick="window.pages.warehouse.selectPosition('${posJson}', '${hierarchyJson}')">
                
                <div class="dt-cell-code">${pos.code}</div>
                <div class="dt-cell-capacity">${occ} / ${cap}</div>
                <div class="dt-cell-badge">${meta.badge}</div>
              </div>
            `;
        }
    });

    gridHtml += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = gridHtml;
};

/* -------------------------------------------------------------
   STORAGE CELL INSPECTION IN SIDE PANEL
------------------------------------------------------------- */
window.pages.warehouse.selectPosition = function(posJsonString, hierarchyJson, rerender = true) {
    const pos = JSON.parse(decodeURIComponent(posJsonString));
    const hierarchy = decodeURIComponent(hierarchyJson);
    
    window.pages.warehouse.selectedPosition = { id: pos.id, posJson: posJsonString, hierarchy: hierarchyJson };
    if (rerender) {
        window.pages.warehouse.renderMapOnly();
    }
    
    const sb = document.getElementById('warehouse-sidebar');
    if (!sb) return;
    
    let invHtml = '';
    if (pos.inventory && pos.inventory.length > 0) {
        invHtml = `
          <div style="max-height: 200px; overflow-y: auto; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1.25rem;">
            <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
               <thead>
                 <tr style="border-bottom: 1px solid #e2e8f0; background: #f1f5f9; color: #475569;">
                   <th style="padding: 6px 10px; text-align: left;">Product</th>
                   <th style="padding: 6px 10px; text-align: left;">Expiry</th>
                   <th style="padding: 6px 10px; text-align: right;">Qty</th>
                 </tr>
               </thead>
               <tbody>
                 ${pos.inventory.map(inv => `
                   <tr style="border-bottom: 1px solid #f1f5f9;">
                     <td style="padding: 6px 10px;">
                       <strong>${inv.product_name}</strong><br>
                       <code style="color: #64748b; font-size: 0.75rem;">${inv.product_sku || 'N/A'}</code>
                     </td>
                     <td style="padding: 6px 10px; color: #64748b; font-size: 0.75rem;">
                       ${inv.expiry_date || 'None'}
                     </td>
                     <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #0284c7;">
                       ${inv.quantity}
                     </td>
                   </tr>
                 `).join('')}
               </tbody>
            </table>
          </div>
        `;
    } else {
        invHtml = `
          <div style="background: #f8fafc; padding: 1.25rem 1rem; border-radius: 6px; text-align: center; border: 1px dashed #cbd5e1; margin-bottom: 1.25rem;">
            <p style="color: #64748b; margin: 0; font-size: 0.85rem;">
              No inventory stored in this position (Empty Storage Cell).
            </p>
          </div>
        `;
    }
    
    const meta = window.pages.warehouse.getPositionColorAndStatus(pos);
    const occPct = pos.capacity > 0 ? Math.round((pos.current_occupancy / pos.capacity) * 100) : 0;
    const available = Math.max(0, pos.capacity - pos.current_occupancy);
    
    sb.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
            <div>
              <h2 style="margin:0; font-size: 1.5rem; color: #0f172a; font-family: monospace;">${pos.code}</h2>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                Storage Cell Telemetry
              </div>
            </div>
            <span class="dt-badge" style="background: ${meta.color}; color: #fff;">${meta.badge}</span>
        </div>
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9; line-height: 1.4;">
            <i data-icon="map-pin"></i> <strong>Path:</strong> ${hierarchy}
        </div>
        
        <div class="dt-metrics-grid" style="margin-bottom: 1.25rem;">
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Max Capacity</div>
                <div class="dt-metric-value">${pos.capacity}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Available Free</div>
                <div class="dt-metric-value" style="color: #10b981;">${available}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Occupied Units</div>
                <div class="dt-metric-value" style="color: #0284c7;">${pos.current_occupancy}</div>
            </div>
            <div class="dt-metric-tile">
                <div class="dt-metric-label">Occupancy %</div>
                <div class="dt-metric-value" style="color: ${occPct > 85 ? '#ef4444' : '#0f172a'};">${occPct}%</div>
            </div>
        </div>

        <div class="dt-progress-container" style="margin-bottom: 1.25rem;">
            <div class="dt-progress-bar">
                <div class="dt-progress-fill" style="width: ${Math.min(occPct, 100)}%; background: ${meta.color};"></div>
            </div>
        </div>
        
        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #334155;">Stored Physical Inventory</h4>
        ${invHtml}
        
        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.95rem; color: #334155; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;">
          Position Configuration
        </h4>
        <form onsubmit="window.pages.warehouse.updatePosition(event, ${pos.id}, ${pos.current_occupancy})" style="background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div class="form-group" style="margin-bottom: 0.75rem;">
                <label style="font-size: 0.8rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">
                  Max Capacity (Units)
                </label>
                <input type="number" id="edit-capacity" value="${pos.capacity}" class="wf-input" min="${pos.current_occupancy}" required style="padding: 0.45rem; width: 100%;">
                <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 3px;">
                  Must be &ge; current occupancy (${pos.current_occupancy})
                </small>
            </div>
            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="font-size: 0.8rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">
                  Status Override
                </label>
                <select id="edit-status" class="wf-input" style="padding: 0.45rem; width: 100%;">
                    <option value="AVAILABLE" ${pos.status==='AVAILABLE'?'selected':''}>AVAILABLE (Operational)</option>
                    <option value="MAINTENANCE" ${pos.status==='MAINTENANCE'?'selected':''}>MAINTENANCE (Inactive)</option>
                    <option value="INACTIVE" ${pos.status==='INACTIVE'?'selected':''}>INACTIVE (Decommissioned)</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">
              Save Position Settings
            </button>
        </form>
    `;
};

window.pages.warehouse.findPositionById = function(id) {
    if (!window.pages.warehouse.mapData) return null;
    let found = null;
    let hierarchy = '';
    const mapData = window.pages.warehouse.mapData;
    
    mapData.zones.forEach(z => {
        z.racks.forEach(rk => {
            rk.rows.forEach(rw => {
                rw.positions.forEach(pos => {
                    if (pos.id === id) {
                        found = encodeURIComponent(JSON.stringify(pos));
                        hierarchy = encodeURIComponent(`${mapData.name} > ${z.name} > ${rk.name} > ${rw.name}`);
                    }
                });
            });
        });
    });
    
    if (found) return { posJson: found, hierarchy: hierarchy };
    return null;
};

window.pages.warehouse.updatePosition = async function(e, id, currentOccupancy) {
    e.preventDefault();
    const capacity = parseInt(document.getElementById('edit-capacity').value);
    const status = document.getElementById('edit-status').value;
    
    if (capacity < currentOccupancy) {
        window.WF.toast("Capacity cannot be less than currently occupied units.", "bad");
        return;
    }
    
    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerText = "Saving...";
        btn.disabled = true;
        
        await window.apiClient.warehouses.updatePosition(id, {
            capacity: capacity,
            status: status
        });
        
        window.WF.toast("Storage position updated successfully.", "good");
        await window.pages.warehouse.refreshMap();
        
    } catch(err) {
        window.WF.toast("Error: " + err.message, "bad");
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) {
            btn.innerText = "Save Position Settings";
            btn.disabled = false;
        }
    }
};

window.pages.warehouse.showAddZoneModal = async function() {
    const name = prompt("Enter new Region / Zone name (e.g. Zone C):");
    if (!name) return;
    try {
        const payload = {
            warehouse_id: window.pages.warehouse.currentWarehouseId,
            name: name
        };
        const token = window.apiClient.getToken();
        const res = await fetch(`${window.API_BASE_URL || 'http://localhost:8000/api'}/warehouses/zones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if(!res.ok) throw new Error((await res.json()).detail);
        window.WF.toast("Region added successfully", "good");
        await window.pages.warehouse.refreshMap();
    } catch(e) { window.WF.toast("Failed: " + e.message, "bad"); }
};

window.pages.warehouse.showAddRackModal = async function(zoneId) {
    const name = prompt("Enter new Rack name (e.g. Rack 3):");
    if (!name) return;
    try {
        const payload = { zone_id: zoneId, name: name };
        const token = window.apiClient.getToken();
        const res = await fetch(`${window.API_BASE_URL || 'http://localhost:8000/api'}/warehouses/racks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if(!res.ok) throw new Error((await res.json()).detail);
        window.WF.toast("Rack added successfully", "good");
        await window.pages.warehouse.refreshMap();
    } catch(e) { window.WF.toast("Failed: " + e.message, "bad"); }
};

window.pages.warehouse.showAddRowModal = async function(rackId) {
    const name = prompt("Enter Row label (e.g. Row 3):");
    if (!name) return;
    const num = prompt("Enter Row index number (e.g. 3):", "3");
    if (!num) return;
    try {
        const payload = { rack_id: rackId, name: name, row_number: parseInt(num) };
        const token = window.apiClient.getToken();
        const res = await fetch(`${window.API_BASE_URL || 'http://localhost:8000/api'}/warehouses/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if(!res.ok) throw new Error((await res.json()).detail);
        window.WF.toast("Row added successfully", "good");
        await window.pages.warehouse.refreshMap();
    } catch(e) { window.WF.toast("Failed: " + e.message, "bad"); }
};

window.pages.warehouse.runDiagnostics = async function() {
    try {
        const btn = document.querySelector('button[onclick="window.pages.warehouse.runDiagnostics()"]');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<i data-icon="loader"></i> Checking...';
            btn.disabled = true;
        }
        
        const token = window.apiClient.getToken();
        const response = await fetch(`${window.API_BASE_URL || 'http://localhost:8000/api'}/inventory/diagnostics/inventory-consistency`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Diagnostic check failed.");
        const data = await response.json();
        
        if (btn) {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
        
        let reportHtml = `<div style="max-height: 400px; overflow-y: auto;">`;
        if (data.inconsistencies_found === 0) {
            reportHtml += `<p style="color: #10b981; font-weight: bold;"><i data-icon="check-circle"></i> Database is fully consistent. All physical cell allocations match inventory records.</p>`;
        } else {
            reportHtml += `<p style="color: #ef4444; font-weight: bold;"><i data-icon="alert-circle"></i> Found ${data.inconsistencies_found} inconsistencies!</p>`;
            reportHtml += `<ul style="list-style: none; padding: 0;">`;
            data.details.forEach(issue => {
                reportHtml += `<li style="padding: 10px; margin-bottom: 8px; border: 1px solid #fecaca; background: #fef2f2; border-radius: 4px;">
                    <strong>${issue.type}</strong><br>
                    ${issue.message}
                </li>`;
            });
            reportHtml += `</ul>`;
        }
        reportHtml += `</div>`;
        
        const modalHtml = `
          <div class="scrim" style="display:flex; align-items:center; justify-content:center; opacity:1; pointer-events:auto; z-index:999; background:rgba(0,0,0,0.6);" id="diag-scrim">
            <div class="card" style="width: 100%; max-width: 600px; max-height: 90vh; position:relative; pointer-events:auto; background: #fff; border-radius: 8px; padding: 1.5rem;">
              <button class="icon-btn" style="position:absolute; top:16px; right:16px;" onclick="document.getElementById('diag-scrim').remove()"><i data-icon="x"></i></button>
              <div class="card-h">
                <h3 style="margin:0;">Warehouse Integrity Report</h3>
              </div>
              <div style="margin-top: 1rem;">
                ${reportHtml}
              </div>
              <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:2rem;">
                <button type="button" class="btn btn-primary" onclick="document.getElementById('diag-scrim').remove()">Close</button>
              </div>
            </div>
          </div>
        `;
        
        const container = document.getElementById('product-modal-container') || document.body;
        const temp = document.createElement('div');
        temp.innerHTML = modalHtml;
        container.appendChild(temp.firstElementChild);
        
        if (window.WF && typeof window.WF.hydrate === 'function') {
            window.WF.hydrate(document.getElementById('diag-scrim'));
        }
    } catch(e) {
        window.WF.toast("Failed: " + e.message, "bad");
    }
};
