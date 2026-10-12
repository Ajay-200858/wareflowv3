(function() {
  'use strict';

  window.dataService = {
    async init() {
      if (window.apiClient.getToken()) {
          await this.fetchAll();
      }
    },

    async resetDemoData() {
      alert("Resetting demo data is disabled in the live production database to prevent accidental data loss. Please use the CSV Import Center to manage your data.");
      // No longer making the non-existent API call
    },

    // We can no longer do sync returns for things that are fetched asynchronously from the backend,
    // but the existing frontend is tightly coupled to sync methods like getProducts().
    // So we need to maintain an in-memory cache that gets updated from the backend.
    db: {
      company: null,
      warehouses: [],
      products: [],
      inventory: [],
      orders: [],
      employees: [],
      jobs: [],
      recommendations: [],
      activity: [],
      notifications: []
    },

    async fetchAll() {
      const sess = window.WF && window.WF.store ? window.WF.store.session() : null;
      if (!sess || !sess.user || (sess.user.role && sess.user.role.toUpperCase() === 'EMPLOYEE')) {
        return;
      }
      try {
        const [
          overview, products, inventory, orders, jobs, employees, recommendations
        ] = await Promise.all([
          window.apiClient.dashboard.overview().catch(() => null),
          window.apiClient.products.getAll().catch(() => []),
          window.apiClient.inventory.getAll().catch(() => []),
          window.apiClient.orders.getAll().catch(() => []),
          window.apiClient.jobs.getAll().catch(() => []),
          window.apiClient.employees.getAll().catch(() => []),
          window.apiClient.ai.getDecisions().catch(() => [])
        ]);

        if (overview) {
          this.db.company = overview.company;
        }
        if (products) this.db.products = products;
        if (inventory) this.db.inventory = inventory;
        if (orders) this.db.orders = orders;
        if (jobs) this.db.jobs = jobs;
        if (employees) this.db.employees = employees;
        if (recommendations) this.db.recommendations = recommendations;
        
        window.dispatchEvent(new Event('db_updated'));
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    },

    getCompany() { return this.db.company; },
    getWarehouses() { return this.db.warehouses; },
    getWarehouse(id) { return this.db.warehouses.find(w => w.id === id); },

    getProducts() { return this.db.products; },
    getProduct(id) { return this.db.products.find(p => p.id === id); },
    async updateProduct(p) {
        await window.apiClient.request("/products", p.id ? "PUT" : "POST", p);
        await this.fetchAll();
    },

    getInventory() { return this.db.inventory; },
    getInventoryForProduct(productId) {
      return this.db.inventory.filter(i => i.product_id === productId);
    },
    async updateInventory(invId, newQty) {
      // API call to update inventory
      await window.apiClient.request(`/inventory/${invId}`, "PUT", { quantity: newQty });
      await this.fetchAll();
    },

    getOrders() { return this.db.orders; },
    getOrder(id) { return this.db.orders.find(o => o.id === id); },

    getEmployees() { return this.db.employees; },
    getEmployee(id) { return this.db.employees.find(e => e.id === id); },

    getJobs() { return this.db.jobs; },
    getJobsForEmployee(empId) { return this.db.jobs.filter(j => j.employee_id === empId); },
    async updateJob(j) {
        await window.apiClient.request(`/jobs/${j.id}`, "PUT", j);
        await this.fetchAll();
    },

    getRecommendations() { return this.db.recommendations; },
    async updateRecommendation(r) {
        await window.apiClient.ai.submitFeedback({
            recommendation_id: r.id, decision: r.status, reason: r.decision_reason
        });
        await this.fetchAll();
    },

    getActivity() { return this.db.activity; },
    getNotifications() { return this.db.notifications; },
    async markNotificationRead(id) {
        await window.apiClient.request(`/notifications/${id}/read`, "PUT");
        await this.fetchAll();
    },
    
    syncLegacyAuth() {
        if (!window.WF || !window.WF.store) return;
        const c = this.db.company;
        if(c) window.WF.store.saveCompany({ id: c.id, name: c.name, type: 'cold_storage_co', email: 'admin@wareflow.demo', status: c.status });
    }
  };

  // periodically fetch data
  setInterval(() => {
    if (window.apiClient.getToken()) {
      window.dataService.fetchAll();
    }
  }, 10000); // every 10 seconds

})();
