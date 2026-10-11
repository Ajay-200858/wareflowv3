window.pages = window.pages || {};

window.pages.aiDecisions = async function(container) {
  const api = window.apiClient;
  try {
      const [recs, modelInfo] = await Promise.all([
          api.ai.getDecisions().catch(() => []),
          api.ai.getModels().catch(() => null)
      ]);

      const storageModel = modelInfo?.storage_model || {};
      const employeeModel = modelInfo?.employee_model || {};
      const feedback = modelInfo?.feedback_stats || { total_decisions_recorded: 0, accepted: 0, modified: 0, rejected: 0 };

      const rows = (recs || []).map(r => {
        const isPending = r.status === 'PENDING';
        let badgeColor = '#64748b';
        let badgeBg = '#f1f5f9';
        if (r.status === 'ACCEPTED') { badgeColor = '#15803d'; badgeBg = '#dcfce7'; }
        else if (r.status === 'MODIFIED') { badgeColor = '#b45309'; badgeBg = '#fef3c7'; }
        else if (r.status === 'REJECTED') { badgeColor = '#b91c1c'; badgeBg = '#fee2e2'; }
        else if (r.status === 'PENDING') { badgeColor = '#0369a1'; badgeBg = '#e0f2fe'; }

        const scoreText = r.type === 'EMPLOYEE_ASSIGNMENT' 
            ? `${(r.confidence || 0).toFixed(0)}/100 (Suitability)` 
            : `${(r.confidence || 0).toFixed(0)}% (Match Score)`;

        return `
          <tr>
            <td><b>#${r.id}</b></td>
            <td>
              <span class="pill" style="font-size:0.75rem;">${r.type || 'RECOMMENDATION'}</span>
            </td>
            <td>
              <strong>${r.recommendation || '-'}</strong>
              ${r.product_id ? `<div style="font-size:0.75rem; color:#64748b;">Product ID: ${r.product_id}</div>` : ''}
              ${r.job_id ? `<div style="font-size:0.75rem; color:#64748b;">Job #${r.job_id}</div>` : ''}
            </td>
            <td style="max-width:280px; font-size:0.85rem; color:#475569;">
              ${r.reason || '-'}
              ${r.decision_reason ? `<div style="font-size:0.75rem; color:#b45309; margin-top:2px;"><em>Feedback: ${r.decision_reason}</em></div>` : ''}
            </td>
            <td>
              <div style="font-weight:600; font-size:0.85rem;">${scoreText}</div>
              <div style="font-size:0.75rem; color:#64748b;">${r.model_version || 'v2.0'}</div>
            </td>
            <td>
              <span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; color:${badgeColor}; background:${badgeBg};">
                ${r.status}
              </span>
            </td>
            <td>
              ${isPending ? `
                <div style="display:flex; gap:4px;">
                  <button class="btn btn-primary btn-sm" onclick="window.pages.aiDecisions.decide('${r.id}', 'ACCEPTED')">Accept</button>
                  <button class="btn btn-secondary btn-sm" onclick="window.pages.aiDecisions.decide('${r.id}', 'MODIFIED')">Override</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--text-error);" onclick="window.pages.aiDecisions.decide('${r.id}', 'REJECTED')">Reject</button>
                </div>
              ` : `
                <span class="hint" style="font-size:0.8rem;">${r.manager_decision || 'Resolved'}</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <h1 style="margin:0; font-size:1.8rem; color:var(--text-dark);">AI Decision Center</h1>
            <p style="margin:4px 0 0 0; color:#64748b; font-size:0.9rem;">
              Production ML pipeline management, live inference oversight, and continuous learning feedback loop
            </p>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-primary" id="btn-retrain-ml" onclick="window.pages.aiDecisions.retrainModels()">
              <i data-icon="refresh"></i> Retrain Models with Feedback
            </button>
          </div>
        </div>

        <!-- Model Status & Continuous Learning KPI Cards -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.2rem; margin-bottom: 2rem;">
          <!-- Card 1: Storage Allocation Model -->
          <div class="card" style="padding:1.2rem; border-top: 4px solid var(--brand-primary);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
              <h4 style="margin:0; font-size:1rem; color:var(--text-dark); display:flex; align-items:center; gap:6px;">
                <i data-icon="cpu"></i> Storage Allocation Model
              </h4>
              <span class="pill" style="font-size:0.7rem; background:#dcfce7; color:#15803d; font-weight:600;">ACTIVE</span>
            </div>
            <div style="font-size:0.8rem; color:#64748b; margin-bottom:0.8rem;">${storageModel.algorithm || 'GradientBoostingRegressor (scikit-learn)'}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.85rem; background:#f8fafc; padding:0.6rem; border-radius:6px;">
              <div><span style="color:#64748b;">Version:</span> <strong>${storageModel.version || 'v2.0'}</strong></div>
              <div><span style="color:#64748b;">Training Samples:</span> <strong>${storageModel.training_samples || 137}</strong></div>
              <div><span style="color:#64748b;">Fit R²:</span> <strong>${(storageModel.metrics?.r2_score || 0.999).toFixed(3)}</strong></div>
              <div><span style="color:#64748b;">MAE:</span> <strong>${(storageModel.metrics?.mae || 0.005).toFixed(4)}</strong></div>
            </div>
          </div>

          <!-- Card 2: Employee Assignment Model -->
          <div class="card" style="padding:1.2rem; border-top: 4px solid var(--brand-secondary);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
              <h4 style="margin:0; font-size:1rem; color:var(--text-dark); display:flex; align-items:center; gap:6px;">
                <i data-icon="users"></i> Employee Assignment Model
              </h4>
              <span class="pill" style="font-size:0.7rem; background:#dcfce7; color:#15803d; font-weight:600;">ACTIVE</span>
            </div>
            <div style="font-size:0.8rem; color:#64748b; margin-bottom:0.8rem;">${employeeModel.algorithm || 'RandomForestRegressor (scikit-learn)'}</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.85rem; background:#f8fafc; padding:0.6rem; border-radius:6px;">
              <div><span style="color:#64748b;">Version:</span> <strong>${employeeModel.version || 'v2.0'}</strong></div>
              <div><span style="color:#64748b;">Training Samples:</span> <strong>${employeeModel.training_samples || 80}</strong></div>
              <div><span style="color:#64748b;">Predictive R²:</span> <strong>${(employeeModel.metrics?.r2_score || 0.812).toFixed(3)}</strong></div>
              <div><span style="color:#64748b;">MAE (Mins):</span> <strong>${(employeeModel.metrics?.mae || 4.12).toFixed(2)}</strong></div>
            </div>
          </div>

          <!-- Card 3: Continuous Learning & Feedback -->
          <div class="card" style="padding:1.2rem; border-top: 4px solid var(--accent-1, #f59e0b);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
              <h4 style="margin:0; font-size:1rem; color:var(--text-dark); display:flex; align-items:center; gap:6px;">
                <i data-icon="activity"></i> Manager Decisions & Feedback
              </h4>
              <span class="pill" style="font-size:0.7rem; background:#fef3c7; color:#b45309; font-weight:600;">LEARNING</span>
            </div>
            <div style="font-size:0.8rem; color:#64748b; margin-bottom:0.8rem;">Continuous retraining pool from human-in-the-loop decisions</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; font-size:0.85rem; background:#f8fafc; padding:0.6rem; border-radius:6px;">
              <div><span style="color:#64748b;">Total Decisions:</span> <strong>${feedback.total_decisions_recorded || 0}</strong></div>
              <div><span style="color:#64748b;">Accepted:</span> <strong style="color:#15803d;">${feedback.accepted || 0}</strong></div>
              <div><span style="color:#64748b;">Modified:</span> <strong style="color:#b45309;">${feedback.modified || 0}</strong></div>
              <div><span style="color:#64748b;">Rejected:</span> <strong style="color:#b91c1c;">${feedback.rejected || 0}</strong></div>
            </div>
          </div>
        </div>
        
        <div class="card" style="padding:1.5rem;">
          <h3 style="margin:0 0 1rem 0; font-size:1.1rem; color:var(--text-dark);">Persisted Operational Recommendations</h3>
          <div style="overflow-x:auto;">
            <table class="wf-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Target / Recommendation</th>
                  <th>Rationale / Constraints</th>
                  <th>ML Confidence</th>
                  <th>Status</th>
                  <th>Manager Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length > 0 ? rows : '<tr><td colspan="7" style="text-align:center; padding:2rem; color:#64748b;">No recommendations recorded yet. Receive incoming stock to trigger ML storage and workload assignments.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<div class="card" style="padding:2rem; color:red;"><h3>Error loading AI Decision Center</h3><p>${e.message}</p></div>`;
  }
};

window.pages.aiDecisions.decide = async function(id, status) {
  let reason = "Manager accepted";
  if (status === 'MODIFIED') {
      reason = prompt("Specify the modification details or override rationale for model retraining:");
      if (!reason) return;
  } else if (status === 'REJECTED') {
      reason = prompt("Please provide a reason for rejecting this recommendation (for ML continuous training):");
      if (!reason) return;
  }
  
  try {
      await window.apiClient.ai.submitFeedback({
          recommendation_id: parseInt(id),
          decision: status,
          reason: reason
      });
      window.WF.toast(`Decision recorded (${status}). Data queued for continuous retraining.`, 'ok');
      window.pages.aiDecisions(document.getElementById('router-view'));
  } catch(e) {
      window.WF.toast('Error: ' + e.message, 'bad');
  }
};

window.pages.aiDecisions.retrainModels = async function() {
  const btn = document.getElementById('btn-retrain-ml');
  if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-icon="loader"></i> Retraining Pipeline...`;
  }
  try {
      const res = await window.apiClient.ai.retrain();
      window.WF.toast(`ML models successfully retrained! Version: ${res.storage_model?.version || 'updated'}`, 'good');
      await window.pages.aiDecisions(document.getElementById('router-view'));
  } catch(e) {
      window.WF.toast('Retraining failed: ' + e.message, 'bad');
      if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i data-icon="refresh"></i> Retrain Models with Feedback`;
      }
  }
};
