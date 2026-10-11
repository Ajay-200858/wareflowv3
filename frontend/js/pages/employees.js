window.pages = window.pages || {};

window.pages.employees = async function(container) {
  const api = window.apiClient;
  
  try {
      const employees = await api.employees.getAll();

      const rows = employees.map(e => {
        const workload = e.current_workload || 0;
        return `
        <tr>
          <td><b>EMP-${e.id}</b></td>
          <td>${e.first_name} ${e.last_name}</td>
          <td>${e.role_type}</td>
          <td>N/A</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
               <div style="flex:1; height:6px; background:#0e1b2620; border-radius:3px;">
                 <div style="width:${workload}%; background:${workload > 80 ? '#e5573f' : '#f5b335'}; height:100%; border-radius:3px;"></div>
               </div>
               <span style="font-size:12px;">${workload}%</span>
            </div>
          </td>
          <td><span class="status-badge status-active">${e.status}</span></td>
        </tr>
      `}).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Employees</h1>
        </div>
        
        <div class="panel" style="overflow-x:auto;">
          <table class="wf-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Role</th>
                <th>Accuracy</th>
                <th>Current Workload</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length > 0 ? rows : '<tr><td colspan="6" style="text-align:center">No employees found.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading employees: ${e.message}</p>`;
  }
};
