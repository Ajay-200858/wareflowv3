/**
 * WareFlow Customer Commerce Platform — API Client
 */
(function() {
  function getBaseUrl() {
    return window.WF_CONFIG ? window.WF_CONFIG.getApiBaseUrl() : "http://localhost:8000/api";
  }

  function getToken() {
    return localStorage.getItem(window.WF_CONFIG.TOKEN_KEY) || sessionStorage.getItem(window.WF_CONFIG.TOKEN_KEY);
  }

  function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  async function request(endpoint, method = "GET", body = null, isFormData = false) {
    const url = `${getBaseUrl()}${endpoint}`;
    const headers = {};
    const token = getToken();

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers
    };

    if (body) {
      if (isFormData) {
        options.body = body;
      } else {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
    }

    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg = data && (data.detail || data.message) ? data.detail || data.message : `Request failed with status ${res.status}`;
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      console.error(`[API Error] ${method} ${endpoint}:`, err);
      throw err;
    }
  }

  const CustomerAPI = {
    showToast,
    request,

    auth: {
      register(data) {
        return request("/customer/auth/register", "POST", data);
      },
      login(data) {
        return request("/customer/auth/login", "POST", data);
      },
      getProfile() {
        return request("/customer/auth/me", "GET");
      },
      updateProfile(data) {
        return request("/customer/auth/profile", "PUT", data);
      }
    },

    catalog: {
      getProducts(params = {}) {
        const q = new URLSearchParams();
        if (params.search) q.set("search", params.search);
        if (params.category_id) q.set("category_id", params.category_id);
        if (params.in_stock_only) q.set("in_stock_only", "true");
        if (params.sort_by) q.set("sort_by", params.sort_by);
        if (params.page) q.set("page", params.page);
        if (params.limit) q.set("limit", params.limit);
        return request(`/customer/products?${q.toString()}`, "GET");
      },
      getProductDetail(productId) {
        return request(`/customer/products/${productId}`, "GET");
      },
      getCategories() {
        return request("/customer/categories", "GET");
      }
    },

    cart: {
      getCart() {
        return request("/customer/cart", "GET");
      },
      addItem(productId, quantity) {
        return request("/customer/cart", "POST", { product_id: productId, quantity });
      },
      syncCart(items) {
        return request("/customer/cart/sync", "POST", { items });
      },
      removeItem(productId) {
        return request(`/customer/cart/${productId}`, "DELETE");
      },
      clearCart() {
        return request("/customer/cart", "DELETE");
      }
    },

    orders: {
      validate(rows) {
        return request("/customer/orders/validate", "POST", rows);
      },
      previewBulkCsv(file) {
        const fd = new FormData();
        fd.append("file", file);
        return request("/customer/orders/bulk-csv-preview", "POST", fd, true);
      },
      createOrder(payload) {
        return request("/customer/orders", "POST", payload);
      },
      getOrders() {
        return request("/customer/orders", "GET");
      },
      getOrderDetail(orderId) {
        return request(`/customer/orders/${orderId}`, "GET");
      },
      cancelOrder(orderId) {
        return request(`/customer/orders/${orderId}/cancel`, "POST");
      },
      reorder(orderId) {
        return request(`/customer/orders/${orderId}/reorder`, "POST");
      }
    },

    events: {
      track(eventType, productId, eventValue = 1.0, metadata = null) {
        const sessionId = window.WF_TRACKER ? window.WF_TRACKER.getSessionId() : null;
        return request("/customer/events", "POST", {
          event_type: eventType,
          product_id: productId,
          session_id: sessionId,
          event_value: eventValue,
          metadata
        }).catch(() => null);
      }
    },

    recommendations: {
      getRecommendations(limit = 12, productId = null) {
        const sessionId = window.WF_TRACKER ? window.WF_TRACKER.getSessionId() : null;
        const q = new URLSearchParams({ limit });
        if (productId) q.set("product_id", productId);
        if (sessionId) q.set("session_id", sessionId);
        return request(`/customer/recommendations?${q.toString()}`, "GET");
      }
    }
  };

  window.CustomerAPI = CustomerAPI;
})();
