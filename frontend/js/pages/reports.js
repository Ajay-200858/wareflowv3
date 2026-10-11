window.pages = window.pages || {};

window.pages.reports = async function(container) {
  const api = window.apiClient;
  
  try {
      const dashboard = await api.dashboard.overview();
      const products = await api.products.getAll();
      const orders = await api.orders.getAll();
      
      const delayedOrders = orders.filter(o => o.status === 'DELAYED').length;
      const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
      
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Reports & Analytics</h1>
          <button class="btn btn-primary" onclick="window.print()">Export PDF</button>
        </div>
        
        <div class="dgrid">
          <div class="card" style="padding: 1.5rem;">
            <h3>Inventory Summary</h3>
            <ul style="margin-top:1rem; list-style:none; padding:0;">
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Total Products:</span> <b>${dashboard.products}</b></li>
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Total Stock Value:</span> <b>Calculated per unit</b></li>
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Warehouse Occupancy:</span> <b>${Math.round(dashboard.occupancy_percentage)}%</b></li>
            </ul>
          </div>
          
          <div class="card" style="padding: 1.5rem;">
            <h3>Order Fulfillment</h3>
            <ul style="margin-top:1rem; list-style:none; padding:0;">
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Total Orders:</span> <b>${dashboard.orders}</b></li>
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Completed:</span> <b>${completedOrders}</b></li>
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between; color:#e5573f;"><span>Delayed:</span> <b>${delayedOrders}</b></li>
            </ul>
          </div>
          
          <div class="card" style="padding: 1.5rem;">
            <h3>Workforce</h3>
            <ul style="margin-top:1rem; list-style:none; padding:0;">
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Active Employees:</span> <b>${dashboard.employees}</b></li>
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Today's Picking Jobs:</span> <b>${dashboard.today_picking}</b></li>
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Today's Packing Jobs:</span> <b>${dashboard.today_packing}</b></li>
            </ul>
          </div>
          
          <div class="card" style="padding: 1.5rem;">
            <h3>AI Decisions Activity</h3>
            <ul style="margin-top:1rem; list-style:none; padding:0;">
              <li style="margin-bottom:0.5rem; display:flex; justify-content:space-between;"><span>Pending Reviews:</span> <b>${dashboard.pending_ai_decisions}</b></li>
            </ul>
          </div>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading reports: ${e.message}</p>`;
  }
};
