window.pages = window.pages || {};

window.pages.employeePortal = async function(container) {
  const api = window.apiClient;
  const userStr = localStorage.getItem('wf_user_obj');
  if (!userStr) {
      container.innerHTML = `<p>Please log in to view portal.</p>`;
      return;
  }
  
  const user = JSON.parse(userStr);
  const employeeId = user.id; // Assume user ID matches employee ID or is handled via API
  
  try {
      // First get all jobs to filter for this employee
      const jobs = await api.jobs.getAll();
      const myJobs = jobs.filter(j => j.employee_id === employeeId && j.status !== 'COMPLETED');
      
      const jobsHtml = myJobs.map(j => {
         return `
           <div class="ep-job-card">
             <div style="display:flex; justify-content:space-between;">
               <h3>${j.job_type} Job: ${j.id}</h3>
               <span class="status-badge status-${j.status.toLowerCase().replace(' ', '-')}">${j.status}</span>
             </div>
             <p><b>Order:</b> ${j.order_id}</p>
             <p><b>Estimated Time:</b> ${j.estimated_minutes || 15} minutes</p>
             
             <div style="display:flex; gap:10px; margin-top:16px;">
               ${j.status === 'ASSIGNED' ? `<button class="btn btn-primary" onclick="window.pages.employeePortal.acceptJob('${j.id}')">Accept Job</button>` : ''}
               ${j.status === 'ASSIGNED' ? `<button class="btn btn-ghost" onclick="window.pages.employeePortal.rejectJob('${j.id}')" style="color:red;">Reject</button>` : ''}
               ${(j.status === 'ACCEPTED' || j.status === 'STARTED') ? `<button class="btn btn-primary" onclick="window.pages.employeePortal.completeJob('${j.id}')">Complete Job</button>` : ''}
             </div>
           </div>
         `;
      }).join('');
      
      // Let's get actual employee info if possible
      let empName = user.name || "Employee";
      let workload = 0;
      let performance = 100;
      let completedJobs = 0;
      
      try {
          const employees = await api.employees.getAll();
          const me = employees.find(e => e.id == employeeId);
          if (me) {
              empName = me.name || empName;
              workload = me.workload || 0;
              performance = me.performance_score || 100;
              completedJobs = me.jobs_completed || 0;
          }
      } catch (e) {
          console.error("Could not fetch employee profile details", e);
      }
    
      container.innerHTML = `
        <section class="hero" data-scene-host style="min-height: 150px; padding: 2rem; margin-bottom: 2rem;">
          <div class="scene" data-scene></div>
          <div style="position:relative; z-index:2; color:white;">
            <h1 style="margin:0; font-size: 2rem;">Good morning, ${empName}</h1>
            <p style="opacity: 0.8; margin-top: 0.5rem;">You have ${myJobs.length} active jobs today.</p>
          </div>
        </section>
    
        <div class="dgrid">
          <div class="dcol">
             <h2>My Jobs</h2>
             ${jobsHtml.length ? jobsHtml : '<div class="card"><p>No jobs assigned right now.</p></div>'}
          </div>
          <div class="dcol">
             <div class="card">
                <h3>My Performance & Workload</h3>
                <div style="font-size:32px; font-weight:700; color:#388E3C; margin-bottom:10px;">${performance.toFixed(1)}%</div>
                <dl class="dl">
                  <div><dt>Completed Jobs</dt><dd>${completedJobs}</dd></div>
                  <div><dt>Current Workload</dt><dd>${workload} min</dd></div>
                </dl>
                <div style="margin-top:20px;">
                    <button class="btn btn-secondary" onclick="window.pages.employeePortal.refreshWorkload(${employeeId})">Refresh Workload</button>
                    <button class="btn btn-ghost" onclick="window.pages.employeePortal.markUnavailable(${employeeId})">Report Unavailable (Sick/Leave)</button>
                </div>
             </div>
          </div>
        </div>
      `;
  } catch (err) {
      container.innerHTML = `<p>Error loading portal: ${err.message}</p>`;
  }
};

window.pages.employeePortal.acceptJob = async function(jobId) {
    try {
        await window.apiClient.jobs.accept(jobId);
        window.WF.toast('Job accepted.', 'good');
        window.pages.employeePortal(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to accept: ' + e.message, 'bad');
    }
};

window.pages.employeePortal.rejectJob = async function(jobId) {
    const reason = prompt("Why are you rejecting this job?");
    if (reason === null) return;
    try {
        await window.apiClient.jobs.reject(jobId, reason || "No reason");
        window.WF.toast('Job rejected.', 'good');
        window.pages.employeePortal(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to reject: ' + e.message, 'bad');
    }
};

window.pages.employeePortal.completeJob = async function(jobId) {
    try {
        await window.apiClient.jobs.complete(jobId);
        window.WF.toast('Job completed! Inventory/Order updated.', 'good');
        window.pages.employeePortal(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to complete: ' + e.message, 'bad');
    }
};

window.pages.employeePortal.refreshWorkload = async function(empId) {
    try {
        await window.apiClient.employees.calculateWorkload(empId);
        window.WF.toast('Workload recalculated successfully.', 'good');
        window.pages.employeePortal(document.getElementById('router-view'));
    } catch(e) {
        window.WF.toast('Failed to recalculate workload: ' + e.message, 'bad');
    }
};

window.pages.employeePortal.markUnavailable = async function(empId) {
    const status = prompt("Enter status (ON_LEAVE or SICK):", "SICK");
    if (!status) return;
    try {
        const payload = {
            employee_id: empId,
            date: new Date().toISOString(),
            status: status.toUpperCase()
        };
        await window.apiClient.employees.setAvailability(empId, payload);
        window.WF.toast('Availability updated. You will not be assigned new jobs today.', 'good');
    } catch(e) {
        window.WF.toast('Failed to update availability: ' + e.message, 'bad');
    }
};
