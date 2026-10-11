window.pages = window.pages || {};

window.pages.notifications = async function(container) {
  const api = window.apiClient;
  
  try {
      const notifs = await api.notifications.getAll();
      
      const rows = notifs.map(n => `
        <div class="card" style="margin-bottom: 1rem; padding: 1rem; border-left: 4px solid ${n.is_read ? '#ccc' : '#f5b335'}; background: ${n.is_read ? '#fff' : '#fffdf5'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <h4 style="margin:0 0 0.25rem 0;">${n.title}</h4>
              <p style="margin:0; color:#555;">${n.message}</p>
              <small style="color:#888;">${new Date(n.created_at).toLocaleString()}</small>
            </div>
            ${!n.is_read ? `<button class="btn btn-ghost btn-sm" onclick="window.pages.notifications.markRead(${n.id})">Mark as read</button>` : `<span style="color:#888; font-size:12px;">Read</span>`}
          </div>
        </div>
      `).join('');

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
          <h1 style="margin:0;">Notifications</h1>
          <button class="btn btn-ghost" onclick="window.pages.notifications.markAllRead()">Mark all as read</button>
        </div>
        <div>
          ${rows.length ? rows : '<div class="panel" style="text-align:center;">No notifications.</div>'}
        </div>
      `;
  } catch (e) {
      container.innerHTML = `<p>Error loading notifications: ${e.message}</p>`;
  }
};

window.pages.notifications.markRead = async function(id) {
    try {
        await window.apiClient.notifications.markAsRead(id);
        window.pages.notifications(document.getElementById('router-view'));
        // refresh badge if function available
        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
    } catch(e) {
        window.WF.toast('Failed: ' + e.message, 'bad');
    }
};

window.pages.notifications.markAllRead = async function() {
    try {
        await window.apiClient.notifications.markAllAsRead();
        window.pages.notifications(document.getElementById('router-view'));
        if (typeof window.updateNotificationBadge === 'function') window.updateNotificationBadge();
    } catch(e) {
        window.WF.toast('Failed: ' + e.message, 'bad');
    }
};
