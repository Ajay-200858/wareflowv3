(function() {
  'use strict';

  window.app = {
    renderNavigation(user) {
      if (!user) return;
      renderSidebar(user);
      
      const emailEl = document.getElementById('userEmail');
      const compEl = document.getElementById('sbCompany');
      const typeEl = document.getElementById('sbType');
      const avatarEl = document.getElementById('sbAvatar');

      const sess = window.WF && window.WF.store ? window.WF.store.session() : null;
      const companyName = (sess && sess.company && sess.company.name) || window.dataService.getCompany()?.name || 'Company';

      if (emailEl) emailEl.textContent = user.email || '';
      if (compEl) compEl.textContent = companyName;
      if (typeEl) typeEl.textContent = (user.role || '').charAt(0).toUpperCase() + (user.role || '').slice(1).toLowerCase();
      if (avatarEl) avatarEl.textContent = (user.name || user.email || 'W').charAt(0).toUpperCase();
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const ctx = window.WF.requireAuth();
    if (!ctx) return;
    
    const { user } = ctx;
    
    // Init data service
    await window.dataService.init();

    // Render navigation for active tab session
    window.app.renderNavigation(user);

    // Profile Modal Logic
    const btnProfile = document.getElementById('btn-profile');
    const profileModal = document.getElementById('profileModal');
    const profClose = document.getElementById('profClose');
    const profileForm = document.getElementById('profileForm');
    if (btnProfile && profileModal) {
        btnProfile.addEventListener('click', () => {
            const currentSession = window.WF.store.session();
            if (!currentSession) return;
            if (currentSession.user && currentSession.user.role && currentSession.user.role.toUpperCase() === 'EMPLOYEE') {
              window.router.navigate('#employee-profile');
              return;
            }
            document.getElementById('profEmail').value = currentSession.user.email;
            document.getElementById('profCompany').value = currentSession.company?.name || '';
            profileModal.style.display = 'flex';
        });
        if (profClose) profClose.addEventListener('click', () => profileModal.style.display = 'none');
        if (profileForm) {
          profileForm.addEventListener('submit', async (e) => {
              e.preventDefault();
              const btn = profileForm.querySelector('button[type="submit"]');
              btn.classList.add('loading');
              try {
                  const name = document.getElementById('profCompany').value.trim();
                  if (!name) throw new Error("Company name is required");
                  await window.apiClient.users.updateSetup({ company_name: name });
                  const activeSess = window.WF.store.session();
                  if (activeSess && activeSess.company) {
                    activeSess.company.name = name;
                    window.WF.store.setSession(activeSess);
                  }
                  window.WF.toast("Profile saved", "ok");
                  profileModal.style.display = 'none';
                  window.app.renderNavigation(activeSess.user);
              } catch (err) {
                  window.WF.toast(err.message, "bad");
              } finally {
                  btn.classList.remove('loading');
              }
          });
        }
    }

    // Register Manager Routes
    if (window.pages.overview) window.router.register('#overview', window.pages.overview);
    if (window.pages.products) window.router.register('#products', window.pages.products);
    if (window.pages.inventory) window.router.register('#inventory', window.pages.inventory);
    if (window.pages.warehouse) window.router.register('#warehouse', window.pages.warehouse);
    if (window.pages.orders) window.router.register('#orders', window.pages.orders);
    if (window.pages.jobs) window.router.register('#jobs', window.pages.jobs);
    if (window.pages.employees) window.router.register('#employees', window.pages.employees);
    if (window.pages.salaryManagement) window.router.register('#salary-management', window.pages.salaryManagement);
    if (window.pages.import) window.router.register('#import', window.pages.import);
    if (window.pages.aiDecisions) window.router.register('#aidecisions', window.pages.aiDecisions);
    if (window.pages.notifications) window.router.register('#notifications', window.pages.notifications);
    if (window.pages.reports) window.router.register('#reports', window.pages.reports);

    // Register Employee Dashboard Routes
    if (window.pages.employeeOverview) {
      window.router.register('#employee-overview', window.pages.employeeOverview);
      window.router.register('#employee-jobs', window.pages.employeeJobs);
      window.router.register('#employee-workspace', window.pages.employeeWorkspace);
      window.router.register('#employee-salary', window.pages.employeeSalary);
      window.router.register('#employee-attendance', window.pages.employeeAttendance);
      window.router.register('#employee-notifications', window.pages.employeeNotifications);
      window.router.register('#employee-profile', window.pages.employeeProfile);
      window.router.register('#employee-ai', window.pages.employeeAi);
      window.router.register('#employeeportal', window.pages.employeeOverview);
    }
    if (window.pages.demand) window.router.register('#demand', window.pages.demand);
    
    // Start router
    const isEmp = user.role && user.role.toUpperCase() === 'EMPLOYEE';
    if (isEmp && (!window.location.hash || window.location.hash === '#overview')) {
      window.location.hash = '#employee-overview';
    } else if (!isEmp && (!window.location.hash || window.location.hash === '#employee-overview')) {
      window.location.hash = '#overview';
    }
    
    window.router.init();

    // Notifications toggle
    const btnNotif = document.getElementById('btn-notifications');
    if (btnNotif) {
      btnNotif.addEventListener('click', async () => {
         try {
             const sess = window.WF.store.session();
             if (sess && sess.user && sess.user.role && sess.user.role.toUpperCase() === 'EMPLOYEE') {
                 window.router.navigate('#employee-notifications');
             } else {
                 window.router.navigate('#notifications');
             }
         } catch(e) {
             window.WF.toast('Failed to load notifications', 'bad');
         }
      });
      updateNotificationBadge();
      setInterval(updateNotificationBadge, 30000);
    }
  });

  async function updateNotificationBadge() {
    try {
      const token = window.apiClient.getToken();
      if (!token) return;
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
    if (!nav) return;
    
    const role = (user && user.role) ? user.role.toUpperCase() : 'MANAGER';
    
    if (role === 'MANAGER' || role === 'ADMIN') {
      nav.innerHTML = `
        <p class="sb-label">Workspace</p>
        <a class="sb-link" href="#overview"><i data-icon="grid"></i>Overview</a>
        
        <p class="sb-label">Inventory & Sites</p>
        <a class="sb-link" href="#inventory"><i data-icon="snow"></i>Inventory</a>
        <a class="sb-link" href="#products"><i data-icon="chip"></i>Incoming Products</a>
        <a class="sb-link" href="#warehouse"><i data-icon="warehouse"></i>Warehouse Map</a>
        
        <p class="sb-label">Operations</p>
        <a class="sb-link" href="#orders"><i data-icon="file"></i>Orders</a>
        <a class="sb-link" href="#jobs"><i data-icon="check"></i>Jobs & Picking</a>

        <p class="sb-label">People & Payroll</p>
        <a class="sb-link" href="#employees"><i data-icon="users"></i>Employees</a>
        <a class="sb-link" href="#salary-management"><i data-icon="file"></i>Salary & Payroll</a>

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
        <p class="sb-label">My Workspace</p>
        <a class="sb-link" href="#employee-overview"><i data-icon="grid"></i>Overview</a>
        <a class="sb-link" href="#employee-jobs"><i data-icon="check"></i>My Jobs</a>
        <a class="sb-link" href="#employee-workspace"><i data-icon="warehouse"></i>Warehouse Map</a>

        <p class="sb-label">Personal</p>
        <a class="sb-link" href="#employee-attendance"><i data-icon="panel"></i>Attendance</a>
        <a class="sb-link" href="#employee-salary"><i data-icon="file"></i>My Salary</a>
        <a class="sb-link" href="#employee-profile"><i data-icon="user"></i>Profile</a>

        <p class="sb-label">Assistance</p>
        <a class="sb-link" href="#employee-ai"><i data-icon="spark"></i>AI Assistant</a>
        <a class="sb-link" href="#employee-notifications"><i data-icon="bell"></i>Notifications</a>
      `;
    }
    
    window.WF.hydrate(nav);
  }

})();
