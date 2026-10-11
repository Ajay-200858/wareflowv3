(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const ctx = window.WF.requireAuth();
    if (!ctx) return;
    
    const { user } = ctx;
    
    // Init data service
    await window.dataService.init();

    // Render sidebar based on role
    renderSidebar(user);

    // Profile Modal Logic
    const btnProfile = document.getElementById('btn-profile');
    const profileModal = document.getElementById('profileModal');
    const profClose = document.getElementById('profClose');
    const profileForm = document.getElementById('profileForm');
    if (btnProfile && profileModal) {
        btnProfile.addEventListener('click', () => {
            document.getElementById('profEmail').value = ctx.user.email;
            document.getElementById('profCompany').value = ctx.company.name;
            profileModal.style.display = 'flex';
        });
        profClose.addEventListener('click', () => profileModal.style.display = 'none');
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = profileForm.querySelector('button[type="submit"]');
            btn.classList.add('loading');
            try {
                const name = document.getElementById('profCompany').value.trim();
                if (!name) throw new Error("Company name is required");
                await window.apiClient.users.updateSetup({ company_name: name });
                ctx.company.name = name;
                window.WF.store.setSession(ctx);
                window.WF.toast("Profile saved", "ok");
                profileModal.style.display = 'none';
            } catch (err) {
                window.WF.toast(err.message, "bad");
            } finally {
                btn.classList.remove('loading');
            }
        });
    }

    // Register Routes
    window.router.register('#overview', window.pages.overview);
    window.router.register('#products', window.pages.products);
    window.router.register('#inventory', window.pages.inventory);
    window.router.register('#warehouse', window.pages.warehouse);
    window.router.register('#orders', window.pages.orders);
    window.router.register('#jobs', window.pages.jobs);
    window.router.register('#employees', window.pages.employees);
    window.router.register('#import', window.pages.import);
    window.router.register('#aidecisions', window.pages.aiDecisions);
    window.router.register('#notifications', window.pages.notifications);
    window.router.register('#reports', window.pages.reports);
    window.router.register('#employeeportal', window.pages.employeePortal);
    if(window.pages.demand) window.router.register('#demand', window.pages.demand);
    
    // Start router
    if (user.role.toLowerCase() === 'employee' && (!window.location.hash || window.location.hash === '#overview')) {
      window.location.hash = '#employeeportal';
    }
    
    window.router.init();
    
    // Bind global header info
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('sbCompany').textContent = window.dataService.getCompany()?.name || 'Company';
    document.getElementById('sbType').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    document.getElementById('sbAvatar').textContent = (user.name || user.email).charAt(0).toUpperCase();
    
    // Notifications toggle
    const btnNotif = document.getElementById('btn-notifications');
    if (btnNotif) {
      btnNotif.addEventListener('click', async () => {
         try {
             window.router.navigate('#notifications');
         } catch(e) {
             window.WF.toast('Failed to load notifications', 'bad');
         }
      });
      updateNotificationBadge();
      // Polling could be added here
      setInterval(updateNotificationBadge, 30000);
    }
  });

  async function updateNotificationBadge() {
    try {
      const res = await window.apiClient.notifications.getUnreadCount();
      const unread = res.count;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch(e) {
      console.warn("Failed to fetch unread notifications count", e);
    }
  }

  function renderSidebar(user) {
    const nav = document.getElementById('sidebar-nav');
    
    if (user.role.toLowerCase() === 'manager' || user.role.toLowerCase() === 'admin') {
      nav.innerHTML = `
        <p class="sb-label">Workspace</p>
        <a class="sb-link" href="#overview"><i data-icon="grid"></i>Overview</a>
        
        <p class="sb-label">Inventory</p>
        <a class="sb-link" href="#inventory"><i data-icon="snow"></i>Inventory</a>
        <a class="sb-link" href="#products"><i data-icon="chip"></i>Incoming Products</a>
        <a class="sb-link" href="#warehouse"><i data-icon="warehouse"></i>Warehouse Map</a>
        
        <p class="sb-label">Operations</p>
        <a class="sb-link" href="#orders"><i data-icon="file"></i>Orders</a>
        <a class="sb-link" href="#jobs"><i data-icon="check"></i>Jobs & Picking</a>

        <p class="sb-label">People</p>
        <a class="sb-link" href="#employees"><i data-icon="users"></i>Employees</a>

        <p class="sb-label">Data & AI</p>
        <a class="sb-link" href="#import"><i data-icon="upload"></i>CSV Import</a>
        <a class="sb-link" href="#aidecisions"><i data-icon="spark"></i>AI Decisions</a>

        <p class="sb-label">Insights</p>
        <a class="sb-link" href="#notifications"><i data-icon="bell"></i>Notifications</a>
        <a class="sb-link" href="#reports"><i data-icon="rank"></i>Reports</a>
        
        <p class="sb-label">System</p>
        <a class="sb-link" href="#settings" onclick="window.dataService.resetDemoData(); window.WF.toast('Demo reset'); return false;"><i data-icon="trash"></i>Reset Demo</a>
      `;
    } else {
      nav.innerHTML = `
        <p class="sb-label">Workspace</p>
        <a class="sb-link" href="#employeeportal"><i data-icon="grid"></i>My Portal</a>
      `;
    }
    
    window.WF.hydrate(nav);
  }

})();
