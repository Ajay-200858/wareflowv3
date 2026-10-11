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
          this.handleRoute(true); // Re-render correctly by going through handleRoute
        }
      });
      this.handleRoute();
    },

    register(path, handler) {
      this.routes[path] = handler;
    },

    handleRoute(isBackground = false) {
      let hash = window.location.hash || '#overview';
      this.currentRoute = hash;

      // Update sidebar active state
      document.querySelectorAll('.sb-link').forEach(link => {
        if (link.getAttribute('href') === hash) link.classList.add('active');
        else link.classList.remove('active');
      });

      const handler = this.routes[hash];
      const view = document.getElementById('router-view');
      const title = document.getElementById('topbar-title');
      
      if (handler) {
        let titleText = hash.replace('#', '');
        if (hash === '#products') {
          titleText = 'Incoming Products';
        } else {
          titleText = titleText.charAt(0).toUpperCase() + titleText.slice(1);
        }
        title.textContent = titleText;
        
        if (!isBackground) {
            view.innerHTML = '<div class="panel" style="text-align:center; padding: 40px;">Loading...</div>';
        }
        
        (async () => {
            try {
                await handler(view);
                window.WF.hydrate(view);
                window.WF.observe(view);
            } catch (err) {
                view.innerHTML = `<div class="panel" style="color:red">Error: ${err.message}</div>`;
                console.error(err);
            }
        })();
      } else {
        view.innerHTML = `<div class="emptystate"><h2>Page not found</h2></div>`;
      }
    },
    
    navigate(hash) {
      window.location.hash = hash;
    }
  };

})();
