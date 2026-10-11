window.pages = window.pages || {};

window.pages.overview = async function(container) {
  const api = window.apiClient;
  
  try {
      const data = await api.dashboard.overview();
      
      let workloads = "";
      if (data.employee_workloads && data.employee_workloads.length > 0) {
          workloads = data.employee_workloads.map(e => `
            <div style="margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <b>${e.name}</b> <span>${e.workload}%</span>
              </div>
              <div class="bar" style="background:#0e1b2620; height:6px; border-radius:3px;">
                <i style="--w:${e.workload}%; background: ${e.workload > 80 ? '#e5573f' : '#f5b335'}; display:block; height:100%; border-radius:3px; transition:width 0.3s;"></i>
              </div>
            </div>
          `).join('');
      } else {
          workloads = '<div style="color:#666; font-size: 0.9rem;">No employees added yet.</div>';
      }

      container.innerHTML = `
        <section class="hero" data-scene-host style="min-height: 200px; padding: 2rem; margin-bottom: 2rem;">
          <div class="scene" data-scene></div>
          <div style="position:relative; z-index:2; color:white;">
            <h1 style="margin:0; font-size: 2rem;">Good morning</h1>
            <p style="opacity: 0.8; margin-top: 0.5rem;">Here is your warehouse operational summary.</p>
          </div>
        </section>

        <div class="kpis">
          <div class="kpi" data-reveal><span><i data-icon="chip"></i>Products</span><b><span data-count="${data.products}">${data.products}</span></b></div>
          <div class="kpi" data-reveal><span><i data-icon="file"></i>Orders</span><b><span data-count="${data.orders}">${data.orders}</span></b></div>
          <div class="kpi" data-reveal><span><i data-icon="users"></i>Employees</span><b><span data-count="${data.employees}">${data.employees}</span></b></div>
          <div class="kpi" data-reveal><span><i data-icon="grid"></i>Occupancy</span><b><span data-count="${Math.round(data.occupancy_percentage)}">${Math.round(data.occupancy_percentage)}</span><em>%</em></b></div>
        </div>

        <div class="dgrid" style="margin-top: 2rem;">
          <div class="dcol">
            <section class="card" data-reveal>
              <div class="card-h">
                <h3><i data-icon="spark"></i>AI DECISIONS</h3>
                <a href="#aidecisions">Review all</a>
              </div>
              <div style="padding: 1rem 0;">
                 ${data.pending_ai_decisions} recommendations waiting for your review.
              </div>
              <button class="btn btn-primary" onclick="window.router.navigate('#aidecisions')">Review decisions</button>
            </section>

            <section class="card" data-reveal>
              <div class="card-h">
                <h3><i data-icon="check"></i>TODAY'S OPERATIONS</h3>
              </div>
              <dl class="dl">
                <div><dt>Picking Jobs</dt><dd>${data.today_picking}</dd></div>
                <div><dt>Packing Jobs</dt><dd>${data.today_packing}</dd></div>
                <div><dt>Delayed</dt><dd style="color:#e5573f">${data.delayed_orders}</dd></div>
              </dl>
            </section>
          </div>

          <div class="dcol">
            <section class="card" data-reveal>
              <div class="card-h">
                <h3><i data-icon="users"></i>EMPLOYEE WORKLOAD</h3>
                <a href="#employees">View team</a>
              </div>
              <div style="margin-top: 1rem;">
                ${workloads}
              </div>
            </section>
            
            <section class="card" data-reveal>
              <div class="card-h">
                <h3><i data-icon="warehouse"></i>WAREHOUSE MAP</h3>
                <a href="#warehouse">Open map</a>
              </div>
              <div style="background:#0A141D; border-radius:8px; padding:20px; text-align:center; color:#8FA9B8; margin-top:1rem; cursor:pointer;" onclick="window.router.navigate('#warehouse')">
                <i data-icon="warehouse" style="width:40px;height:40px;opacity:0.5;margin-bottom:10px;display:block;margin:0 auto 10px;"></i>
                Click to view full 2D map
              </div>
            </section>
          </div>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading dashboard: ${e.message}</p>`;
  }
};
