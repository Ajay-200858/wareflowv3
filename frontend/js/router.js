(function() {
  'use strict';

  window.router = {
    routes: {},
    currentRoute: null,
    
    init() {
      window.addEventListener('hashchange', () => this.handleRoute());
      // Handle db changes to re-render current route
      window.addEventListener('db_updated', () => {
        if (document.querySelector('.scrim')) {
            // Do not re-render the page if a modal is open
            return;
        }
        if (this.currentRoute && this.routes[this.currentRoute]) {
          this.handleRoute(true);
        }
      });
      this.handleRoute();
    },

    register(path, handler) {
      this.routes[path] = handler;
    },

    handleRoute(isBackground = false) {
      // 1. Validate tab-isolated authenticated session
      const session = window.WF && window.WF.store ? window.WF.store.session() : null;
      if (!session || !session.user) {
        window.location.replace('index.html');
        return;
      }

      // 2. Resolve role
      const user = session.user;
      const role = (user.role || 'MANAGER').toUpperCase();
      const isEmployee = role === 'EMPLOYEE';

      const defaultHash = isEmployee ? '#employee-overview' : '#overview';
      let hash = window.location.hash || defaultHash;

      // 3. Strict Role-based Route Protection
      const managerOnlyRoutes = [
        '#overview', '#products', '#inventory', '#warehouse', 
        '#orders', '#jobs', '#employees', '#salary-management', 
        '#import', '#aidecisions', '#notifications', '#reports'
      ];

      const employeeOnlyRoutes = [
        '#employee-overview', '#employee-jobs', '#employee-workspace', 
        '#employee-salary', '#employee-attendance', '#employee-notifications', 
        '#employee-profile', '#employee-ai', '#employeeportal'
      ];

      if (isEmployee && managerOnlyRoutes.includes(hash.toLowerCase())) {
        window.location.hash = '#employee-overview';
        if (window.WF && window.WF.toast) {
          window.WF.toast('Manager access restricted for employee role', 'bad');
        }
        return;
      }

      if (!isEmployee && employeeOnlyRoutes.includes(hash.toLowerCase())) {
        window.location.hash = '#overview';
        return;
      }

      // 4. Clean up any open modal scrims before rendering new page
      if (!isBackground) {
        document.querySelectorAll('.scrim').forEach(s => s.remove());
      }

      this.currentRoute = hash;

      // 5. Always synchronize layout (sidebar & header) to this tab's authenticated user
      if (window.app && window.app.renderNavigation) {
        window.app.renderNavigation(user);
      }

      // Update sidebar active link state
      document.querySelectorAll('.sb-link').forEach(link => {
        if (link.getAttribute('href') === hash) link.classList.add('active');
        else link.classList.remove('active');
      });

      const handler = this.routes[hash];
      const view = document.getElementById('router-view');
      const title = document.getElementById('topbar-title');
      
      if (handler) {
        const titleMap = {
          '#overview': 'Overview',
          '#products': 'Incoming Products',
          '#inventory': 'Inventory Management',
          '#warehouse': 'Warehouse Digital Twin',
          '#orders': 'Orders & Fulfillment',
          '#jobs': 'Jobs & Operations',
          '#employees': 'Employees & Workload',
          '#salary-management': 'Salary & Payroll Management',
          '#import': 'CSV Data Import',
          '#aidecisions': 'AI Decision Engine',
          '#notifications': 'Notifications',
          '#reports': 'Reports & Analytics',
          '#employee-overview': 'Employee Dashboard',
          '#employee-jobs': 'My Assigned Jobs',
          '#employee-workspace': 'My Workspace & Warehouse Map',
          '#employee-salary': 'My Salary & Earnings',
          '#employee-attendance': 'My Attendance & Shifts',
          '#employee-notifications': 'My Notifications',
          '#employee-profile': 'My Employee Profile',
          '#employee-ai': 'AI Work Assistant'
        };

        if (title) {
          title.textContent = titleMap[hash] || (hash.replace('#', '').charAt(0).toUpperCase() + hash.replace('#', '').slice(1));
        }
        
        if (!isBackground && view) {
            view.innerHTML = '<div class="panel" style="text-align:center; padding: 40px;">Loading...</div>';
        }
        
        (async () => {
            try {
                if (view) {
                  await handler(view);
                  window.WF.hydrate(view);
                  window.WF.observe(view);
                }
            } catch (err) {
                if (view) view.innerHTML = `<div class="panel" style="color:var(--bad); padding:2rem;">Error: ${err.message}</div>`;
                console.error(err);
            }
        })();
      } else if (view) {
        view.innerHTML = `<div class="emptystate" style="padding:3rem; text-align:center;"><h2>Page not found</h2><p style="color:var(--ink-2);">Route ${hash} does not exist.</p></div>`;
      }
    },
    
    navigate(hash) {
      window.location.hash = hash;
    }
  };

})();
